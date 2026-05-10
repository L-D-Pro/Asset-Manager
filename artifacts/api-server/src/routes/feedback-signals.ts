import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, feedbackSignalsTable, applicationsTable, eventLogsTable, resumeVersionsTable, coverLetterVersionsTable, aiLearningConfigTable } from "@workspace/db";
import { runRecompute } from "../lib/learning-processor";
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

router.get("/feedback-signals", async (req, res): Promise<void> => {
  req.log.info("Listing feedback signals");
  const query = ListFeedbackSignalsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.applicationId != null) {
    conditions.push(eq(feedbackSignalsTable.applicationId, query.data.applicationId));
  }
  if (query.data.outcome != null) {
    conditions.push(eq(feedbackSignalsTable.outcome, query.data.outcome));
  }

  const rows = await db
    .select()
    .from(feedbackSignalsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(feedbackSignalsTable.createdAt);
  res.json(ListFeedbackSignalsResponse.parse(rows));
});

import { validateLineage, isCanonicalRunId } from "../lib/lineage";

router.post("/feedback-signals", async (req, res): Promise<void> => {
  const parsed = CreateFeedbackSignalBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid create feedback signal body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existingApp] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, parsed.data.applicationId));

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
    const [row] = await db.select({ runId: resumeVersionsTable.runId }).from(resumeVersionsTable).where(eq(resumeVersionsTable.id, parsed.data.resumeVersionId));
    runId = row?.runId ?? null;
  }

  // Note: coverLetterVersionId is not currently part of CreateFeedbackSignalBody.
  // Once added to the API schema, we can additionally source run_id from cover_letter_versions here.

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
      .where(eq(resumeVersionsTable.id, parsed.data.resumeVersionId));
    enrichment.selectedClaimIds = rv?.claimIds ?? [];
  }

  // 3. Query cover letter version claimIds (if coverLetterVersionId present in raw body)
  const coverLetterVersionId = (req.body as Record<string, unknown>)?.coverLetterVersionId as number | undefined;
  if (coverLetterVersionId) {
    const [clv] = await db
      .select({ claimIds: coverLetterVersionsTable.claimIds })
      .from(coverLetterVersionsTable)
      .where(eq(coverLetterVersionsTable.id, coverLetterVersionId));
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

  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(feedbackSignalsTable)
      .values({ ...parsed.data, runId, attributionData })
      .returning();

    if (newStatus && existingApp) {
      const previousStatus = existingApp.status;
      await tx
        .update(applicationsTable)
        .set({ status: newStatus })
        .where(eq(applicationsTable.id, parsed.data.applicationId));
      await tx.insert(eventLogsTable).values({
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

  if (newStatus && existingApp) {
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
        .where(sql`${feedbackSignalsTable.processedAt} IS NULL`);

      if (count >= (config.minSampleSize ?? 10)) {
        await runRecompute(db);
      }
    } catch (err) {
      console.error("Auto-recompute failed (non-blocking):", err);
    }
  });
});

router.get("/feedback-signals/:id", async (req, res): Promise<void> => {
  const params = GetFeedbackSignalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(feedbackSignalsTable)
    .where(eq(feedbackSignalsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Feedback signal not found" });
    return;
  }
  res.json(GetFeedbackSignalResponse.parse(row));
});

router.patch("/feedback-signals/:id", async (req, res): Promise<void> => {
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
    .where(eq(feedbackSignalsTable.id, params.data.id))
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
          .where(sql`${feedbackSignalsTable.processedAt} IS NULL`);

        if (count >= (config.minSampleSize ?? 10)) {
          await runRecompute(db);
        }
      } catch (err) {
        console.error("Auto-recompute failed (non-blocking):", err);
      }
    });
  }
});

router.delete("/feedback-signals/:id", async (req, res): Promise<void> => {
  const params = DeleteFeedbackSignalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(feedbackSignalsTable)
    .where(eq(feedbackSignalsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Feedback signal not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
