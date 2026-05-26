import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, coverLetterVersionsTable, eventLogsTable, aiRunEvaluationsTable, aiTrainingExamplesTable } from "@workspace/db";
import {
  ListCoverLetterVersionsQueryParams,
  ListCoverLetterVersionsResponse,
  GetCoverLetterVersionParams,
  GetCoverLetterVersionResponse,
  UpdateCoverLetterVersionParams,
  UpdateCoverLetterVersionBody,
  UpdateCoverLetterVersionResponse,
  DeleteCoverLetterVersionParams,
  ApproveCoverLetterVersionParams,
  ApproveCoverLetterVersionBody,
  ApproveCoverLetterVersionResponse,
  RejectCoverLetterVersionParams,
  RejectCoverLetterVersionBody,
  RejectCoverLetterVersionResponse,
} from "@workspace/api-zod";
import { validateLineage } from "../lib/lineage";
import { generateCoverLetterDocx } from "../lib/docx-export";
import { scrubWizardStateReferences } from "../lib/wizard-state-cleanup";
import type { JobOpsRequest } from "../lib/http-types";
import { currentUserId } from "../lib/ownership";

const router: IRouter = Router();

router.get("/cover-letter-versions", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  req.log.info("Listing cover letter versions");
  const query = ListCoverLetterVersionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [eq(coverLetterVersionsTable.userId, userId)];
  if (query.data.jobId != null) {
    conditions.push(eq(coverLetterVersionsTable.jobId, query.data.jobId));
  }
  if (query.data.status != null) {
    conditions.push(eq(coverLetterVersionsTable.status, query.data.status));
  }

  const rows = await db
    .select()
    .from(coverLetterVersionsTable)
    .where(and(...conditions))
    .orderBy(coverLetterVersionsTable.createdAt);
  res.json(ListCoverLetterVersionsResponse.parse(rows));
});

router.get("/cover-letter-versions/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = GetCoverLetterVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(coverLetterVersionsTable)
    .where(and(eq(coverLetterVersionsTable.id, params.data.id), eq(coverLetterVersionsTable.userId, userId)));
  if (!row) {
    res.status(404).json({ error: "Cover letter version not found" });
    return;
  }
  res.json(GetCoverLetterVersionResponse.parse(row));
});

