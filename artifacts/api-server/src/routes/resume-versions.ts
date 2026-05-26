import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, resumeVersionsTable, eventLogsTable, aiRunEvaluationsTable, aiTrainingExamplesTable } from "@workspace/db";
import {
  ListResumeVersionsQueryParams,
  ListResumeVersionsResponse,
  GetResumeVersionParams,
  GetResumeVersionResponse,
  UpdateResumeVersionParams,
  UpdateResumeVersionBody,
  UpdateResumeVersionResponse,
  DeleteResumeVersionParams,
  ApproveResumeVersionParams,
  ApproveResumeVersionBody,
  ApproveResumeVersionResponse,
  RejectResumeVersionParams,
  RejectResumeVersionBody,
  RejectResumeVersionResponse,
} from "@workspace/api-zod";
import { validateLineage } from "../lib/lineage";
import { generateResumeDocx } from "../lib/docx-export";
import { scrubWizardStateReferences } from "../lib/wizard-state-cleanup";
import type { JobOpsRequest } from "../lib/http-types";
import { currentUserId } from "../lib/ownership";

const router: IRouter = Router();

function getResumeApprovalBlocker(resumeVersion: typeof resumeVersionsTable.$inferSelect): string | null {
  const diffData =
    resumeVersion.diffData && typeof resumeVersion.diffData === "object" && !Array.isArray(resumeVersion.diffData)
      ? (resumeVersion.diffData as Record<string, unknown>)
      : {};
  const hasStructuredBullets =
    Array.isArray(resumeVersion.tailoredBullets) && resumeVersion.tailoredBullets.length > 0;
  const sourceValidation =
    diffData.sourceValidation && typeof diffData.sourceValidation === "object" && !Array.isArray(diffData.sourceValidation)
      ? (diffData.sourceValidation as Record<string, unknown>)
      : null;
  const hasPassingSourceValidation =
    sourceValidation?.passed === true &&
    typeof sourceValidation.validItemCount === "number" &&
    sourceValidation.validItemCount > 0;
  const semanticValidation =
    diffData.semanticValidation && typeof diffData.semanticValidation === "object" && !Array.isArray(diffData.semanticValidation)
      ? (diffData.semanticValidation as Record<string, unknown>)
      : null;
  const hasPassingSemanticValidation = semanticValidation?.passed === true;
  const hasBlockingDiagnostic =
    typeof resumeVersion.notes === "string" &&
    /could not be repaired|truth lock failure|quality check failed|truth review failed|generation failed|source validation failed|semantic template validation failed|base resume parse failed|needs review/i.test(resumeVersion.notes);
  const modelContract = typeof diffData.modelContract === "string" ? diffData.modelContract : null;
  const isDeterministicFallbackContract = modelContract === "deterministic_base_resume_fallback_v1";

  if (
    !resumeVersion.templateId ||
    !diffData.templateValidation ||
    !hasStructuredBullets ||
    !hasPassingSourceValidation ||
    !hasPassingSemanticValidation ||
    hasBlockingDiagnostic ||
    isDeterministicFallbackContract
  ) {
    return "This resume does not have passing structured content, truth review, and template validation metadata.";
  }

  return null;
}

router.get("/resume-versions", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  req.log.info("Listing resume versions");
  const query = ListResumeVersionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [eq(resumeVersionsTable.userId, userId)];
  if (query.data.jobId != null) {
    conditions.push(eq(resumeVersionsTable.jobId, query.data.jobId));
  }
  if (query.data.status != null) {
    conditions.push(eq(resumeVersionsTable.status, query.data.status));
  }

  const rows = await db
    .select()
    .from(resumeVersionsTable)
    .where(and(...conditions))
    .orderBy(resumeVersionsTable.createdAt);
  res.json(ListResumeVersionsResponse.parse(rows));
});

router.get("/resume-versions/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = GetResumeVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(resumeVersionsTable)
    .where(and(eq(resumeVersionsTable.id, params.data.id), eq(resumeVersionsTable.userId, userId)));
  if (!row) {
    res.status(404).json({ error: "Resume version not found" });
    return;
  }
  res.json(GetResumeVersionResponse.parse(row));
});

router.patch("/resume-versions/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = UpdateResumeVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateResumeVersionBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid update resume version body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.status != null) {
    res.status(400).json({
      error: 'Resume status can only change through /approve or /reject. Direct PATCH status updates are not allowed.',
    });
    return;
  }
  const [row] = await db
    .update(resumeVersionsTable)
    .set(parsed.data)
    .where(and(eq(resumeVersionsTable.id, params.data.id), eq(resumeVersionsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Resume version not found" });
    return;
  }
  res.json(UpdateResumeVersionResponse.parse(row));
});

