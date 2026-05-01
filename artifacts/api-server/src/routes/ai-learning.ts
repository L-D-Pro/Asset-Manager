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
  feedbackSignalsTable,
  aiModelConfigsTable,
  insertAiPromptVersionSchema,
  insertAiRunEvaluationSchema,
  insertAiTrainingExampleSchema,
  aiVariantStatsTable,
  aiVariantComparisonsTable,
  aiLearningConfigTable,
  updateAiLearningConfigSchema,
} from "@workspace/db";

import { aiMetricsSnapshotRouter } from "./ai-metrics-snapshot";
import { compareVariants, isWinner, confidence } from "../lib/bayesian-compare";
import { aggregateVariantStats } from "../lib/learning-aggregator";

const router: IRouter = Router();
const IdParams = z.object({ id: z.coerce.number().int().positive() });
const ListQuery = z.object({
  taskScope: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

router.use(aiMetricsSnapshotRouter);

router.get("/ai-review/overview", async (req: JobOpsRequest, res): Promise<void> => {
  const [recentAiEvents, evaluations, promptVersions, trainingExamples] =
    await Promise.all([
      db
        .select()
        .from(eventLogsTable)
        .where(eq(eventLogsTable.entityType, "ai_call"))
        .orderBy(desc(eventLogsTable.createdAt))
        .limit(25),
      db
        .select()
        .from(aiRunEvaluationsTable)
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
        .orderBy(desc(aiTrainingExamplesTable.createdAt))
        .limit(25),
    ]);

  awardXp(req.session.adminId!, "ai_visit", {}).catch(() => {});

  res.json({
    recentAiEvents,
    evaluations,
    promptVersions,
    trainingExamples,
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

router.post("/ai-prompt-versions", async (req, res): Promise<void> => {
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
        .where(eq(aiPromptVersionsTable.taskScope, parsed.data.taskScope));
    }
    return tx.insert(aiPromptVersionsTable).values(parsed.data).returning();
  });
  res.status(201).json(row);
});

router.patch("/ai-prompt-versions/:id", async (req, res): Promise<void> => {
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
        .where(eq(aiPromptVersionsTable.taskScope, taskScope));
    }
    return tx
      .update(aiPromptVersionsTable)
      .set(parsed.data)
      .where(eq(aiPromptVersionsTable.id, params.data.id))
      .returning();
  });
  res.json(row);
});

import { validateLineage, isCanonicalRunId } from "../lib/lineage";

