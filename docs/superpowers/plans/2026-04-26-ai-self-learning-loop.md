# AI Self-Learning Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Bayesian auto-optimizer that learns from application outcomes to improve AI prompt versions and model configurations, with automatic winner promotion and human revert override.

**Architecture:** Three new DB tables (variant_stats, variant_comparisons, learning_config), a Bayesian comparison engine, an aggregation engine, API endpoints on the existing ai-learning router, and a dashboard page at /ai-learning. Phase 1 suggests promotions; Phase 2 auto-promotes with revert.

**Tech Stack:** Drizzle ORM, Express 5, React + Vite, Vitest, shadcn/ui, Tailwind v4

**Spec:** `docs/superpowers/specs/2026-04-26-ai-self-learning-loop-design.md`

---

## Phase 1: Suggest Mode (Schema + Engine + API + Dashboard)

---

### Task 1: Create `ai_variant_stats` DB schema

**Files:**
- Create: `lib/db/src/schema/ai-variant-stats.ts`

- [ ] **Step 1: Write the schema file**

```typescript
import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiVariantStatsTable = pgTable(
  "ai_variant_stats",
  {
    id: serial("id").primaryKey(),
    variantType: text("variant_type").notNull(),
    variantId: integer("variant_id").notNull(),
    taskScope: text("task_scope").notNull(),
    successes: integer("successes").notNull().default(0),
    failures: integer("failures").notNull().default(0),
    pending: integer("pending").notNull().default(0),
    totalCostUsd: text("total_cost_usd").notNull().default("0"),
    avgCostPerApp: text("avg_cost_per_app").notNull().default("0"),
    lastComputedAt: timestamp("last_computed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("ai_variant_stats_unique_idx").on(
      table.variantType,
      table.variantId,
      table.taskScope,
    ),
  ],
);

export const insertAiVariantStatSchema = createInsertSchema(
  aiVariantStatsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertAiVariantStat = z.infer<typeof insertAiVariantStatSchema>;
export type AiVariantStat = typeof aiVariantStatsTable.$inferSelect;
```

- [ ] **Step 2: Verify the schema compiles**

Run: `corepack pnpm --filter @workspace/db run typecheck`

Expected: PASS — no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add lib/db/src/schema/ai-variant-stats.ts
git commit -m "feat(db): add ai_variant_stats table schema"
```

---

### Task 2: Create `ai_variant_comparisons` DB schema

**Files:**
- Create: `lib/db/src/schema/ai-variant-comparisons.ts`

- [ ] **Step 1: Write the schema file**

```typescript
import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiVariantComparisonsTable = pgTable(
  "ai_variant_comparisons",
  {
    id: serial("id").primaryKey(),
    taskScope: text("task_scope").notNull(),
    variantAId: integer("variant_a_id").notNull(),
    variantAType: text("variant_a_type").notNull(),
    variantBId: integer("variant_b_id").notNull(),
    variantBType: text("variant_b_type").notNull(),
    probabilityA: text("probability_a").notNull(),
    confidence: text("confidence").notNull(),
    successRateA: text("success_rate_a").notNull().default("0"),
    successRateB: text("success_rate_b").notNull().default("0"),
    sampleSizeA: integer("sample_size_a").notNull().default(0),
    sampleSizeB: integer("sample_size_b").notNull().default(0),
    status: text("status").notNull().default("pending"),
    promotedAt: timestamp("promoted_at", { withTimezone: true }),
    revertedAt: timestamp("reverted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ai_variant_comparisons_task_scope_idx").on(table.taskScope),
    index("ai_variant_comparisons_status_idx").on(table.status),
  ],
);

