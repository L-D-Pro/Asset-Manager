import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { awardXp } from "../lib/gamification";
import type { JobOpsRequest } from "../lib/http-types";
import {
  db,
  aiPromptVersionsTable,
  aiRunEvaluationsTable,
  aiTrainingExamplesTable,
  eventLogsTable,
  aiModelConfigsTable,
  insertAiPromptVersionSchema,
  insertAiRunEvaluationSchema,
  insertAiTrainingExampleSchema,
  aiVariantStatsTable,
  aiVariantComparisonsTable,
  aiLearningConfigTable,
  updateAiLearningConfigSchema,
  feedbackSignalsTable,
  resumeVersionsTable,
  coverLetterVersionsTable,
  proposalVersionsTable,
} from "@workspace/db";

import { aiMetricsSnapshotRouter } from "./ai-metrics-snapshot";
import { runRecompute } from "../lib/learning-processor";
import { requireAdmin } from "../middlewares/admin";
import { currentUserId, withoutUserId, withoutUserIds } from "../lib/ownership";

const router: IRouter = Router();
const IdParams = z.object({ id: z.coerce.number().int().positive() });
const ListQuery = z.object({
  taskScope: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

router.use(aiMetricsSnapshotRouter);

async function ownsPersonalArtifact(
  userId: number,
  entityType: string | null | undefined,
  entityId: number | null | undefined,
): Promise<boolean | null> {
  if (entityId == null) return true;

  if (entityType === "resume_version") {
    const [row] = await db.select({ id: resumeVersionsTable.id }).from(resumeVersionsTable)
      .where(and(eq(resumeVersionsTable.id, entityId), eq(resumeVersionsTable.userId, userId)));
    return Boolean(row);
  }
  if (entityType === "cover_letter_version") {
    const [row] = await db.select({ id: coverLetterVersionsTable.id }).from(coverLetterVersionsTable)
      .where(and(eq(coverLetterVersionsTable.id, entityId), eq(coverLetterVersionsTable.userId, userId)));
    return Boolean(row);
  }
  if (entityType === "proposal_version") {
    const [row] = await db.select({ id: proposalVersionsTable.id }).from(proposalVersionsTable)
      .where(and(eq(proposalVersionsTable.id, entityId), eq(proposalVersionsTable.userId, userId)));
    return Boolean(row);
  }
  return null;
}

router.get("/ai-review/overview", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const [recentAiEvents, evaluations, promptVersions, trainingExamples] =
    await Promise.all([
      db
        .select()
        .from(eventLogsTable)
        .where(and(eq(eventLogsTable.entityType, "ai_call"), eq(eventLogsTable.userId, userId)))
        .orderBy(desc(eventLogsTable.createdAt))
        .limit(25),
      db
        .select()
        .from(aiRunEvaluationsTable)
        .where(eq(aiRunEvaluationsTable.userId, userId))
        .orderBy(desc(aiRunEvaluationsTable.createdAt))
        .limit(25),
      db
        .select()
        .from(aiPromptVersionsTable)
        .orderBy(desc(aiPromptVersionsTable.createdAt))
        .limit(25),
      db
        .select()
        .from(aiTrainingExamplesTable)
        .where(eq(aiTrainingExamplesTable.userId, userId))
        .orderBy(desc(aiTrainingExamplesTable.createdAt))
        .limit(25),
    ]);

  awardXp(req.session.adminId!, "ai_visit", {}).catch(() => {});

  res.json({
    recentAiEvents: withoutUserIds(recentAiEvents),
    evaluations: withoutUserIds(evaluations),
    promptVersions,
    trainingExamples: withoutUserIds(trainingExamples),
    stats: {
      recentAiEvents: recentAiEvents.length,
      evaluations: evaluations.length,
      activePromptVersions: promptVersions.filter((p) => p.isActive).length,
      trainingExamples: trainingExamples.length,
      failedAiEvents: recentAiEvents.filter((e) => e.eventType === "ai_call_failed").length,
    },
  });
});

router.get("/ai-prompt-versions", async (req, res): Promise<void> => {
  const query = ListQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.taskScope) {
    conditions.push(eq(aiPromptVersionsTable.taskScope, query.data.taskScope));
  }
  if (query.data.isActive != null) {
    conditions.push(eq(aiPromptVersionsTable.isActive, query.data.isActive));
  }

  const rows = await db
    .select()
    .from(aiPromptVersionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiPromptVersionsTable.createdAt));
  res.json(rows);
});

