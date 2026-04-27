# AI Self-Learning Loop — Design Spec

**Date:** 2026-04-26  
**Project:** Asset-Manager / Job Ops  
**Sub-Project:** AI Self-Learning Loop (Phase 1: Suggest, Phase 2: Auto)  
**Approach:** Bayesian Auto-Optimizer with Human Override  
**Status:** Approved

## 1. Goal

Build a closed feedback loop that automatically improves AI output quality by learning from application outcomes (rejected, interview, offer, hired, ghosted). The system compares prompt versions and model configs using Bayesian inference, suggests or auto-promotes winners, and always allows human revert.

## 2. Architecture

### 2.1 System Overview

```
+--------------------------------------------------------------+
|                       LEARNING LOOP                           |
+--------------------------------------------------------------+
                            |
    +-----------------------+------------------------+
    |                                                |
    v                                                v
+----------------+                       +--------------------+
|  APPLICATION   |                       |  AI PIPELINE RUN   |
|   OUTCOMES     |                       | (resume, cover,    |
|  (feedback     |                       |  compare, etc.)    |
|   signals)     |                       |                    |
+-------+--------+                       +--------+-----------+
        |                                          |
        v                                          v
+--------------------------------------------------------------+
|                    AGGREGATION ENGINE                         |
| +--------------+ +--------------+ +------------------------+ |
| | Per-Prompt   | | Per-Model    | | Per-Task-Scope         | |
| | Stats:       | | Stats:       | | Leaderboard            | |
| |   success    | |   success    | | (winners per task)     | |
| |   rate       | |   rate       | |                        | |
| |   cost/app   | |   avg tokens | +------------------------+ |
| |   N          | |   cost/app   |                          |
| +--------------+ +--------------+                          |
+-----------------------------+--------------------------------+
                              |
                              v
+--------------------------------------------------------------+
|              BAYESIAN INFERENCE ENGINE                        |
|                                                               |
|  For each variant pair (A, B):                                |
|    Beta(successes + 1, failures + 1) per variant              |
|    10,000 posterior samples                                    |
|    P(A > B) = proportion where sample_A > sample_B            |
|                                                               |
|  Winner declared when:                                        |
|    P(win) > confidenceThreshold (default: 0.95)               |
|    AND minSampleSize met (default: 10)                        |
|    AND improvementMargin > 0.05 absolute                      |
+-----------------------------+---------------------------------+
                              |
              +---------------+---------------+
              |                               |
              v                               v
+-----------------------------+  +-----------------------------+
|    PHASE 1 (Now)            |  |    PHASE 2 (Later)          |
|    SUGGEST mode             |  |    AUTO mode                |
|                             |  |                             |
|  Dashboard shows            |  |  System auto-               |
|  "Promote v3?"              |  |  promotes winner            |
|  with confidence %          |  |    logs EventLog            |
|  You click to               |  |    notification             |
|  activate                   |  |    you can REVERT           |
+-----------------------------+  +-----------------------------+
```

### 2.2 New Database Tables

#### `ai_variant_stats`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `serial PK` | |
| `variantType` | `text` | `"prompt"` or `"model"` |
| `variantId` | `integer` | FK to `ai_prompt_versions.id` or `ai_model_configs.id` |
| `taskScope` | `text` | e.g., `"resume_tailor"`, `"cover_letter_draft"` |
| `successes` | `integer` | Count of positive outcomes (offer, hired) |
| `failures` | `integer` | Count of negative outcomes (rejected) |
| `pending` | `integer` | Count of pending/ghosted |
| `totalCostUsd` | `text` | Total estimated cost for this variant's runs |
| `avgCostPerApp` | `text` | Average cost per application |
| `lastComputedAt` | `timestamp` | When stats were last refreshed |
| `createdAt` | `timestamp` | |

Unique constraint on `(variantType, variantId, taskScope)`.