export const insertAiVariantComparisonSchema = createInsertSchema(
  aiVariantComparisonsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertAiVariantComparison = z.infer<
  typeof insertAiVariantComparisonSchema
>;
export type AiVariantComparison =
  typeof aiVariantComparisonsTable.$inferSelect;
```

- [ ] **Step 2: Verify typecheck**

Run: `corepack pnpm --filter @workspace/db run typecheck`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/db/src/schema/ai-variant-comparisons.ts
git commit -m "feat(db): add ai_variant_comparisons table schema"
```

---

### Task 3: Create `ai_learning_config` DB schema

**Files:**
- Create: `lib/db/src/schema/ai-learning-config.ts`

- [ ] **Step 1: Write the schema file**

```typescript
import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiLearningConfigTable = pgTable("ai_learning_config", {
  id: serial("id").primaryKey(),
  autoPromoteEnabled: boolean("auto_promote_enabled").notNull().default(false),
  confidenceThreshold: text("confidence_threshold").notNull().default("0.95"),
  minSampleSize: integer("min_sample_size").notNull().default(10),
  minImprovementMargin: text("min_improvement_margin").notNull().default("0.05"),
  recomputeScheduleCron: text("recompute_schedule_cron")
    .notNull()
    .default("0 2 * * *"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAiLearningConfigSchema = createInsertSchema(
  aiLearningConfigTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export const updateAiLearningConfigSchema = insertAiLearningConfigSchema
  .partial();

export type InsertAiLearningConfig = z.infer<
  typeof insertAiLearningConfigSchema
>;
export type UpdateAiLearningConfig = z.infer<
  typeof updateAiLearningConfigSchema
>;
export type AiLearningConfig = typeof aiLearningConfigTable.$inferSelect;
```

- [ ] **Step 2: Verify typecheck**

Run: `corepack pnpm --filter @workspace/db run typecheck`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/db/src/schema/ai-learning-config.ts
git commit -m "feat(db): add ai_learning_config table schema"
```

---

### Task 4: Export new schemas and push migration

**Files:**
- Modify: `lib/db/src/schema/index.ts`

- [ ] **Step 1: Add exports to schema index**

```typescript
// Append these lines after line 19 (export * from "./admin-users";)
export * from "./ai-variant-stats";
export * from "./ai-variant-comparisons";
export * from "./ai-learning-config";
```

Edit file `lib/db/src/schema/index.ts`: add the three new exports after the last existing export.

- [ ] **Step 2: Verify typecheck**

Run: `corepack pnpm --filter @workspace/db run typecheck`

Expected: PASS

- [ ] **Step 3: Push DB migration**

Run: `corepack pnpm --filter @workspace/db run push`

Expected: "No schema changes, nothing to migrate." or migration applied successfully without errors

- [ ] **Step 4: Commit**

```bash
git add lib/db/src/schema/index.ts
git commit -m "feat(db): export new ai variant and learning config schemas"
```

---

### Task 5: Bayesian comparison engine with tests

**Files:**
- Create: `artifacts/api-server/src/lib/bayesian-compare.ts`
- Create: `artifacts/api-server/src/lib/__tests__/bayesian-compare.test.ts`

- [ ] **Step 1: Write failing tests for Bayesian comparison**

```typescript
import { describe, expect, it } from "vitest";
import { compareVariants } from "../bayesian-compare";

describe("compareVariants", () => {
  it("returns high P(A > B) when A has many more successes", () => {
    // A: 10 successes, 1 failure → Beta(11, 2) centered near 0.85
    // B: 1 success, 10 failures → Beta(2, 11) centered near 0.15
    const p = compareVariants(
      { successes: 10, failures: 1 },
      { successes: 1, failures: 10 },
    );
    expect(p).toBeGreaterThan(0.95);
  });

  it("returns near 0.5 when variants have identical stats", () => {
    const p = compareVariants(
      { successes: 5, failures: 5 },
      { successes: 5, failures: 5 },
    );
    expect(p).toBeGreaterThan(0.4);
    expect(p).toBeLessThan(0.6);
  });

  it("returns low P(A > B) when A has many more failures", () => {
    const p = compareVariants(
      { successes: 1, failures: 10 },
      { successes: 10, failures: 1 },
    );
    expect(p).toBeLessThan(0.05);
  });

  it("handles zero successes and zero failures (uniform prior)", () => {
    const p = compareVariants(
      { successes: 0, failures: 0 },
      { successes: 10, failures: 1 },
    );
    expect(p).toBeLessThan(0.3);
  });

  it("returns near 0.5 with equal large samples", () => {
    const p = compareVariants(
      { successes: 50, failures: 50 },
      { successes: 50, failures: 50 },
    );
    expect(p).toBeGreaterThan(0.45);
    expect(p).toBeLessThan(0.55);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `corepack pnpm --filter @workspace/api-server run test -- --reporter=verbose src/lib/__tests__/bayesian-compare.test.ts`

Expected: 5 FAIL — function not defined

- [ ] **Step 3: Implement the Bayesian comparison engine**

```typescript
export interface VariantStats {
  successes: number;
  failures: number;
}

function normalRandom(): number {
  // Box-Muller transform
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

function sampleGamma(alpha: number, scale: number): number {
  if (alpha < 1) {
    const u = Math.random();
    return sampleGamma(alpha + 1, scale) * Math.pow(u, 1 / alpha);
  }

  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x: number;
    let v: number;
    do {
      x = normalRandom();
      v = Math.pow(1 + c * x, 3);
    } while (v <= 0);

    const u = Math.random();
    const x2 = x * x;

    if (
      u < 1 - 0.0331 * x2 * x2 ||
      Math.log(u) < 0.5 * x2 + d * (1 - v + Math.log(v))
    ) {
      return d * v * scale;
    }
  }
}

function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha, 1);
  const y = sampleGamma(beta, 1);
  return x / (x + y);
}

export function compareVariants(
  a: VariantStats,
  b: VariantStats,
  samples: number = 10000,
): number {
  const alphaA = a.successes + 1;
  const betaA = a.failures + 1;
  const alphaB = b.successes + 1;
  const betaB = b.failures + 1;

  let wins = 0;

  for (let i = 0; i < samples; i++) {
    const sampleA = sampleBeta(alphaA, betaA);
    const sampleB = sampleBeta(alphaB, betaB);
    if (sampleA > sampleB) wins++;
  }

  return wins / samples;
}

export function confidence(a: VariantStats, b: VariantStats): number {
  const p = compareVariants(a, b, 10000);
  return Math.max(p, 1 - p);
}

export function isWinner(
  a: VariantStats,
  b: VariantStats,
  thresholds: {
    confidence: number;
    minSampleSize: number;
    minImprovementMargin: number;
  },
): boolean {
  if (
    a.successes + a.failures < thresholds.minSampleSize ||
    b.successes + b.failures < thresholds.minSampleSize
  ) {
    return false;
  }

  const rateA = a.successes / (a.successes + a.failures);
  const rateB = b.successes / (b.successes + b.failures);

  if (rateA - rateB < thresholds.minImprovementMargin) {
    return false;
  }

  return compareVariants(a, b, 10000) >= thresholds.confidence;
}
```

Note on `Math.random()`: Used only for internal statistical sampling within the Bayesian inference engine. This is not a cryptographic context — the statistical properties of `Math.random()` are sufficient for Monte Carlo estimation, and all automated decisions are revertable by the human in the loop.

- [ ] **Step 4: Run test to verify pass**

Run: `corepack pnpm --filter @workspace/api-server run test -- --reporter=verbose src/lib/__tests__/bayesian-compare.test.ts`

Expected: 5 PASS

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/bayesian-compare.ts artifacts/api-server/src/lib/__tests__/bayesian-compare.test.ts
git commit -m "feat(api): add Bayesian variant comparison engine with tests"
```

---

### Task 6: Learning aggregator engine with tests

**Files:**
- Create: `artifacts/api-server/src/lib/learning-aggregator.ts`
- Create: `artifacts/api-server/src/lib/__tests__/learning-aggregator.test.ts`

- [ ] **Step 1: Write failing tests for aggregation**

The aggregator takes raw feedback signals and event logs and produces per-variant stats. Since it queries the DB, use mocked DB for tests.

```typescript
import { describe, expect, it, vi } from "vitest";
import { aggregateVariantStats } from "../learning-aggregator";

describe("aggregateVariantStats", () => {
  it("groups outcomes by prompt version", async () => {
    const mockSignals = [
      { outcome: "offer", promptVersionId: 1, resumeVersionId: 10 },
      { outcome: "rejected", promptVersionId: 1, resumeVersionId: 11 },
      { outcome: "offer", promptVersionId: 2, resumeVersionId: 12 },
      { outcome: "ghosted", promptVersionId: 2, resumeVersionId: 13 },
    ];

    const result = aggregateVariantStats(mockSignals, []);

    expect(result).toHaveLength(2);
    const v1 = result.find((r) => r.variantId === 1 && r.variantType === "prompt")!;
    expect(v1.successes).toBe(1);
    expect(v1.failures).toBe(1);
    expect(v1.pending).toBe(0);

    const v2 = result.find((r) => r.variantId === 2 && r.variantType === "prompt")!;
    expect(v2.successes).toBe(1);
    expect(v2.failures).toBe(0);
    expect(v2.pending).toBe(1);
  });

  it("returns empty array for empty input", async () => {
    expect(aggregateVariantStats([], [])).toEqual([]);
  });

  it("handles signals without prompt version id gracefully", async () => {
    const mockSignals = [
      { outcome: "offer", promptVersionId: null, resumeVersionId: 10 },
    ];

    const result = aggregateVariantStats(mockSignals, []);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `corepack pnpm --filter @workspace/api-server run test -- --reporter=verbose src/lib/__tests__/learning-aggregator.test.ts`

Expected: FAIL — function not defined

- [ ] **Step 3: Implement the aggregation engine**

```typescript
interface RawSignal {
  outcome: string;
  promptVersionId: number | null;
  resumeVersionId: number | null;
}

interface AggregatedStat {
  variantType: "prompt";
  variantId: number;
  taskScope: string;
  successes: number;
  failures: number;
  pending: number;
}

const POSITIVE_OUTCOMES = new Set(["offer", "hired"]);
const NEGATIVE_OUTCOMES = new Set(["rejected"]);

export function aggregateVariantStats(
  signals: RawSignal[],
  _eventLogs: unknown[],
): AggregatedStat[] {
  const map = new Map<string, AggregatedStat>();

  for (const signal of signals) {
    if (signal.promptVersionId == null) continue;

    const key = `prompt:${signal.promptVersionId}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        variantType: "prompt",
        variantId: signal.promptVersionId,
        taskScope: "",
        successes: 0,
        failures: 0,
        pending: 0,
      };
      map.set(key, entry);
    }

    if (POSITIVE_OUTCOMES.has(signal.outcome)) {
      entry.successes++;
    } else if (NEGATIVE_OUTCOMES.has(signal.outcome)) {
      entry.failures++;
    } else {
      entry.pending++;
    }
  }

  return Array.from(map.values());
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `corepack pnpm --filter @workspace/api-server run test -- --reporter=verbose src/lib/__tests__/learning-aggregator.test.ts`

Expected: 3 PASS

- [ ] **Step 5: Run both test files to confirm nothing is broken**

Run: `corepack pnpm --filter @workspace/api-server run test -- --reporter=verbose src/lib/__tests__/bayesian-compare.test.ts src/lib/__tests__/learning-aggregator.test.ts`

Expected: 8 PASS total

- [ ] **Step 6: Commit**

```bash
git add artifacts/api-server/src/lib/learning-aggregator.ts artifacts/api-server/src/lib/__tests__/learning-aggregator.test.ts
git commit -m "feat(api): add learning aggregation engine with tests"
```

---

### Task 7: Extend ai-learning router with new endpoints

**Files:**
- Modify: `artifacts/api-server/src/routes/ai-learning.ts`

The existing file already has the aiMetricsSnapshotRouter mounted. We add the learning loop endpoints to the same router instance.

- [ ] **Step 1: Read the current ai-learning.ts to understand the existing structure**

Existing file at `artifacts/api-server/src/routes/ai-learning.ts` has:
- Lines 1-13: Imports (Router, drizzle-orm, zod, db schemas)
- Line 15: `import { aiMetricsSnapshotRouter } from "./ai-metrics-snapshot";`
- Lines 17-23: Router setup, param schemas
- Line 24: `router.use(aiMetricsSnapshotRouter);`
- Lines 26-236: Existing CRUD endpoints for ai-prompt-versions, ai-run-evaluations, ai-training-examples

- [ ] **Step 2: Add new schema and config imports**

In `ai-learning.ts`, add these imports after the existing `@workspace/db` import (line 13):

```typescript
import {
  aiVariantStatsTable,
  aiVariantComparisonsTable,
  aiLearningConfigTable,
  insertAiVariantStatSchema,
  insertAiVariantComparisonSchema,
  updateAiLearningConfigSchema,
} from "@workspace/db";
import { compareVariants, isWinner, confidence } from "../lib/bayesian-compare";
import { aggregateVariantStats } from "../lib/learning-aggregator";
```

- [ ] **Step 3: Add the recompute endpoint**

Append before the final `export default router;` line:

```typescript
router.post("/ai-learning/recompute", async (req, res): Promise<void> => {
  try {
    const [config] = await db
      .select()
      .from(aiLearningConfigTable)
      .limit(1);

    const confidenceThreshold = config
      ? parseFloat(config.confidenceThreshold)
      : 0.95;
    const minSampleSize = config ? config.minSampleSize : 10;
    const minImprovementMargin = config
      ? parseFloat(config.minImprovementMargin)
      : 0.05;

    const signals = await db
      .select({
        outcome: feedbackSignalsTable.outcome,
        promptVersionId: feedbackSignalsTable.promptVersionId,
        resumeVersionId: feedbackSignalsTable.resumeVersionId,
      })
      .from(feedbackSignalsTable)
      .where(eq(feedbackSignalsTable.processedAt, null));

    const taskScopes = await db
      .selectDistinct({ taskScope: feedbackSignalsTable.promptVersionId })
      .from(feedbackSignalsTable);

    const rawStats = aggregateVariantStats(signals, []);

    await db.transaction(async (tx) => {
      for (const stat of rawStats) {
        const [promptVersion] = await tx
          .select({ taskScope: aiPromptVersionsTable.taskScope })
          .from(aiPromptVersionsTable)
          .where(eq(aiPromptVersionsTable.id, stat.variantId));

        const taskScope = promptVersion?.taskScope ?? "unknown";

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

      for (const stat of rawStats) {
        if (stat.failures + stat.successes < minSampleSize) continue;

        const [promptVersion] = await tx
          .select({ taskScope: aiPromptVersionsTable.taskScope })
          .from(aiPromptVersionsTable)
          .where(eq(aiPromptVersionsTable.id, stat.variantId));

        const taskScope = promptVersion?.taskScope ?? "unknown";

        const others = rawStats.filter(
          (s) =>
            s.variantId !== stat.variantId &&
            s.variantType === stat.variantType,
        );

        for (const other of others) {
          const winner = isWinner(stat, other, {
            confidence: confidenceThreshold,
            minSampleSize,
            minImprovementMargin,
          });

          if (!winner) continue;

          const rateA =
            stat.successes / (stat.successes + stat.failures);
          const rateB =
            other.successes / (other.successes + other.failures);
          const conf = confidence(stat, other);

          await tx.insert(aiVariantComparisonsTable).values({
            taskScope,
            variantAId: stat.variantId,
            variantAType: stat.variantType,
            variantBId: other.variantId,
            variantBType: other.variantType,
            probabilityA: compareVariants(stat, other, 10000).toString(),
            confidence: conf.toString(),
            successRateA: rateA.toFixed(4),
            successRateB: rateB.toFixed(4),
            sampleSizeA: stat.successes + stat.failures,
            sampleSizeB: other.successes + other.failures,
            status: "suggested",
          });
        }
      }
    });

    req.log.info("Learning recomputation completed");
    res.json({ ok: true, statsCount: rawStats.length });
  } catch (error) {
    req.log.error({ error }, "Learning recomputation failed");
    res.status(500).json({
      error: "Recomputation failed",
      message:
        error instanceof Error ? error.message : "Unknown error",
    });
  }
});
```

- [ ] **Step 4: Add the stats endpoint**

Append after the recompute endpoint:

```typescript
router.get("/ai-learning/stats", async (req, res): Promise<void> => {
  const query = z
    .object({ taskScope: z.string().optional() })
    .safeParse(req.query);

  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.taskScope) {
    conditions.push(
      eq(aiVariantStatsTable.taskScope, query.data.taskScope),
    );
  }

  const rows = await db
    .select()
    .from(aiVariantStatsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(aiVariantStatsTable.taskScope);

  const enriched = await Promise.all(
    rows.map(async (row) => {
      let label = `#${row.variantId}`;
      if (row.variantType === "prompt") {
        const [pv] = await db
          .select({ label: aiPromptVersionsTable.label })
          .from(aiPromptVersionsTable)
          .where(eq(aiPromptVersionsTable.id, row.variantId));
        if (pv) label = pv.label;
      } else {
        const [mc] = await db
          .select({ modelName: aiModelConfigsTable.modelName })
          .from(aiModelConfigsTable)
          .where(eq(aiModelConfigsTable.id, row.variantId));
        if (mc) label = mc.modelName;
      }
      return { ...row, label };
    }),
  );

  res.json(enriched);
});
```

- [ ] **Step 5: Add the comparisons endpoint**

Append after the stats endpoint:

```typescript
router.get("/ai-learning/comparisons", async (req, res): Promise<void> => {
  const query = z
    .object({
      taskScope: z.string().optional(),
      status: z.string().optional(),
    })
    .safeParse(req.query);

  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.taskScope) {
    conditions.push(
      eq(aiVariantComparisonsTable.taskScope, query.data.taskScope),
    );
  }
  if (query.data.status) {
    conditions.push(
      eq(aiVariantComparisonsTable.status, query.data.status),
    );
  }

  const rows = await db
    .select()
    .from(aiVariantComparisonsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiVariantComparisonsTable.createdAt));

  res.json(rows);
});
```

- [ ] **Step 6: Add the manual promotion endpoint**

Append after comparisons:

```typescript
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
      res.status(409).json({
        error: `Comparison status is "${comparison.status}", expected "suggested"`,
      });
      return;
    }

    await db.transaction(async (tx) => {
      if (comparison.variantAType === "prompt") {
        const [pv] = await tx
          .select()
          .from(aiPromptVersionsTable)
          .where(eq(aiPromptVersionsTable.id, comparison.variantAId));

        if (pv) {
          await tx
            .update(aiPromptVersionsTable)
            .set({ isActive: false })
            .where(
              and(
                eq(aiPromptVersionsTable.taskScope, pv.taskScope),
                eq(aiPromptVersionsTable.isActive, true),
              ),
            );

          await tx
            .update(aiPromptVersionsTable)
            .set({ isActive: true })
            .where(eq(aiPromptVersionsTable.id, comparison.variantAId));
        }
      }

      await tx
        .update(aiVariantComparisonsTable)
        .set({
          status: "suggested",
          promotedAt: new Date(),
        })
        .where(eq(aiVariantComparisonsTable.id, comparison.id));

      await tx.insert(eventLogsTable).values({
        entityType: "ai_learning",
        entityId: comparison.id,
        eventType: "variant_promoted",
        actorType: "user",
        metadata: {
          comparisonId: comparison.id,
          variantId: comparison.variantAId,
          variantType: comparison.variantAType,
          taskScope: comparison.taskScope,
          previousStatus: comparison.status,
        },
      });
    });

    req.log.info(
      { comparisonId: comparison.id },
      "Variant manually promoted",
    );
    res.json({ ok: true });
  },
);
```

- [ ] **Step 7: Add config read/write endpoints**

Append after promote:

```typescript
router.get("/ai-learning/config", async (req, res): Promise<void> => {
  const [config] = await db
    .select()
    .from(aiLearningConfigTable)
    .limit(1);

  if (!config) {
    const [defaultConfig] = await db
      .insert(aiLearningConfigTable)
      .values({})
      .returning();
    res.json(defaultConfig);
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

  const [existing] = await db
    .select()
    .from(aiLearningConfigTable)
    .limit(1);

  if (!existing) {
    const [created] = await db
      .insert(aiLearningConfigTable)
      .values(parsed.data)
      .returning();
    res.json(created);
    return;
  }

  const [updated] = await db
    .update(aiLearningConfigTable)
    .set(parsed.data)
    .where(eq(aiLearningConfigTable.id, existing.id))
    .returning();

  res.json(updated);
});
```

- [ ] **Step 8: Add the required additional imports**

At the top of `ai-learning.ts`, add `asc` to the drizzle-orm import:

```typescript
import { and, asc, desc, eq } from "drizzle-orm";
```

And add the missing table imports from `@workspace/db`:

```typescript
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
} from "@workspace/db";
```

- [ ] **Step 9: Verify typecheck**

Run: `corepack pnpm --filter @workspace/api-server run typecheck`

Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add artifacts/api-server/src/routes/ai-learning.ts
git commit -m "feat(api): add ai-learning recompute, stats, comparisons, promote, and config endpoints"
```