router.post("/ai-prompt-versions", requireAdmin, async (req, res): Promise<void> => {
  const parsed = insertAiPromptVersionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db.transaction(async (tx) => {
    if (parsed.data.isActive) {
      await tx
        .update(aiPromptVersionsTable)
        .set({ isActive: false })
        .where(
          and(
            eq(aiPromptVersionsTable.taskScope, parsed.data.taskScope),
            eq(aiPromptVersionsTable.label, parsed.data.label),
          ),
        );
    }
    return tx.insert(aiPromptVersionsTable).values(parsed.data).returning();
  });
  res.status(201).json(row);
});

router.patch("/ai-prompt-versions/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = IdParams.safeParse(req.params);
  const parsed = insertAiPromptVersionSchema.partial().safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.success ? parsed.error?.message : params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(aiPromptVersionsTable)
    .where(eq(aiPromptVersionsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "AI prompt version not found" });
    return;
  }

  const [row] = await db.transaction(async (tx) => {
    const taskScope = parsed.data.taskScope ?? existing.taskScope;
    if (parsed.data.isActive) {
      await tx
        .update(aiPromptVersionsTable)
        .set({ isActive: false })
        .where(
          and(
            eq(aiPromptVersionsTable.taskScope, taskScope),
            eq(aiPromptVersionsTable.label, existing.label),
          ),
        );
    }
    return tx
      .update(aiPromptVersionsTable)
      .set(parsed.data)
      .where(eq(aiPromptVersionsTable.id, params.data.id))
      .returning();
  });
  res.json(row);
});

router.delete("/ai-prompt-versions/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = IdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(aiPromptVersionsTable)
    .where(eq(aiPromptVersionsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "AI prompt version not found" });
    return;
  }
  res.sendStatus(204);
});

import { validateLineage, isCanonicalRunId } from "../lib/lineage";

router.get("/ai-run-evaluations", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const query = z.object({ taskScope: z.string().optional() }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(aiRunEvaluationsTable)
    .where(and(
      eq(aiRunEvaluationsTable.userId, userId),
      ...(query.data.taskScope ? [eq(aiRunEvaluationsTable.taskScope, query.data.taskScope)] : []),
    ))
    .orderBy(desc(aiRunEvaluationsTable.createdAt));
  res.json(withoutUserIds(rows));
});

router.post("/ai-run-evaluations", requireAdmin, async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const parsed = insertAiRunEvaluationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { runId, eventLogId, entityType, entityId } = parsed.data;

  if (eventLogId != null) {
    const [ownedEvent] = await db
      .select({ id: eventLogsTable.id })
      .from(eventLogsTable)
      .where(and(eq(eventLogsTable.id, eventLogId), eq(eventLogsTable.userId, userId)))
      .limit(1);
    if (!ownedEvent) {
      res.status(404).json({ error: "Lineage event not found" });
      return;
    }
  }

  const ownsEntity = await ownsPersonalArtifact(userId, entityType, entityId);
  if (ownsEntity === false) {
    res.status(404).json({ error: "Evaluated artifact not found" });
    return;
  }

  if (!isCanonicalRunId(runId)) {
    res.status(422).json({
      error: "Lineage validation failed",
      details: {
        reasons: ["Invalid or missing run_id"],
      },
    });
    return;
  }

  const lineageValidation = await validateLineage({
    table: "ai_run_evaluations",
    runId,
    eventLogId,
    entityType,
    entityId,
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

  const [row] = await db.insert(aiRunEvaluationsTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(withoutUserId(row!));
});

router.get("/ai-training-examples", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const query = ListQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conditions = [eq(aiTrainingExamplesTable.userId, userId)];
  if (query.data.taskScope) {
    conditions.push(eq(aiTrainingExamplesTable.taskScope, query.data.taskScope));
  }
  if (query.data.isActive != null) {
    conditions.push(eq(aiTrainingExamplesTable.isActive, query.data.isActive));
  }
  const rows = await db
    .select()
    .from(aiTrainingExamplesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiTrainingExamplesTable.createdAt));
  res.json(withoutUserIds(rows));
});