#### `ai_variant_comparisons`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `serial PK` | |
| `taskScope` | `text` | |
| `variantAId` | `integer` | |
| `variantAType` | `text` | `"prompt"` or `"model"` |
| `variantBId` | `integer` | |
| `variantBType` | `text` | `"prompt"` or `"model"` |
| `probabilityA` | `text` | P(A > B) as decimal string |
| `confidence` | `text` | Max of probabilityA and 1-probabilityA |
| `successRateA` | `text` | |
| `successRateB` | `text` | |
| `sampleSizeA` | `integer` | |
| `sampleSizeB` | `integer` | |
| `status` | `text` | `"pending"`, `"suggested"`, `"auto_promoted"`, `"reverted"`, `"stale"` |
| `promotedAt` | `timestamp` | |
| `revertedAt` | `timestamp` | |
| `createdAt` | `timestamp` | |

#### `ai_learning_config`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `serial PK` | Single row (seeded on bootstrap) |
| `autoPromoteEnabled` | `boolean` | Phase 2 toggle, default `false` |
| `confidenceThreshold` | `text` | Default `"0.95"` |
| `minSampleSize` | `integer` | Default `10` |
| `minImprovementMargin` | `text` | Default `"0.05"` |
| `recomputeScheduleCron` | `text` | Cron expression, default `"0 2 * * *"` |
| `createdAt` | `timestamp` | |
| `updatedAt` | `timestamp` | |

### 2.3 New API Endpoints

All under `/api/ai-learning`:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/stats` | Admin | Per-task-scope variant leaderboards. Query: `?taskScope=...` |
| `GET` | `/comparisons` | Admin | Pairwise comparison results. Query: `?taskScope=...&status=...` |
| `POST` | `/comparisons/:id/promote` | Admin | Manual promotion (Phase 1). Sets variantA as active, logs to EventLog |
| `POST` | `/comparisons/:id/revert` | Admin | Revert an auto-promotion. Restores previous active variant |
| `POST` | `/recompute` | Admin | Trigger stats recomputation for all task scopes |
| `GET` | `/config` | Admin | Read learning system config |
| `PUT` | `/config` | Admin | Update config fields |

### 2.4 Core Algorithm: Bayesian Variant Comparison

```typescript
// bayesian-compare.ts
interface VariantStats {
  successes: number;
  failures: number;
}

function compareVariants(a: VariantStats, b: VariantStats, samples = 10000): number {
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
  return wins / samples; // P(A > B)
}

// Marsaglia's method for Gamma sampling (used for Beta)
function sampleGamma(alpha: number, scale: number): number {
  // Implemented per Marsaglia & Tsang (2000)
  let d = alpha - 1/3;
  let c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x = normalRandom();
    let v = Math.pow(1 + c * x, 3);
    if (v > 0) {
      let u = Math.random(); // Used only in Gamma acceptance step
      let x2 = x * x;
      if (u < 1 - 0.0331 * x2 * x2 || Math.log(u) < 0.5 * x2 + d * (1 - v + Math.log(v))) {
        return d * v * scale;
      }
    }
  }
}