router.delete("/resume-versions/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = DeleteResumeVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(resumeVersionsTable)
    .where(and(eq(resumeVersionsTable.id, params.data.id), eq(resumeVersionsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Resume version not found" });
    return;
  }
  await scrubWizardStateReferences({ userId, resumeVersionIds: [params.data.id] });
  res.sendStatus(204);
});

router.post("/resume-versions/:id/approve", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = ApproveResumeVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsedBody = ApproveResumeVersionBody.safeParse(req.body);
  if (!parsedBody.success) {
    req.log.warn({ error: parsedBody.error.message }, "Invalid approve resume version body");
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(resumeVersionsTable)
    .where(and(eq(resumeVersionsTable.id, params.data.id), eq(resumeVersionsTable.userId, userId)));
  if (!existing[0]) {
    res.status(404).json({ error: "Resume version not found" });
    return;
  }

  const resumeVersion = existing[0];
  const previousStatus = resumeVersion.status;

  if (previousStatus !== "pending_approval") {
    res.status(409).json({
      error: `Cannot approve a resume version in status "${previousStatus}". Only "pending_approval" versions can be approved.`,
    });
    return;
  }

  // Only validate lineage when runId is present — versions created
  // New resume drafts must have structured truth and template metadata before approval.
  const approvalBlocker = getResumeApprovalBlocker(resumeVersion);
  if (approvalBlocker) {
    res.status(422).json({
      error: "Resume must be regenerated before approval",
      details: approvalBlocker,
    });
    return;
  }

  // Only validate lineage when runId is present; diagnostic rows may not have lineage data.
  if (resumeVersion.runId) {
    const lineageValidation = await validateLineage({
      table: "resume_versions",
      id: resumeVersion.id,
      runId: resumeVersion.runId,
      eventLogId: resumeVersion.eventLogId,
      entityType: "resume_version",
      entityId: resumeVersion.id,
      jobId: resumeVersion.jobId,
    });

    if (!lineageValidation.ok) {
      res.status(422).json({
        error: "Lineage validation failed",
        details: {
          status: lineageValidation.status,
          reasons: lineageValidation.diagnostics.reasons,
        },
      });
      return;
    }
  }

  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(resumeVersionsTable)
      .set({ status: "approved" })
      .where(and(eq(resumeVersionsTable.id, params.data.id), eq(resumeVersionsTable.userId, userId)))
      .returning();

    const [eventLog] = await tx
      .insert(eventLogsTable)
      .values({
        userId,
        entityType: "resume_version",
        entityId: params.data.id,
        jobId: existing[0]!.jobId ?? null,
        applicationId: null,
        eventType: "approval",
        previousState: previousStatus,
        nextState: "approved",
        actorType: "user",
        runId: resumeVersion.runId,
        metadata: { resumeVersionId: params.data.id },
      })
      .returning({ id: eventLogsTable.id });

    await tx
      .insert(aiRunEvaluationsTable)
      .values({
        userId,
        runId: resumeVersion.runId,
        taskScope: "resume_review",
        entityType: "resume_version",
        entityId: resumeVersion.id,
        eventLogId: eventLog?.id ?? null,
        evaluatorType: "user",
        approvalOutcome: "approved",
        truthfulnessScore: parsedBody.data.rubric?.truthfulnessScore ?? null,
        relevanceScore: parsedBody.data.rubric?.relevanceScore ?? null,
        formattingScore: parsedBody.data.rubric?.formattingScore ?? null,
        attributionScore: parsedBody.data.rubric?.attributionScore ?? null,
        editDistance: parsedBody.data.editDistance ?? null,
        notes: parsedBody.data.notes ?? null,
        metadata: {},
      })
      .onConflictDoUpdate({
        target: [
          aiRunEvaluationsTable.runId,
          aiRunEvaluationsTable.taskScope,
          aiRunEvaluationsTable.entityType,
          aiRunEvaluationsTable.entityId,
        ],
        set: {
          eventLogId: eventLog?.id ?? null,
          evaluatorType: "user",
          approvalOutcome: "approved",
          truthfulnessScore: parsedBody.data.rubric?.truthfulnessScore ?? null,
          relevanceScore: parsedBody.data.rubric?.relevanceScore ?? null,
          formattingScore: parsedBody.data.rubric?.formattingScore ?? null,
          attributionScore: parsedBody.data.rubric?.attributionScore ?? null,
          editDistance: parsedBody.data.editDistance ?? null,
          notes: parsedBody.data.notes ?? null,
          metadata: {},
        },
      });

    return updated!;
  });

  // Promote approved output to training examples (feeds few-shot self-healing loop)
  if (row.runId && row.tailoredDocumentText) {
    db.insert(aiTrainingExamplesTable)
      .values({
        userId,
        taskScope: "resume_tailoring",
        sourceEntityType: "resume_version",
        sourceEntityId: row.id,
        inputSnapshot: {
          jobId: row.jobId,
          claimIds: row.claimIds,
          baseResumeVersionId: row.baseResumeVersionId,
        },
        approvedOutput: row.tailoredDocumentText,
        notes: `Auto-promoted from approved resume version ${row.id}`,
        qualityScore: 80,
        isActive: true,
        metadata: { runId: row.runId },
      })
      .catch((trainErr: unknown) =>
        req.log.warn({ trainErr }, "Failed to promote resume version to training examples — non-fatal"),
      );
  }

  req.log.info({ id: params.data.id }, "Resume version approved");
  res.json(ApproveResumeVersionResponse.parse(row));
});

