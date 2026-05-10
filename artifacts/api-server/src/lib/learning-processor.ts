import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db as defaultDb,
  feedbackSignalsTable,
  aiPromptVersionsTable,
  aiVariantStatsTable,
  aiVariantComparisonsTable,
  aiLearningConfigTable,
  aiModelConfigsTable,
  eventLogsTable,
} from "@workspace/db";
import { compareVariants, isWinner } from "./bayesian-compare";
import { aggregateVariantStats } from "./learning-aggregator";
import { logger } from "./logger";
import { callAI } from "./ai-client";
import { updateBestPractices, type BestPracticeItem, loadOrCreateBestPractices } from "./best-practices";

/**
 * Run the full recompute pipeline: aggregate unprocessed feedback signals,
 * upsert per-variant stats, compute Bayesian pairwise comparisons, and
 * auto-promote winners when enabled.
 *
 * @param db - Optional Drizzle DB instance (uses global default if omitted).
 *             Can be the global singleton or a transaction-scoped client.
 */
export async function runRecompute(
  db: typeof defaultDb = defaultDb,
): Promise<{ ok: boolean; statsCount: number }> {
  const [config] = await db
    .select()
    .from(aiLearningConfigTable)
    .limit(1);

  const result = await db.transaction(async (tx) => {
    const thresholds = {
      confidence: parseFloat(config?.confidenceThreshold ?? "0.95"),
      minSampleSize: config?.minSampleSize ?? 10,
      minImprovementMargin: parseFloat(config?.minImprovementMargin ?? "0.05"),
    };

    const signals = await tx
      .select()
      .from(feedbackSignalsTable)
      .where(sql`${feedbackSignalsTable.processedAt} IS NULL`);

    const modelLookup = new Map<string, { modelConfigId: number | null; taskScope: string | null }>();
    for (const signal of signals) {
      if (!signal.modelName) continue;
      const meta = (signal.attributionData as Record<string, unknown> | null) ?? {};
      const metaScope = typeof meta.taskScope === "string" ? meta.taskScope : null;
      const key = `${metaScope ?? ""}::${signal.modelName}`;
      if (modelLookup.has(key)) continue;

      const configured = metaScope
        ? await tx
            .select({ id: aiModelConfigsTable.id, taskScope: aiModelConfigsTable.taskScope })
            .from(aiModelConfigsTable)
            .where(and(eq(aiModelConfigsTable.modelName, signal.modelName), eq(aiModelConfigsTable.taskScope, metaScope)))
            .orderBy(aiModelConfigsTable.priority)
            .limit(1)
        : await tx
            .select({ id: aiModelConfigsTable.id, taskScope: aiModelConfigsTable.taskScope })
            .from(aiModelConfigsTable)
            .where(eq(aiModelConfigsTable.modelName, signal.modelName))
            .orderBy(aiModelConfigsTable.priority)
            .limit(1);

      modelLookup.set(key, {
        modelConfigId: configured[0]?.id ?? null,
        taskScope: configured[0]?.taskScope ?? metaScope,
      });
    }

    const normalizedSignals = signals.map((signal) => {
      const meta = (signal.attributionData as Record<string, unknown> | null) ?? {};
      const metaScope = typeof meta.taskScope === "string" ? meta.taskScope : null;
      const key = `${metaScope ?? ""}::${signal.modelName ?? ""}`;
      const modelResolved = signal.modelName ? modelLookup.get(key) : undefined;
      return {
        ...signal,
        taskScope: modelResolved?.taskScope ?? metaScope,
        modelConfigId: modelResolved?.modelConfigId ?? null,
      };
    });

    const stats = aggregateVariantStats(normalizedSignals);
    const signalIds = signals.map((s) => s.id);

    for (const stat of stats) {
      // Resolve taskScope from prompt version for prompt variants
      let taskScope: string | undefined;
      if (stat.variantType === "prompt") {
        const [prompt] = await tx
          .select({ taskScope: aiPromptVersionsTable.taskScope })
          .from(aiPromptVersionsTable)
          .where(eq(aiPromptVersionsTable.id, stat.variantId));
        taskScope = prompt?.taskScope;
      } else if (stat.variantType === "model") {
        taskScope = stat.taskScope ?? undefined;
      }

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
      const groupKey = `${s.taskScope}::${s.variantType}`;
      if (!byScope.has(groupKey)) byScope.set(groupKey, []);
      byScope.get(groupKey)!.push(s);
    }

    for (const [groupKey, groupStats] of byScope) {
      const lastColon = groupKey.lastIndexOf("::");
      const scope = groupKey.slice(0, lastColon);
      const variantType = groupKey.slice(lastColon + 2);

      await tx
        .delete(aiVariantComparisonsTable)
        .where(
          and(
            eq(aiVariantComparisonsTable.taskScope, scope),
            eq(aiVariantComparisonsTable.variantAType, variantType),
          ),
        );

      for (let i = 0; i < groupStats.length; i++) {
        for (let j = i + 1; j < groupStats.length; j++) {
          const statA = groupStats[i];
          const statB = groupStats[j];

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

          const [inserted] = await tx
            .insert(aiVariantComparisonsTable)
            .values({
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
            })
            .returning();

          if (status === "auto_promoted" && inserted) {
            const probWinner = parseFloat(inserted.probabilityA);
            const winnerId =
              probWinner >= 0.5 ? inserted.variantAId : inserted.variantBId;
            const winnerType =
              probWinner >= 0.5 ? inserted.variantAType : inserted.variantBType;

            if (winnerType === "prompt") {
              await tx
                .update(aiPromptVersionsTable)
                .set({ isActive: false })
                .where(eq(aiPromptVersionsTable.taskScope, scope));

              await tx
                .update(aiPromptVersionsTable)
                .set({ isActive: true })
                .where(eq(aiPromptVersionsTable.id, winnerId));
            } else if (winnerType === "model") {
              await tx
                .update(aiModelConfigsTable)
                .set({ isActive: false, priority: 1 })
                .where(eq(aiModelConfigsTable.taskScope, scope));

              await tx
                .update(aiModelConfigsTable)
                .set({ isActive: true, priority: 0 })
                .where(eq(aiModelConfigsTable.id, winnerId));
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

    if (signalIds.length > 0) {
      await tx
        .update(feedbackSignalsTable)
        .set({ processedAt: new Date() })
        .where(inArray(feedbackSignalsTable.id, signalIds));
    }

    return { ok: true, statsCount: stats.length };
  });

  // Auto-suggest best practices from feedback patterns (outside transaction)
  if (config?.autoTrainSuggestEnabled) {
    await suggestBestPracticesFromSignalPatterns();
  }

  return result;
}

/**
 * Check whether auto-recompute is enabled for the current deployment.
 * Task 2.3 will add a DB column for this; for now use an env var.
 */
export function isAutoRecomputeEnabled(): boolean {
  return process.env.AUTO_RECOMPUTE_ENABLED !== "false";
}

/**
 * Analyze recent feedback signals and auto-suggest best practices when rejection patterns are detected.
 * Only triggers when rejection rate exceeds 30% in the last 20 signals.
 *
 * @param db - Drizzle DB instance or transaction (uses global default if omitted).
 * @returns Number of best practices suggested (0 or 1 per call).
 */
export async function suggestBestPracticesFromSignalPatterns(
  db: typeof defaultDb = defaultDb,
): Promise<{ suggested: number }> {
  const signals = await db
    .select({
      id: feedbackSignalsTable.id,
      outcome: feedbackSignalsTable.outcome,
      attributionData: feedbackSignalsTable.attributionData,
    })
    .from(feedbackSignalsTable)
    .orderBy(sql`${feedbackSignalsTable.id} DESC`)
    .limit(200);

  const domain = "general";
  const rejectionOutcomes = new Set(["rejected", "ghosted", "no_response"]);

  const recentSignals = signals.slice(0, 20);
  const rejectionCount = recentSignals.filter((s) => rejectionOutcomes.has(s.outcome)).length;
  const rejectionRate = recentSignals.length > 0 ? rejectionCount / recentSignals.length : 0;

  if (rejectionRate <= 0.30 || recentSignals.length < 10) {
    return { suggested: 0 };
  }

  const outcomeSummary = recentSignals.map((s) => `- Outcome: ${s.outcome}`).join("\n");

  try {
    const result = await callAI({
      taskType: "best_practice_drafting",
      systemPrompt: `You analyze feedback patterns from job application outcomes and suggest best-practice rules to improve AI outputs. Output ONLY valid JSON: { "description": "string", "rationale": "string" }`,
      userPrompt: `Recent feedback signals (${recentSignals.length} total, rejection rate: ${(rejectionRate * 100).toFixed(0)}%):\n${outcomeSummary}\n\nSuggest ONE concrete best-practice rule that would reduce this rejection rate.`,
    });

    const suggestion = JSON.parse(result.content) as { description: string; rationale: string };

    const config = await loadOrCreateBestPractices(domain);

    const exists = config.items.some(
      (item) => item.description.toLowerCase() === suggestion.description.toLowerCase(),
    );
    if (exists) return { suggested: 0 };

    const newItem: BestPracticeItem = {
      description: suggestion.description,
      source: "ai",
      rationale: suggestion.rationale,
      frequency: rejectionCount,
    };

    const updatedItems = [...config.items, newItem];
    await updateBestPractices(domain, updatedItems);

    return { suggested: 1 };
  } catch (err) {
    logger.error({ err }, "Failed to suggest best practice");
    return { suggested: 0 };
  }
}