router.post("/ai-training-examples", requireAdmin, async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const parsed = insertAiTrainingExampleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.evaluationId != null) {
    const [evaluation] = await db
      .select({ id: aiRunEvaluationsTable.id })
      .from(aiRunEvaluationsTable)
      .where(and(eq(aiRunEvaluationsTable.id, parsed.data.evaluationId), eq(aiRunEvaluationsTable.userId, userId)))
      .limit(1);
    if (!evaluation) {
      res.status(404).json({ error: "Evaluation not found" });
      return;
    }
  }
  if (parsed.data.sourceEntityId != null) {
    const ownsSource = await ownsPersonalArtifact(userId, parsed.data.sourceEntityType, parsed.data.sourceEntityId);
    if (ownsSource == null) {
      res.status(400).json({ error: "Unsupported training example source entity type" });
      return;
    }
    if (!ownsSource) {
      res.status(404).json({ error: "Training source artifact not found" });
      return;
    }
  }
  const [row] = await db.insert(aiTrainingExamplesTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(withoutUserId(row!));
});

router.post("/ai-learning/recompute", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const result = await runRecompute(db);
    res.json(result);
  } catch (error) {
    console.error("Recompute failed:", error);
    res.status(500).json({ error: "Recompute failed" });
  }
});

router.get("/ai-learning/stats", async (req, res): Promise<void> => {
  const query = z.object({ taskScope: z.string().optional() }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(aiVariantStatsTable)
    .where(
      query.data.taskScope
        ? eq(aiVariantStatsTable.taskScope, query.data.taskScope)
        : undefined,
    )
    .orderBy(asc(aiVariantStatsTable.taskScope));

  const promptIds = rows
    .filter((r) => r.variantType === "prompt")
    .map((r) => r.variantId);
  const modelIds = rows
    .filter((r) => r.variantType === "model")
    .map((r) => r.variantId);

  const promptLabelMap = new Map<number, string>();
  const modelLabelMap = new Map<number, string>();

  if (promptIds.length > 0) {
    const prompts = await db
      .select({ id: aiPromptVersionsTable.id, label: aiPromptVersionsTable.label })
      .from(aiPromptVersionsTable)
      .where(inArray(aiPromptVersionsTable.id, promptIds));
    for (const p of prompts) promptLabelMap.set(p.id, p.label);
  }

  if (modelIds.length > 0) {
    const models = await db
      .select({
        id: aiModelConfigsTable.id,
        modelName: aiModelConfigsTable.modelName,
      })
      .from(aiModelConfigsTable)
      .where(inArray(aiModelConfigsTable.id, modelIds));
    for (const m of models) modelLabelMap.set(m.id, m.modelName);
  }

  const enriched = rows.map((r) => ({
    ...r,
    label:
      r.variantType === "prompt"
        ? promptLabelMap.get(r.variantId) ?? null
        : r.variantType === "model"
          ? modelLabelMap.get(r.variantId) ?? null
          : null,
  }));

  res.json(enriched);
});

router.get("/ai-learning/leaderboard", async (req, res): Promise<void> => {
  const rows = await db.select().from(aiVariantStatsTable);

  const promptIds = rows.filter((r) => r.variantType === "prompt").map((r) => r.variantId);
  const modelIds = rows.filter((r) => r.variantType === "model").map((r) => r.variantId);

  const promptLabelMap = new Map<number, string>();
  const modelLabelMap = new Map<number, string>();

  if (promptIds.length > 0) {
    const prompts = await db
      .select({ id: aiPromptVersionsTable.id, label: aiPromptVersionsTable.label })
      .from(aiPromptVersionsTable)
      .where(inArray(aiPromptVersionsTable.id, promptIds));
    for (const p of prompts) promptLabelMap.set(p.id, p.label);
  }
  if (modelIds.length > 0) {
    const models = await db
      .select({ id: aiModelConfigsTable.id, modelName: aiModelConfigsTable.modelName })
      .from(aiModelConfigsTable)
      .where(inArray(aiModelConfigsTable.id, modelIds));
    for (const m of models) modelLabelMap.set(m.id, m.modelName);
  }

  const ranked = rows
    .map((r) => {
      const total = r.successes + r.failures;
      const successRate = total > 0 ? r.successes / total : 0;
      return {
        ...r,
        successRate,
        label: r.variantType === "prompt"
          ? (promptLabelMap.get(r.variantId) ?? null)
          : (modelLabelMap.get(r.variantId) ?? null),
      };
    })
    .sort((a, b) => b.successRate - a.successRate)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  res.json(ranked);
});

router.get("/ai-learning/comparisons", async (req, res): Promise<void> => {
  const query = z
    .object({ taskScope: z.string().optional(), status: z.string().optional() })
    .safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.taskScope) {
    conditions.push(eq(aiVariantComparisonsTable.taskScope, query.data.taskScope));
  }
  if (query.data.status) {
    conditions.push(eq(aiVariantComparisonsTable.status, query.data.status));
  }

  const rows = await db
    .select()
    .from(aiVariantComparisonsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiVariantComparisonsTable.createdAt));
  res.json(rows);
});