router.post("/resume-versions/:id/reject", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = RejectResumeVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsedBody = RejectResumeVersionBody.safeParse(req.body);
  if (!parsedBody.success) {
    req.log.warn({ error: parsedBody.error.message }, "Invalid reject resume version body");
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(resumeVersionsTable)
    .where(and(eq(resumeVersionsTable.id, params.data.id), eq(resumeVersionsTable.userId, userId)));
  if (!existing[0]) {
    res.status(404).json({ error: "Resume version not found" });
    return;
  }

  const resumeVersion = existing[0];
  const previousStatus = resumeVersion.status;

  const approvalBlocker = getResumeApprovalBlocker(resumeVersion);
  const canRejectApprovedInvalidResume = previousStatus === "approved" && approvalBlocker != null;
  if (previousStatus !== "pending_approval" && !canRejectApprovedInvalidResume) {
    res.status(409).json({
      error: `Cannot reject a resume version in status "${previousStatus}". Only "pending_approval" versions, or previously approved versions that now fail approval validation, can be rejected.`,
    });
    return;
  }

  // Only validate lineage when runId is present — versions created
  // via error paths or manual creation may not have lineage data
  if (resumeVersion.runId) {
    const lineageValidation = await validateLineage({
      table: "resume_versions",
      id: resumeVersion.id,
      runId: resumeVersion.runId,
      eventLogId: resumeVersion.eventLogId,
      entityType: "resume_version",
      entityId: resumeVersion.id,
      jobId: resumeVersion.jobId,
    });

    if (!lineageValidation.ok) {
      res.status(422).json({
        error: "Lineage validation failed",
        details: {
          status: lineageValidation.status,
          reasons: lineageValidation.diagnostics.reasons,
        },
      });
      return;
    }
  }

  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(resumeVersionsTable)
      .set({ status: "rejected" })
      .where(and(eq(resumeVersionsTable.id, params.data.id), eq(resumeVersionsTable.userId, userId)))
      .returning();

    const [eventLog] = await tx
      .insert(eventLogsTable)
      .values({
        userId,
        entityType: "resume_version",
        entityId: params.data.id,
        jobId: existing[0]!.jobId ?? null,
        applicationId: null,
        eventType: "rejection",
        previousState: previousStatus,
        nextState: "rejected",
        actorType: "user",
        runId: resumeVersion.runId,
        metadata: { resumeVersionId: params.data.id },
      })
      .returning({ id: eventLogsTable.id });

    await tx
      .insert(aiRunEvaluationsTable)
      .values({
        userId,
        runId: resumeVersion.runId,
        taskScope: "resume_review",
        entityType: "resume_version",
        entityId: resumeVersion.id,
        eventLogId: eventLog?.id ?? null,
        evaluatorType: "user",
        approvalOutcome: "rejected",
        truthfulnessScore: parsedBody.data.rubric?.truthfulnessScore ?? null,
        relevanceScore: parsedBody.data.rubric?.relevanceScore ?? null,
        formattingScore: parsedBody.data.rubric?.formattingScore ?? null,
        attributionScore: parsedBody.data.rubric?.attributionScore ?? null,
        editDistance: parsedBody.data.editDistance ?? null,
        notes: parsedBody.data.notes ?? null,
        metadata: {},
      })
      .onConflictDoUpdate({
        target: [
          aiRunEvaluationsTable.runId,
          aiRunEvaluationsTable.taskScope,
          aiRunEvaluationsTable.entityType,
          aiRunEvaluationsTable.entityId,
        ],
        set: {
          eventLogId: eventLog?.id ?? null,
          evaluatorType: "user",
          approvalOutcome: "rejected",
          truthfulnessScore: parsedBody.data.rubric?.truthfulnessScore ?? null,
          relevanceScore: parsedBody.data.rubric?.relevanceScore ?? null,
          formattingScore: parsedBody.data.rubric?.formattingScore ?? null,
          attributionScore: parsedBody.data.rubric?.attributionScore ?? null,
          editDistance: parsedBody.data.editDistance ?? null,
          notes: parsedBody.data.notes ?? null,
          metadata: {},
        },
      });

    return updated!;
  });

  req.log.info({ id: params.data.id }, "Resume version rejected");
  res.json(RejectResumeVersionResponse.parse(row));
});

router.get("/resume-versions/:id/export", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = GetResumeVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  
  const [row] = await db
    .select()
    .from(resumeVersionsTable)
    .where(and(eq(resumeVersionsTable.id, params.data.id), eq(resumeVersionsTable.userId, userId)));
    
  if (!row) {
    res.status(404).json({ error: "Resume version not found" });
    return;
  }

  try {
    const buffer = await generateResumeDocx(row);
    
    res.setHeader("Content-Disposition", `attachment; filename="resume_${row.id}.docx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.send(buffer);
  } catch (error) {
    req.log.error({ error }, "Failed to export resume DOCX");
    res.status(500).json({ error: "Failed to generate DOCX file" });
  }
});

export default router;