router.get("/ai-run-evaluations", async (req, res): Promise<void> => {
  const query = z.object({ taskScope: z.string().optional() }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(aiRunEvaluationsTable)
    .where(
      query.data.taskScope
        ? eq(aiRunEvaluationsTable.taskScope, query.data.taskScope)
        : undefined,
    )
    .orderBy(desc(aiRunEvaluationsTable.createdAt));
  res.json(rows);
});

router.post("/ai-run-evaluations", async (req, res): Promise<void> => {
  const parsed = insertAiRunEvaluationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { runId, eventLogId, entityType, entityId } = parsed.data;

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

  const [row] = await db.insert(aiRunEvaluationsTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/ai-training-examples", async (req, res): Promise<void> => {
  const query = ListQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conditions = [];
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
  res.json(rows);
});

router.post("/ai-training-examples", async (req, res): Promise<void> => {
  const parsed = insertAiTrainingExampleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(aiTrainingExamplesTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.post("/ai-learning/recompute", async (_req, res): Promise<void> => {
  try {
    const result = await db.transaction(async (tx) => {
      const [config] = await tx
        .select()
        .from(aiLearningConfigTable)
        .limit(1);

      const thresholds = {
        confidence: parseFloat(config?.confidenceThreshold ?? "0.95"),
        minSampleSize: config?.minSampleSize ?? 10,
        minImprovementMargin: parseFloat(config?.minImprovementMargin ?? "0.05"),
      };

      const signals = await tx
        .select()
        .from(feedbackSignalsTable)
        .where(sql`${feedbackSignalsTable.processedAt} IS NULL`);

      const stats = aggregateVariantStats(signals);

      for (const stat of stats) {
        const [prompt] = await tx
          .select({ taskScope: aiPromptVersionsTable.taskScope })
          .from(aiPromptVersionsTable)
          .where(eq(aiPromptVersionsTable.id, stat.variantId));

        const taskScope = prompt?.taskScope;
        if (!taskScope) continue;

        await tx
          .insert(aiVariantStatsTable)
          .values({
            variantType: stat.variantType,
            variantId: stat.variantId,
            taskScope,
            successes: stat.successes,
            failures: stat.failures,
            pending: stat.pending,
            totalCostUsd: "0",
            avgCostPerApp: "0",
            lastComputedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              aiVariantStatsTable.variantType,
              aiVariantStatsTable.variantId,
              aiVariantStatsTable.taskScope,
            ],
            set: {
              successes: stat.successes,
              failures: stat.failures,
              pending: stat.pending,
              lastComputedAt: new Date(),
            },
          });
      }

      const allStats = await tx.select().from(aiVariantStatsTable);

      const byScope = new Map<string, typeof allStats>();
      for (const s of allStats) {
        if (!byScope.has(s.taskScope)) byScope.set(s.taskScope, []);
        byScope.get(s.taskScope)!.push(s);
      }

      for (const [scope, scopeStats] of byScope) {
        await tx
          .delete(aiVariantComparisonsTable)
          .where(eq(aiVariantComparisonsTable.taskScope, scope));

        for (let i = 0; i < scopeStats.length; i++) {
          for (let j = i + 1; j < scopeStats.length; j++) {
            const statA = scopeStats[i];
            const statB = scopeStats[j];

            const a = { successes: statA.successes, failures: statA.failures };
            const b = { successes: statB.successes, failures: statB.failures };

            const probA = compareVariants(a, b, 10000);
            const conf = Math.max(probA, 1 - probA);

            const rateA =
              a.successes + a.failures > 0
                ? a.successes / (a.successes + a.failures)
                : 0;
            const rateB =
              b.successes + b.failures > 0
                ? b.successes / (b.successes + b.failures)
                : 0;

            const aWins = isWinner(a, b, thresholds);
            const bWins = isWinner(b, a, thresholds);

            let status: string;
            if (aWins || bWins) {
              status = config?.autoPromoteEnabled
                ? "auto_promoted"
                : "suggested";
            } else {
              status = "pending";
            }

            const [variantAId, variantABig, variantAType, rateABig, sampleSizeABig] =
              statA.variantId < statB.variantId
                ? [statA.variantId, a, statA.variantType, rateA, a.successes + a.failures]
                : [statB.variantId, b, statB.variantType, rateB, b.successes + b.failures];
            const [variantBId, variantBBig, variantBType, rateBBig, sampleSizeBBig] =
              statA.variantId < statB.variantId
                ? [statB.variantId, b, statB.variantType, rateB, b.successes + b.failures]
                : [statA.variantId, a, statA.variantType, rateA, a.successes + a.failures];

            const normalizedProbA =
              statA.variantId < statB.variantId ? probA : 1 - probA;

            const [inserted] = await tx.insert(aiVariantComparisonsTable).values({
              taskScope: scope,
              variantAId,
              variantAType,
              variantBId,
              variantBType,
              probabilityA: normalizedProbA.toString(),
              confidence: conf.toString(),
              successRateA: rateABig.toString(),
              successRateB: rateBBig.toString(),
              sampleSizeA: sampleSizeABig,
              sampleSizeB: sampleSizeBBig,
              status,
            }).returning();

            if (status === "auto_promoted" && inserted) {
              const probWinner = parseFloat(inserted.probabilityA);
              const winnerId = probWinner >= 0.5 ? inserted.variantAId : inserted.variantBId;
              const winnerType = probWinner >= 0.5 ? inserted.variantAType : inserted.variantBType;

              if (winnerType === "prompt") {
                await tx
                  .update(aiPromptVersionsTable)
                  .set({ isActive: false })
                  .where(eq(aiPromptVersionsTable.taskScope, scope));

                await tx
                  .update(aiPromptVersionsTable)
                  .set({ isActive: true })
                  .where(eq(aiPromptVersionsTable.id, winnerId));
              }

              await tx.insert(eventLogsTable).values({
                entityType: "ai_variant_comparison",
                entityId: inserted.id,
                eventType: "variant_promoted",
                previousState: "pending",
                nextState: "auto_promoted",
                metadata: {
                  winnerId,
                  winnerType,
                  taskScope: scope,
                  probabilityA: inserted.probabilityA,
                },
                actorType: "system",
              });
            }
          }
        }
      }

      if (signals.length > 0) {
        await tx
          .update(feedbackSignalsTable)
          .set({ processedAt: new Date() })
          .where(sql`${feedbackSignalsTable.processedAt} IS NULL`);
      }

      return { ok: true, statsCount: stats.length };
    });

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

router.put("/ai-learning/config", async (req, res): Promise<void> => {
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

export default router;