async function promoteWinner(
  comparison: typeof aiVariantComparisonsTable.$inferSelect,
  actorType: "user" | "system",
): Promise<void> {
  await db.transaction(async (tx) => {
    const probA = parseFloat(comparison.probabilityA);
    const winnerId =
      probA >= 0.5 ? comparison.variantAId : comparison.variantBId;
    const winnerType =
      probA >= 0.5 ? comparison.variantAType : comparison.variantBType;

    if (winnerType === "prompt") {
      await tx
        .update(aiPromptVersionsTable)
        .set({ isActive: false })
        .where(eq(aiPromptVersionsTable.taskScope, comparison.taskScope));

      await tx
        .update(aiPromptVersionsTable)
        .set({ isActive: true })
        .where(eq(aiPromptVersionsTable.id, winnerId));
    } else if (winnerType === "model") {
      await tx
        .update(aiModelConfigsTable)
        .set({ isActive: false, priority: 1 })
        .where(eq(aiModelConfigsTable.taskScope, comparison.taskScope));

      await tx
        .update(aiModelConfigsTable)
        .set({ isActive: true, priority: 0 })
        .where(eq(aiModelConfigsTable.id, winnerId));
    }

    await tx
      .update(aiVariantComparisonsTable)
      .set({ status: "promoted", promotedAt: new Date() })
      .where(eq(aiVariantComparisonsTable.id, comparison.id));

    await tx.insert(eventLogsTable).values({
      entityType: "ai_variant_comparison",
      entityId: comparison.id,
      eventType: "variant_promoted",
      previousState: comparison.status,
      nextState: "promoted",
      metadata: {
        winnerId,
        winnerType,
        taskScope: comparison.taskScope,
        probabilityA: comparison.probabilityA,
      },
      actorType,
    });
  });
}

router.post(
  "/ai-learning/comparisons/:id/promote",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = IdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [comparison] = await db
      .select()
      .from(aiVariantComparisonsTable)
      .where(eq(aiVariantComparisonsTable.id, params.data.id));

    if (!comparison) {
      res.status(404).json({ error: "Comparison not found" });
      return;
    }

    if (comparison.status !== "suggested") {
      res
        .status(409)
        .json({ error: "Only suggested comparisons can be promoted" });
      return;
    }

    await promoteWinner(comparison, "user");

    res.json({ ok: true });
  },
);

