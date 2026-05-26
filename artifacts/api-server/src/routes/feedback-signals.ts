import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, feedbackSignalsTable, applicationsTable, eventLogsTable, resumeVersionsTable, coverLetterVersionsTable, aiLearningConfigTable, jobsTable, roleProfilesTable, baseResumeVersionsTable } from "@workspace/db";
import { runRecompute } from "../lib/learning-processor";
import type { JobOpsRequest } from "../lib/http-types";
import { currentUserId } from "../lib/ownership";
import {
  ListFeedbackSignalsQueryParams,
  ListFeedbackSignalsResponse,
  CreateFeedbackSignalBody,
  GetFeedbackSignalParams,
  GetFeedbackSignalResponse,
  UpdateFeedbackSignalParams,
  UpdateFeedbackSignalBody,
  UpdateFeedbackSignalResponse,
  DeleteFeedbackSignalParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/feedback-signals", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  req.log.info("Listing feedback signals");
  const query = ListFeedbackSignalsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [eq(feedbackSignalsTable.userId, userId)];
  if (query.data.applicationId != null) {
    conditions.push(eq(feedbackSignalsTable.applicationId, query.data.applicationId));
  }
  if (query.data.outcome != null) {
    conditions.push(eq(feedbackSignalsTable.outcome, query.data.outcome));
  }

  const rows = await db
    .select()
    .from(feedbackSignalsTable)
    .where(and(...conditions))
    .orderBy(feedbackSignalsTable.createdAt);
  res.json(ListFeedbackSignalsResponse.parse(rows));
});

import { validateLineage, isCanonicalRunId } from "../lib/lineage";