router.patch("/cover-letter-versions/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = UpdateCoverLetterVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCoverLetterVersionBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid update cover letter body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(coverLetterVersionsTable)
    .set(parsed.data)
    .where(and(eq(coverLetterVersionsTable.id, params.data.id), eq(coverLetterVersionsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Cover letter version not found" });
    return;
  }
  res.json(UpdateCoverLetterVersionResponse.parse(row));
});

router.delete("/cover-letter-versions/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = DeleteCoverLetterVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(coverLetterVersionsTable)
    .where(and(eq(coverLetterVersionsTable.id, params.data.id), eq(coverLetterVersionsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Cover letter version not found" });
    return;
  }
  await scrubWizardStateReferences({ userId, coverLetterVersionIds: [params.data.id] });
  res.sendStatus(204);
});

router.post("/cover-letter-versions/:id/approve", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = ApproveCoverLetterVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsedBody = ApproveCoverLetterVersionBody.safeParse(req.body);
  if (!parsedBody.success) {
    req.log.warn({ error: parsedBody.error.message }, "Invalid approve cover letter body");
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(coverLetterVersionsTable)
    .where(and(eq(coverLetterVersionsTable.id, params.data.id), eq(coverLetterVersionsTable.userId, userId)));
  if (!existing[0]) {
    res.status(404).json({ error: "Cover letter version not found" });
    return;
  }

  const coverLetterVersion = existing[0];
  const previousStatus = coverLetterVersion.status;

  if (previousStatus !== "pending_approval") {
    res.status(409).json({
      error: `Cannot approve a cover letter version in status "${previousStatus}". Only "pending_approval" versions can be approved.`,
    });
    return;
  }

  // Only validate lineage when runId is present — versions created
  // via error paths or manual creation may not have lineage data
  if (coverLetterVersion.runId) {
    const lineageValidation = await validateLineage({
      table: "cover_letter_versions",
      id: coverLetterVersion.id,
      runId: coverLetterVersion.runId,
      eventLogId: coverLetterVersion.eventLogId,
      entityType: "cover_letter_version",
      entityId: coverLetterVersion.id,
      jobId: coverLetterVersion.jobId,
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
      .update(coverLetterVersionsTable)
      .set({ status: "approved" })
      .where(and(eq(coverLetterVersionsTable.id, params.data.id), eq(coverLetterVersionsTable.userId, userId)))
      .returning();

    const [eventLog] = await tx
      .insert(eventLogsTable)
      .values({
        userId,
        entityType: "cover_letter_version",
        entityId: params.data.id,
        jobId: existing[0]!.jobId ?? null,
        applicationId: null,
        eventType: "approval",
        previousState: previousStatus,
        nextState: "approved",
        actorType: "user",
        runId: coverLetterVersion.runId,
        metadata: { coverLetterVersionId: params.data.id },
      })
      .returning({ id: eventLogsTable.id });

    await tx
      .insert(aiRunEvaluationsTable)
      .values({
        userId,
        runId: coverLetterVersion.runId,
        taskScope: "cover_letter_review",
        entityType: "cover_letter_version",
        entityId: coverLetterVersion.id,
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
  if (row.runId && row.draftContent) {
    db.insert(aiTrainingExamplesTable)
      .values({
        userId,
        taskScope: "cover_letter",
        sourceEntityType: "cover_letter_version",
        sourceEntityId: row.id,
        inputSnapshot: {
          jobId: row.jobId,
          claimIds: row.claimIds,
        },
        approvedOutput: row.draftContent,
        notes: `Auto-promoted from approved cover letter version ${row.id}`,
        qualityScore: 80,
        isActive: true,
        metadata: { runId: row.runId },
      })
      .catch((trainErr: unknown) =>
        req.log.warn({ trainErr }, "Failed to promote cover letter version to training examples — non-fatal"),
      );
  }

  req.log.info({ id: params.data.id }, "Cover letter version approved");
  res.json(ApproveCoverLetterVersionResponse.parse(row));
});

router.post("/cover-letter-versions/:id/reject", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = RejectCoverLetterVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsedBody = RejectCoverLetterVersionBody.safeParse(req.body);
  if (!parsedBody.success) {
    req.log.warn({ error: parsedBody.error.message }, "Invalid reject cover letter body");
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(coverLetterVersionsTable)
    .where(and(eq(coverLetterVersionsTable.id, params.data.id), eq(coverLetterVersionsTable.userId, userId)));
  if (!existing[0]) {
    res.status(404).json({ error: "Cover letter version not found" });
    return;
  }

  const coverLetterVersion = existing[0];
  const previousStatus = coverLetterVersion.status;

  if (previousStatus !== "pending_approval") {
    res.status(409).json({
      error: `Cannot reject a cover letter version in status "${previousStatus}". Only "pending_approval" versions can be rejected.`,
    });
    return;
  }

  // Only validate lineage when runId is present — versions created
  // via error paths or manual creation may not have lineage data
  if (coverLetterVersion.runId) {
    const lineageValidation = await validateLineage({
      table: "cover_letter_versions",
      id: coverLetterVersion.id,
      runId: coverLetterVersion.runId,
      eventLogId: coverLetterVersion.eventLogId,
      entityType: "cover_letter_version",
      entityId: coverLetterVersion.id,
      jobId: coverLetterVersion.jobId,
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
      .update(coverLetterVersionsTable)
      .set({ status: "rejected" })
      .where(and(eq(coverLetterVersionsTable.id, params.data.id), eq(coverLetterVersionsTable.userId, userId)))
      .returning();

    const [eventLog] = await tx
      .insert(eventLogsTable)
      .values({
        userId,
        entityType: "cover_letter_version",
        entityId: params.data.id,
        jobId: existing[0]!.jobId ?? null,
        applicationId: null,
        eventType: "rejection",
        previousState: previousStatus,
        nextState: "rejected",
        actorType: "user",
        runId: coverLetterVersion.runId,
        metadata: { coverLetterVersionId: params.data.id },
      })
      .returning({ id: eventLogsTable.id });

    await tx
      .insert(aiRunEvaluationsTable)
      .values({
        userId,
        runId: coverLetterVersion.runId,
        taskScope: "cover_letter_review",
        entityType: "cover_letter_version",
        entityId: coverLetterVersion.id,
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

  req.log.info({ id: params.data.id }, "Cover letter version rejected");
  res.json(RejectCoverLetterVersionResponse.parse(row));
});

router.get("/cover-letter-versions/:id/export", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = GetCoverLetterVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  
  const [row] = await db
    .select()
    .from(coverLetterVersionsTable)
    .where(and(eq(coverLetterVersionsTable.id, params.data.id), eq(coverLetterVersionsTable.userId, userId)));
    
  if (!row) {
    res.status(404).json({ error: "Cover letter version not found" });
    return;
  }

  try {
    const buffer = await generateCoverLetterDocx(row);
    
    res.setHeader("Content-Disposition", `attachment; filename="cover_letter_${row.id}.docx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.send(buffer);
  } catch (error) {
    req.log.error({ error }, "Failed to export cover letter DOCX");
    res.status(500).json({ error: "Failed to generate DOCX file" });
  }
});

export default router;