router.post(
  "/ai-learning/comparisons/:id/revert",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = IdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [comparison] = await db
      .select()
      .from(aiVariantComparisonsTable)
      .where(eq(aiVariantComparisonsTable.id, params.data.id));

    if (!comparison) {
      res.status(404).json({ error: "Comparison not found" });
      return;
    }

    if (comparison.status !== "auto_promoted") {
      res
        .status(409)
        .json({ error: "Only auto-promoted comparisons can be reverted" });
      return;
    }

    await db.transaction(async (tx) => {
      const loserId =
        parseFloat(comparison.probabilityA) >= 0.5
          ? comparison.variantBId
          : comparison.variantAId;
      const loserType =
        parseFloat(comparison.probabilityA) >= 0.5
          ? comparison.variantBType
          : comparison.variantAType;

      if (loserType === "prompt") {
        await tx
          .update(aiPromptVersionsTable)
          .set({ isActive: false })
          .where(eq(aiPromptVersionsTable.taskScope, comparison.taskScope));

        await tx
          .update(aiPromptVersionsTable)
          .set({ isActive: true })
          .where(eq(aiPromptVersionsTable.id, loserId));
      } else if (loserType === "model") {
        await tx
          .update(aiModelConfigsTable)
          .set({ isActive: false, priority: 1 })
          .where(eq(aiModelConfigsTable.taskScope, comparison.taskScope));

        await tx
          .update(aiModelConfigsTable)
          .set({ isActive: true, priority: 0 })
          .where(eq(aiModelConfigsTable.id, loserId));
      }

      await tx
        .update(aiVariantComparisonsTable)
        .set({ status: "reverted", revertedAt: new Date() })
        .where(eq(aiVariantComparisonsTable.id, comparison.id));

      await tx.insert(eventLogsTable).values({
        entityType: "ai_variant_comparison",
        entityId: comparison.id,
        eventType: "variant_reverted",
        previousState: "auto_promoted",
        nextState: "reverted",
        metadata: {
          taskScope: comparison.taskScope,
          comparisonId: comparison.id,
        },
        actorType: "user",
      });
    });

    res.json({ ok: true });
  },
);

router.get("/ai-learning/config", async (_req, res): Promise<void> => {
  const [config] = await db.select().from(aiLearningConfigTable).limit(1);

  if (!config) {
    res.json(null);
    return;
  }

  res.json(config);
});

router.put("/ai-learning/config", requireAdmin, async (req, res): Promise<void> => {
  const parsed = updateAiLearningConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(aiLearningConfigTable).limit(1);

  if (existing) {
    const [updated] = await db
      .update(aiLearningConfigTable)
      .set(parsed.data)
      .where(eq(aiLearningConfigTable.id, existing.id))
      .returning();
    res.json(updated);
  } else {
    const [inserted] = await db
      .insert(aiLearningConfigTable)
      .values({
        autoPromoteEnabled: parsed.data.autoPromoteEnabled ?? false,
        confidenceThreshold: parsed.data.confidenceThreshold ?? "0.95",
        minSampleSize: parsed.data.minSampleSize ?? 10,
        minImprovementMargin: parsed.data.minImprovementMargin ?? "0.05",
        recomputeScheduleCron: parsed.data.recomputeScheduleCron ?? "0 2 * * *",
      })
      .returning();
    res.json(inserted);
  }
});