router.post("/feedback-signals", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const parsed = CreateFeedbackSignalBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid create feedback signal body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existingApp] = await db
    .select()
    .from(applicationsTable)
    .where(and(eq(applicationsTable.id, parsed.data.applicationId), eq(applicationsTable.userId, userId)));
  if (!existingApp) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  if (parsed.data.jobId != null) {
    const [job] = await db.select({ id: jobsTable.id }).from(jobsTable)
      .where(and(eq(jobsTable.id, parsed.data.jobId), eq(jobsTable.userId, userId)));
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
  }
  if (parsed.data.roleProfileId != null) {
    const [profile] = await db.select({ id: roleProfilesTable.id }).from(roleProfilesTable)
      .where(and(eq(roleProfilesTable.id, parsed.data.roleProfileId), eq(roleProfilesTable.userId, userId)));
    if (!profile) {
      res.status(404).json({ error: "Role profile not found" });
      return;
    }
  }
  if (parsed.data.baseResumeVersionId != null) {
    const [resume] = await db.select({ id: baseResumeVersionsTable.id }).from(baseResumeVersionsTable)
      .where(and(eq(baseResumeVersionsTable.id, parsed.data.baseResumeVersionId), eq(baseResumeVersionsTable.userId, userId)));
    if (!resume) {
      res.status(404).json({ error: "Base resume version not found" });
      return;
    }
  }

  const outcomesToStatus: Record<string, string> = {
    rejected: "rejected",
    offer: "offer_received",
    hired: "hired",
    ghosted: "ghosted",
  };
  const newStatus = outcomesToStatus[parsed.data.outcome];

  // Ensure we have a valid run_id 
  let runId: string | null = null;
  if (parsed.data.resumeVersionId) {
    const [row] = await db.select({ runId: resumeVersionsTable.runId }).from(resumeVersionsTable).where(and(eq(resumeVersionsTable.id, parsed.data.resumeVersionId), eq(resumeVersionsTable.userId, userId)));
    if (!row) {
      res.status(404).json({ error: "Resume version not found" });
      return;
    }
    runId = row?.runId ?? null;
  }

  if (!runId && parsed.data.coverLetterVersionId) {
    const [row] = await db
      .select({ runId: coverLetterVersionsTable.runId })
      .from(coverLetterVersionsTable)
      .where(and(eq(coverLetterVersionsTable.id, parsed.data.coverLetterVersionId), eq(coverLetterVersionsTable.userId, userId)));
    if (!row) {
      res.status(404).json({ error: "Cover letter version not found" });
      return;
    }
    runId = row?.runId ?? null;
  }

  // Validate lineage before allowing feedback insert
  if (!runId || !isCanonicalRunId(runId)) {
    res.status(422).json({
      error: "Lineage validation failed",
      details: {
        reasons: ["Missing or invalid run_id"],
      },
    });
    return;
  }

  const lineageValidation = await validateLineage({
    table: "feedback_signals",
    runId,
    applicationId: parsed.data.applicationId,
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

  // Enrich attributionData with AI call metadata resolved from the lineage chain
  const enrichment: {
    promptVersionId?: number;
    modelName?: string;
    taskScope?: string;
    selectedClaimIds?: number[];
  } = {};

  // 1. Query the AI call event log for this run
  const [aiCallLog] = await db
    .select({ metadata: eventLogsTable.metadata })
    .from(eventLogsTable)
    .where(
      and(
        eq(eventLogsTable.runId, runId),
        eq(eventLogsTable.userId, userId),
        eq(eventLogsTable.entityType, "ai_call"),
        eq(eventLogsTable.eventType, "ai_call"),
      ),
    )
    .orderBy(desc(eventLogsTable.id))
    .limit(1);

  if (aiCallLog) {
    const meta = aiCallLog.metadata as Record<string, unknown>;
    enrichment.modelName = meta.modelName as string | undefined;
    enrichment.taskScope = meta.taskType as string | undefined;
    enrichment.promptVersionId = meta.promptVersionId as number | undefined;
  }

  // 2. Query resume version claimIds
  if (parsed.data.resumeVersionId) {
    const [rv] = await db
      .select({ claimIds: resumeVersionsTable.claimIds })
      .from(resumeVersionsTable)
      .where(and(eq(resumeVersionsTable.id, parsed.data.resumeVersionId), eq(resumeVersionsTable.userId, userId)));
    enrichment.selectedClaimIds = rv?.claimIds ?? [];
  }

  // 3. Query cover letter version claimIds (if coverLetterVersionId present in raw body)
  const coverLetterVersionId = parsed.data.coverLetterVersionId ?? undefined;
  if (coverLetterVersionId) {
    const [clv] = await db
      .select({ claimIds: coverLetterVersionsTable.claimIds })
      .from(coverLetterVersionsTable)
      .where(and(eq(coverLetterVersionsTable.id, coverLetterVersionId), eq(coverLetterVersionsTable.userId, userId)));
    if (clv?.claimIds?.length) {
      const merged = new Set([...(enrichment.selectedClaimIds ?? []), ...clv.claimIds]);
      enrichment.selectedClaimIds = Array.from(merged);
    }
  }

  // Build the enriched attributionData from collected metadata
  const attributionData: Record<string, unknown> = {
    ...(parsed.data.attributionData as Record<string, unknown> ?? {}),
    resumeVersionId: parsed.data.resumeVersionId ?? null,
  };
  if (enrichment.promptVersionId != null) attributionData.promptVersionId = enrichment.promptVersionId;
  if (enrichment.modelName) attributionData.modelName = enrichment.modelName;
  if (enrichment.taskScope) attributionData.taskScope = enrichment.taskScope;
  if (enrichment.selectedClaimIds?.length) attributionData.selectedClaimIds = enrichment.selectedClaimIds;

  const topLevelPromptVersionId = parsed.data.promptVersionId ?? enrichment.promptVersionId ?? null;
  const topLevelModelName = parsed.data.modelName ?? enrichment.modelName ?? null;
  const topLevelClaimIds = parsed.data.selectedClaimIds?.length
    ? parsed.data.selectedClaimIds
    : (enrichment.selectedClaimIds ?? []);
  const topLevelJobId = parsed.data.jobId ?? existingApp.jobId ?? null;

  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(feedbackSignalsTable)
      .values({
        userId,
        ...parsed.data,
        runId,
        jobId: topLevelJobId,
        roleProfileId: parsed.data.roleProfileId ?? null,
        baseResumeVersionId: parsed.data.baseResumeVersionId ?? null,
        coverLetterVersionId: parsed.data.coverLetterVersionId ?? null,
        promptVersionId: topLevelPromptVersionId,
        modelName: topLevelModelName,
        selectedClaimIds: topLevelClaimIds,
        finalResult: parsed.data.finalResult ?? null,
        attributionData,
      })
      .returning();

    if (newStatus) {
      const previousStatus = existingApp.status;
      await tx
        .update(applicationsTable)
        .set({ status: newStatus })
        .where(and(eq(applicationsTable.id, parsed.data.applicationId), eq(applicationsTable.userId, userId)));
      await tx.insert(eventLogsTable).values({
        userId,
        entityType: "application",
        entityId: parsed.data.applicationId,
        applicationId: parsed.data.applicationId,
        jobId: existingApp.jobId,
        eventType: "status_transition",
        previousState: previousStatus,
        nextState: newStatus,
        actorType: "system",
        runId,
        metadata: {
          triggeredBy: "feedback_signal",
          feedbackSignalId: inserted.id,
          outcome: parsed.data.outcome,
          signalType: parsed.data.signalType,
        },
      });
    }
    return inserted;
  });

  if (newStatus) {
    req.log.info(
      {
        applicationId: parsed.data.applicationId,
        outcome: parsed.data.outcome,
        from: existingApp.status,
        to: newStatus,
      },
      "Application status updated from feedback signal; EventLog written atomically",
    );
  }

  res.status(201).json(GetFeedbackSignalResponse.parse(row));

  // Auto-recompute check (fire-and-forget)
  setImmediate(async () => {
    try {
      const [config] = await db
        .select({
          autoRecomputeEnabled: aiLearningConfigTable.autoRecomputeEnabled,
          minSampleSize: aiLearningConfigTable.minSampleSize,
        })
        .from(aiLearningConfigTable)
        .limit(1);

      if (!config?.autoRecomputeEnabled) return;

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(feedbackSignalsTable)
        .where(and(eq(feedbackSignalsTable.userId, userId), sql`${feedbackSignalsTable.processedAt} IS NULL`));

      if (count >= (config.minSampleSize ?? 10)) {
        await runRecompute(db);
      }
    } catch (err) {
      console.error("Auto-recompute failed (non-blocking):", err);
    }
  });
});