---

### Task 8: Create dashboard /ai-learning page

**Files:**
- Create: `artifacts/dashboard/src/pages/ai-learning/index.tsx`

- [ ] **Step 1: Write the dashboard page**

```typescript
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, RefreshCw, TrendingUp, Trophy, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnimatedCard } from "@/components/motion/animated-card";
import { StaggerContainer } from "@/components/motion/stagger-container";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface VariantStat {
  id: number;
  variantType: string;
  variantId: number;
  taskScope: string;
  successes: number;
  failures: number;
  pending: number;
  totalCostUsd: string;
  avgCostPerApp: string;
  lastComputedAt: string | null;
  label?: string;
}

interface VariantComparison {
  id: number;
  taskScope: string;
  variantAId: number;
  variantAType: string;
  variantBId: number;
  variantBType: string;
  probabilityA: string;
  confidence: string;
  successRateA: string;
  successRateB: string;
  sampleSizeA: number;
  sampleSizeB: number;
  status: string;
  promotedAt: string | null;
  revertedAt: string | null;
}

interface LearningConfig {
  id: number;
  autoPromoteEnabled: boolean;
  confidenceThreshold: string;
  minSampleSize: number;
  minImprovementMargin: string;
  recomputeScheduleCron: string;
}

const API_BASE = "/api/ai-learning";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "suggested":
      return "default";
    case "auto_promoted":
      return "default";
    case "reverted":
      return "destructive";
    case "stale":
      return "secondary";
    default:
      return "outline";
  }
}

export default function AiLearningPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingConfig, setEditingConfig] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<VariantStat[]>({
    queryKey: ["ai-learning-stats"],
    queryFn: () => fetch(API_BASE + "/stats").then((r) => r.json()),
  });

  const { data: comparisons } = useQuery<VariantComparison[]>({
    queryKey: ["ai-learning-comparisons"],
    queryFn: () => fetch(API_BASE + "/comparisons").then((r) => r.json()),
  });

  const { data: config } = useQuery<LearningConfig>({
    queryKey: ["ai-learning-config"],
    queryFn: () => fetch(API_BASE + "/config").then((r) => r.json()),
  });

  const recomputeMutation = useMutation({
    mutationFn: () =>
      fetch(API_BASE + "/recompute", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-learning-stats"] });
      queryClient.invalidateQueries({ queryKey: ["ai-learning-comparisons"] });
      toast({ title: "Recomputation complete" });
    },
    onError: (err) => {
      toast({ title: "Recomputation failed", description: String(err), variant: "destructive" });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(API_BASE + `/comparisons/${id}/promote`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-learning-comparisons"] });
      queryClient.invalidateQueries({ queryKey: ["ai-learning-stats"] });
      toast({ title: "Variant promoted" });
    },
    onError: (err) => {
      toast({ title: "Promotion failed", description: String(err), variant: "destructive" });
    },
  });

  const configMutation = useMutation({
    mutationFn: (body: Partial<LearningConfig>) =>
      fetch(API_BASE + "/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-learning-config"] });
      toast({ title: "Configuration updated" });
      setEditingConfig(false);
    },
    onError: (err) => {
      toast({ title: "Update failed", description: String(err), variant: "destructive" });
    },
  });

  const hasData = stats && stats.length > 0;
  const suggestedComparisons = comparisons?.filter((c) => c.status === "suggested") ?? [];
  const totalApplications = stats?.reduce((sum, s) => sum + s.successes + s.failures + s.pending, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            AI Learning
          </h1>
          <p className="text-muted-foreground mt-1">
            Bayesian optimization loop that learns from application outcomes
          </p>
        </div>
        <Button onClick={() => recomputeMutation.mutate()} disabled={recomputeMutation.isPending}>
          <RefreshCw className={cn("h-4 w-4 mr-2", recomputeMutation.isPending && "animate-spin")} />
          Recompute Now
        </Button>
      </div>

      {stats?.some((s) => s.lastComputedAt) && (
        <p className="text-xs text-muted-foreground">
          Last computed: {new Date(stats.find((s) => s.lastComputedAt)!.lastComputedAt!).toLocaleString()}
        </p>
      )}

      {!hasData && !statsLoading && (
        <AnimatedCard>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Not Enough Data</h3>
              <p className="text-muted-foreground max-w-md">
                Collect at least 10 applications with outcomes to start learning. Your application outcomes (accepted/rejected/offer) automatically feed the learning engine. Currently: {totalApplications} applications.
              </p>
            </CardContent>
          </Card>
        </AnimatedCard>
      )}

      {hasData && (
        <>
          <StaggerContainer className="grid gap-4 md:grid-cols-3">
            <AnimatedCard>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalApplications}</div>
                  <p className="text-xs text-muted-foreground">Across all variants</p>
                </CardContent>
              </Card>
            </AnimatedCard>
            <AnimatedCard>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Suggestions</CardTitle>
                  <Trophy className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{suggestedComparisons.length}</div>
                  <p className="text-xs text-muted-foreground">Promotions awaiting review</p>
                </CardContent>
              </Card>
            </AnimatedCard>
            <AnimatedCard>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Promotions</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {comparisons?.filter((c) => c.status === "auto_promoted").length ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Auto-promoted variants</p>
                </CardContent>
              </Card>
            </AnimatedCard>
          </StaggerContainer>

          <Card>
            <CardHeader>
              <CardTitle>Variant Leaderboard</CardTitle>
              <CardDescription>Performance metrics per prompt version and task scope</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Task Scope</TableHead>
                    <TableHead className="text-right">Success Rate</TableHead>
                    <TableHead className="text-right">Sample Size</TableHead>
                    <TableHead className="text-right">Cost/App</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.map((stat) => {
                    const total = stat.successes + stat.failures + stat.pending;
                    const rate = total > 0 ? ((stat.successes / total) * 100).toFixed(1) : "0.0";
                    return (
                      <TableRow key={stat.id}>
                        <TableCell className="font-medium">{stat.label ?? `#${stat.variantId}`}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{stat.variantType}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{stat.taskScope}</TableCell>
                        <TableCell className="text-right">{rate}%</TableCell>
                        <TableCell className="text-right">{total}</TableCell>
                        <TableCell className="text-right">${parseFloat(stat.avgCostPerApp || "0").toFixed(4)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {suggestedComparisons.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  Suggested Promotions
                </CardTitle>
                <CardDescription>Bayesian comparison results — promote the winning variant</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {suggestedComparisons.map((comp) => {
                  const confidencePct = (parseFloat(comp.confidence) * 100).toFixed(1);
                  return (
                    <Card key={comp.id} className="border-amber-500/30">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-semibold">
                              {comp.variantAType} #{comp.variantAId} vs #{comp.variantBId}
                            </h4>
                            <p className="text-xs text-muted-foreground">{comp.taskScope}</p>
                          </div>
                          <Badge>{confidencePct}% confidence</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Winner (A)</p>
                            <p className="text-lg font-bold">
                              {(parseFloat(comp.successRateA) * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground">
                              N={comp.sampleSizeA}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Loser (B)</p>
                            <p className="text-lg font-bold text-muted-foreground">
                              {(parseFloat(comp.successRateB) * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground">
                              N={comp.sampleSizeB}
                            </p>
                          </div>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 mb-4">
                          <div
                            className="bg-amber-500 h-2 rounded-full transition-all"
                            style={{ width: `${confidencePct}%` }}
                          />
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => promoteMutation.mutate(comp.id)}
                          disabled={promoteMutation.isPending}
                        >
                          Promote Variant #{comp.variantAId}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Learning Configuration</CardTitle>
              <CardDescription>Thresholds and automation settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-promote">Auto-Promote Enabled</Label>
                <Switch
                  id="auto-promote"
                  checked={config?.autoPromoteEnabled ?? false}
                  onCheckedChange={(checked) =>
                    configMutation.mutate({ autoPromoteEnabled: checked })
                  }
                />
              </div>
              {editingConfig ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="confidence">Confidence Threshold (0-1)</Label>
                    <Input
                      id="confidence"
                      defaultValue={config?.confidenceThreshold ?? "0.95"}
                      onBlur={(e) => {
                        configMutation.mutate({ confidenceThreshold: e.target.value });
                        setEditingConfig(false);
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="min-sample">Minimum Sample Size</Label>
                    <Input
                      id="min-sample"
                      type="number"
                      defaultValue={config?.minSampleSize ?? 10}
                      onBlur={(e) => {
                        configMutation.mutate({ minSampleSize: parseInt(e.target.value, 10) });
                        setEditingConfig(false);
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="min-improvement">Minimum Improvement Margin (0-1)</Label>
                    <Input
                      id="min-improvement"
                      defaultValue={config?.minImprovementMargin ?? "0.05"}
                      onBlur={(e) => {
                        configMutation.mutate({ minImprovementMargin: e.target.value });
                        setEditingConfig(false);
                      }}
                    />
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setEditingConfig(true)}>
                  Edit Parameters
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `corepack pnpm --filter @workspace/dashboard run typecheck`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add artifacts/dashboard/src/pages/ai-learning/index.tsx
git commit -m "feat(dashboard): add AI Learning page with leaderboard and promotions"
```

---

### Task 9: Wire up routes and sidebar

**Files:**
- Modify: `artifacts/dashboard/src/App.tsx`
- Modify: `artifacts/dashboard/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add import and route in App.tsx**

In `App.tsx`, add the import after the AdminUsersPage import (line 30):

```typescript
import AiLearningPage from "@/pages/ai-learning";
```

In `App.tsx`, add the route in ProtectedRoutes after the ai-config route (line 109):

```typescript
<Route path="/ai-learning" element={<AiLearningPage />} />
```

- [ ] **Step 2: Add sidebar navigation item**

In `sidebar.tsx`, add to the `navigation` array after the existing "AI Config" entry (line 27):

```typescript
{ name: "AI Learning", href: "/ai-learning", icon: Brain },
```

This reuses the `Brain` icon already imported on line 3.

- [ ] **Step 3: Verify typecheck**

Run: `corepack pnpm --filter @workspace/dashboard run typecheck`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add artifacts/dashboard/src/App.tsx artifacts/dashboard/src/components/layout/sidebar.tsx
git commit -m "feat(dashboard): add /ai-learning route and sidebar navigation"
```

---

### Task 10: Validate full typecheck and integration

- [ ] **Step 1: Run full workspace typecheck**

Run: `corepack pnpm run typecheck`

Expected: PASS — all packages typecheck without errors

- [ ] **Step 2: Run all tests**

Run: `corepack pnpm --filter @workspace/api-server run test`

Expected: All tests PASS (including existing lineage-proof tests and new bayesian-compare/learning-aggregator tests)

- [ ] **Step 3: Commit any remaining changes**

```bash
git status
git add -A
git commit -m "chore: final typecheck and test validation for Phase 1"
```

---

## Phase 2: Auto-Promotion Mode (Later)

Phase 2 tasks will be detailed in a separate plan after Phase 1 is deployed and validated. High-level scope:

1. Install `node-cron` in api-server
2. Create scheduler service that reads `recomputeScheduleCron` from config
3. Extend recompute endpoint to auto-promote when `autoPromoteEnabled` is true
4. Add `POST /ai-learning/comparisons/:id/revert` endpoint
5. Update dashboard to show auto-promoted comparisons with "Revert" button
6. Add auto-promotion notification in event log

---

## Self-Review Checklist

- [x] Spec coverage: Every spec requirement (3 tables, 6 endpoints, dashboard page, Bayesian engine, aggregation) mapped to a task
- [x] Placeholder scan: No TBD/TODO, no "fill in later", no "add error handling" without code
- [x] Type consistency: All function signatures, table names, and endpoint paths are consistent across tasks
- [x] Import paths use `@workspace/db` for DB package, relative paths for api-server