function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha, 1);
  const y = sampleGamma(beta, 1);
  return x / (x + y);
}
```

**Note on `Math.random()` in Gamma sampling:** The Gamma acceptance step uses `Math.random()` which is acceptable because:
1. It is used only in an internal acceptance/rejection loop, not for cryptographic purposes
2. The statistical quality of the Bayesian inference does not depend on cryptographic randomness
3. The final promotion decisions are vetted by a human (Phase 1) or revertable (Phase 2)

### 2.5 Dashboard UI: `/ai-learning` Page

**Layout:**
- Header: Title "AI Learning" + "Recompute Now" button + "Last computed: <timestamp>"
- Config panel (collapsible Card): Auto-promote toggle, confidence threshold slider, min sample size input, improvement margin input
- Leaderboard table: Columns: Variant Name | Type | Task Scope | Success Rate | Cost/App | Sample Size | Status | Actions
- Comparison detail panel: Click a leaderboard row to reveal pairwise comparisons with confidence bars
- Action buttons per comparison: "Promote" (Phase 1, only when status is `suggested`) or "Revert" (Phase 2, when status is `auto_promoted`)

**Status colors:**
- `suggested`: Amber (needs human review)
- `auto_promoted`: Green (system promoted)
- `reverted`: Red (was reverted)
- `stale`: Gray (no longer relevant)

**Conditional content:**
- When no feedback signals exist: Show empty state with "Collect at least 10 applications with outcomes to start learning. Your application outcomes (accepted/rejected/offer) automatically feed the learning engine."
- When only one variant exists: Show tip "Create alternative prompt versions or model configs to enable comparison and learning."

## 3. Error Handling

| Scenario | Behavior |
|----------|----------|
| No feedback signals | Dashboard shows empty state message with N required |
| Only one variant in task scope | Show "Need at least 2 variants to compare" |
| Circular model fallback chain detected | Skip model from comparison; log warning |
| Recomputation fails (DB error) | Full transaction rollback; return 500 with `{ error, lastSuccessfulAt }` |
| Auto-promotion would leave no active prompt | Block promotion with `{ error, reason: "last_active_variant" }` |
| Promotion of already-active variant | 409 Conflict with explanation |
| Config update validation failure | 400 with field-level errors |

## 4. Testing Strategy

| Level | What | How |
|-------|------|-----|
| Unit | `bayesian-compare.ts` | Jest: test known Beta properties (e.g., Beta(10,1) should beat Beta(1,10) with P>0.99) |
| Unit | `learning-aggregator.ts` | Jest: test aggregation with mock DB rows |
| Integration | API endpoints | Seeded test DB with synthetic outcomes, verify stats/comparisons/promote |
| E2E | Dashboard UI | Manual: create 2 prompts, apply to 10+ jobs, record outcomes, verify suggestion appears |
| Manual | Real prompt comparison | Use real pipeline with 2 prompts, verify Bayesian comparison output |

## 5. Implementation Phases

| Phase | Scope | Deliverable | Est. Effort |
|-------|-------|-------------|-------------|
| **Phase 1** | Schema + Aggregator + Bayesian engine + API + Dashboard (Suggest mode) | Working recommendation system; user sees suggestions and manually promotes | ~3-4 days |
| **Phase 2** | Node-cron scheduler + Auto-promotion + EventLog + Revert | Fully autonomous loop with auto-promotion and human revert | ~2-3 days |

## 6. File Map

| File | Responsibility |
|------|----------------|
| `lib/db/src/schema/ai-variant-stats.ts` | `ai_variant_stats` Drizzle schema |
| `lib/db/src/schema/ai-variant-comparisons.ts` | `ai_variant_comparisons` Drizzle schema |
| `lib/db/src/schema/ai-learning-config.ts` | `ai_learning_config` Drizzle schema |
| `lib/db/src/schema/index.ts` | Export new schemas |
| `artifacts/api-server/src/lib/bayesian-compare.ts` | Core Bayesian comparison functions |
| `artifacts/api-server/src/lib/learning-aggregator.ts` | Outcome aggregation engine |
| `artifacts/api-server/src/routes/ai-learning.ts` | API endpoints (extends existing router) |
| `artifacts/dashboard/src/pages/ai-learning/index.tsx` | Dashboard UI page |
| `artifacts/dashboard/src/App.tsx` | Add `/ai-learning` route (protected) |

## 7. Open Questions & Decisions

1. **Ghosted as neutral or negative?** - Treat as neutral (counted in `pending`, not success or failure). Ghosted may mean the application was never reviewed.
2. **Model config comparisons include fallback chain?** - Yes, compare by effective model actually used, not config ID. Record the resolved model in the stats.
3. **Track cost per success?** - Yes, show in dashboard as `cost/app` column.
4. **Cron for recomputation?** - Use `node-cron` in the API server process. Single cron job checks the config's `recomputeScheduleCron` and runs aggregation + comparison.