router.get("/feedback-signals/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = GetFeedbackSignalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(feedbackSignalsTable)
    .where(and(eq(feedbackSignalsTable.id, params.data.id), eq(feedbackSignalsTable.userId, userId)));
  if (!row) {
    res.status(404).json({ error: "Feedback signal not found" });
    return;
  }
  res.json(GetFeedbackSignalResponse.parse(row));
});

router.patch("/feedback-signals/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = UpdateFeedbackSignalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateFeedbackSignalBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid update feedback signal body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(feedbackSignalsTable)
    .set(parsed.data)
    .where(and(eq(feedbackSignalsTable.id, params.data.id), eq(feedbackSignalsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Feedback signal not found" });
    return;
  }
  res.json(UpdateFeedbackSignalResponse.parse(row));

  // Auto-recompute if outcome changed
  if (parsed.data.outcome) {
    setImmediate(async () => {
      try {
        const [config] = await db
          .select({
            autoRecomputeEnabled: aiLearningConfigTable.autoRecomputeEnabled,
            minSampleSize: aiLearningConfigTable.minSampleSize,
          })
          .from(aiLearningConfigTable)
          .limit(1);

        if (!config?.autoRecomputeEnabled) return;

        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(feedbackSignalsTable)
          .where(and(eq(feedbackSignalsTable.userId, userId), sql`${feedbackSignalsTable.processedAt} IS NULL`));

        if (count >= (config.minSampleSize ?? 10)) {
          await runRecompute(db);
        }
      } catch (err) {
        console.error("Auto-recompute failed (non-blocking):", err);
      }
    });
  }
});

router.delete("/feedback-signals/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = DeleteFeedbackSignalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(feedbackSignalsTable)
    .where(and(eq(feedbackSignalsTable.id, params.data.id), eq(feedbackSignalsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Feedback signal not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