router.get("/ai-learning/outcome-stats", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const query = z.object({ taskScope: z.string().optional() }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(aiRunEvaluationsTable)
    .where(and(
      eq(aiRunEvaluationsTable.userId, userId),
      ...(query.data.taskScope ? [eq(aiRunEvaluationsTable.taskScope, query.data.taskScope)] : []),
    ))
    .orderBy(desc(aiRunEvaluationsTable.createdAt));

  const byScope = new Map<string, { approved: number; rejected: number; pending: number; avgTruthfulness: number; avgRelevance: number; total: number }>();

  for (const row of rows) {
    if (!byScope.has(row.taskScope)) {
      byScope.set(row.taskScope, { approved: 0, rejected: 0, pending: 0, avgTruthfulness: 0, avgRelevance: 0, total: 0 });
    }
    const stat = byScope.get(row.taskScope)!;
    stat.total++;
    if (row.approvalOutcome === "approved") stat.approved++;
    else if (row.approvalOutcome === "rejected") stat.rejected++;
    else stat.pending++;
    if (row.truthfulnessScore != null) stat.avgTruthfulness += row.truthfulnessScore;
    if (row.relevanceScore != null) stat.avgRelevance += row.relevanceScore;
  }

  const trainingCounts = await db
    .select()
    .from(aiTrainingExamplesTable)
    .where(and(eq(aiTrainingExamplesTable.userId, userId), eq(aiTrainingExamplesTable.isActive, true)));

  const trainingByScope = new Map<string, number>();
  for (const ex of trainingCounts) {
    trainingByScope.set(ex.taskScope, (trainingByScope.get(ex.taskScope) ?? 0) + 1);
  }

  const result = Array.from(byScope.entries()).map(([scope, stat]) => ({
    taskScope: scope,
    totalEvaluations: stat.total,
    approved: stat.approved,
    rejected: stat.rejected,
    pending: stat.pending,
    approvalRate: stat.total > 0 ? Math.round((stat.approved / stat.total) * 100) : 0,
    avgTruthfulnessScore: stat.total > 0 ? Math.round(stat.avgTruthfulness / stat.total) : null,
    avgRelevanceScore: stat.total > 0 ? Math.round(stat.avgRelevance / stat.total) : null,
    activeTrainingExamples: trainingByScope.get(scope) ?? 0,
  }));

  res.json(result);
});

router.get("/ai-learning/health", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  try {
    const [config] = await db.select().from(aiLearningConfigTable).limit(1);
    const [signalCount] = await db
      .select({ count: sql`count(*)::int` })
      .from(feedbackSignalsTable)
      .where(and(eq(feedbackSignalsTable.userId, userId), sql`${feedbackSignalsTable.processedAt} IS NULL`));
    const unprocessedSignalCount = Number(signalCount?.count ?? 0);
    const [statsCount] = await db
      .select({ count: sql`count(*)::int` })
      .from(aiVariantStatsTable);
    const totalVariantStats = Number(statsCount?.count ?? 0);
    const [compCount] = await db
      .select({ count: sql`count(*)::int` })
      .from(aiVariantComparisonsTable);
    const totalComparisons = Number(compCount?.count ?? 0);
    const [suggestedCount] = await db
      .select({ count: sql`count(*)::int` })
      .from(aiVariantComparisonsTable)
      .where(sql`${aiVariantComparisonsTable.status} = 'suggested'`);
    const suggestedComparisons = Number(suggestedCount?.count ?? 0);
    const [autoPromotedCount] = await db
      .select({ count: sql`count(*)::int` })
      .from(aiVariantComparisonsTable)
      .where(sql`${aiVariantComparisonsTable.status} = 'auto_promoted'`);
    const autoPromotedComparisons = Number(autoPromotedCount?.count ?? 0);

    let overallStatus: "healthy" | "warning" | "degraded" = "healthy";
    if (totalComparisons === 0 && unprocessedSignalCount === 0) {
      overallStatus = "warning";
    }
    if (unprocessedSignalCount > 50) {
      overallStatus = "degraded";
    }

    res.json({
      autoPromoteEnabled: config?.autoPromoteEnabled ?? false,
      confidenceThreshold: config?.confidenceThreshold ?? "0.95",
      minSampleSize: config?.minSampleSize ?? 10,
      minImprovementMargin: config?.minImprovementMargin ?? "0.05",
      recomputeScheduleCron: config?.recomputeScheduleCron ?? undefined,
      unprocessedSignalCount,
      totalVariantStats,
      totalComparisons,
      suggestedComparisons,
      autoPromotedComparisons,
      overallStatus,
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({ error: "Health check failed" });
  }
});

export default router;
