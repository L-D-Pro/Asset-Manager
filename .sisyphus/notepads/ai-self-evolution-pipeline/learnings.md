# Learnings — AI Self-Evolution Pipeline

## Session: 2026-05-10

### Pre-existing conventions
- Spec-first API workflow: edit openapi.yaml → codegen → apply schemas → wire routes
- All pipelines share callAI() pattern: systemPrompt + userPrompt → parseJsonResponse() → validate → store
- truth-lock: output items must trace back to valid claim IDs, hallucinated IDs silently dropped
- Human-in-the-loop: no auto-submit; every AI output requires approval
- All AI calls logged to event_logs with full token/cost/runId lineage
- DB changes via runtime-compat.sql (not drizzle-kit push on Windows)

### Key integration points
- callAI() in `artifacts/api-server/src/lib/ai-client.ts` is the single entry point
- resolvePromptForTask() in `prompt-router.ts` handles prompt resolution from DB
- selectModelForTask() in `model-router.ts` handles model routing
- lineage.ts at `artifacts/api-server/src/lib/lineage.ts` (NOT pipelines/)
- feedback-signals route at `artifacts/api-server/src/routes/feedback-signals.ts`
- ai-learning route at `artifacts/api-server/src/routes/ai-learning.ts`

### Momus review findings
- lineage.ts lives in lib/ not lib/pipelines/ (fixed in plan)
- No promptVersionId in resume_versions — must derive from event log metadata
- approval/rejection not in jobs.ts directly — need to find actual approval endpoint

### Task 1.1 Learnings — Model variant aggregation
- **modelName column**: Confirmed in `feedback_signals` table as `text("model_name")` (nullable, line 77 of feedback-signals.ts)
- **variantId constraint**: `aiVariantStatsTable.variantId` is `integer`, not `text`. Model names are strings, so a DJB2-like hash (`hashModelName()`) converts model names to stable 32-bit signed integers for use as variantId.
- **Hash approach**: Uses DJB2 (seed 5381, `((hash << 5) + hash + char) | 0`). Collisions are extremely unlikely with model name strings like "openai/gpt-4o" but theoretically possible. Not a crash risk since the (variantType, variantId) combination in the unique index distinguishes from prompt variant IDs with same numeric value.
- **Optional modelName**: RawSignal.modelName is `string | null` (optional, `?`) to maintain backward compatibility with existing tests that don't pass modelName.
- **Recompute endpoint interaction**: Lines 270-276 of `ai-learning.ts` look up taskScope from `aiPromptVersionsTable` using `stat.variantId`. For model stats (variantId = hash, not a prompt version ID), this lookup returns no rows and the stat is skipped (`if (!taskScope) continue`). This means model stats are computed but not yet persisted by the recompute endpoint — Task 1.2+ must update the recompute endpoint to handle model variants separately.
- **Signal double-counting**: A single signal with 

### Task 1.0 Learnings — OpenAPI Spec Update
- **File modified**: `lib/api-spec/openapi.yaml` (+~220 lines)
- **New tag added**: `best-practices` (AI-suggested and curated best practices)
- **New paths documented**:
  - `GET /ai-learning/health` — Health metrics for the self-evolution pipeline
  - `POST /ai-learning/recompute` — Extended with `unprocessedOnly` query param and model variant stats in response
  - `GET /ai-learning/leaderboard` — Ranked variant performance with model variant support
  - `GET /ai-training-examples/suggested` — Inactive/candidate training examples awaiting review (Wave 3)
  - `GET /best-practices/suggested` — AI-suggested best practices pending human review
- **Extended existing paths**:
  - `POST /feedback-signals` — Documented Wave 3 auto-evaluation behavior
  - `PATCH /feedback-signals/:id` — Documented auto-recompute trigger on outcome/signal type changes
- **New schemas added**:
  - `AiLearningHealth` — health metrics with overallStatus (healthy/warning/degraded)
  - `AiLearningLeaderboardEntry` — ranked variant entry with successRate, cost data, label resolution
  - `AiRecomputeResponse` — extended recompute result with modelVariantCount, promptVariantCount, comparisonsConducted, signalCount
  - `BestPracticesItem` — individual practice guideline (description, source: ai/hardcoded/hybrid, rationale, frequency)
  - `SuggestedBestPractice` — AI-suggested practice with status (suggested/active/rejected) and suggestedAt
- **Verification**: `corepack pnpm --filter @workspace/api-spec run codegen` passed (orval generated schemas successfully). Full workspace typecheck passed (all packages clean).
- **Codegen output**: Generated files in `lib/api-zod` and `lib/api-client-react` updated automatically by orval.
- **Leaderboard vs /stats**: The plan treats `/ai-learning/leaderboard` as the user-facing variant performance endpoint, distinct from the internal `/ai-learning/stats` which returns raw `aiVariantStatsTable` rows with enriched labels. The leaderboard schema adds `rank` and `successRate` computed fields.
### Task 1.2 Learnings — attributionData enrichment
- **File modified**: `artifacts/api-server/src/routes/feedback-signals.ts` (+~60 lines)
- **Imports added**: `desc` from `drizzle-orm`, `coverLetterVersionsTable` from `@workspace/db`
- **Enrichment flow** (before the existing `db.transaction`):
  1. Query `event_logs` for the AI call (`entityType='ai_call'`, `eventType='ai_call'`, matching `runId`) ordered by `id DESC LIMIT 1`
  2. Extract `modelName`, `taskType` (→ `taskScope`), `promptVersionId` from `metadata` jsonb
  3. Query `resume_versions.claimIds` for the linked resume version
  4. Optionally query `cover_letter_versions.claimIds` if `coverLetterVersionId` is in the raw `req.body` (not yet in the typed schema — read from `req.body` directly). Merged via `Set` to deduplicate.
  5. Build `attributionData` object: merge client-provided attribution fields with enriched fields (`resumeVersionId`, `promptVersionId`, `modelName`, `taskScope`, `selectedClaimIds`)
- **Edge cases handled**:
  - No AI call event log found → still creates signal with partial attribution (at minimum `resumeVersionId`)
  - Client sends `attributionData` → merged rather than overwritten (client fields preserved, enriched fields take precedence)
  - `coverLetterVersionId` not in typed body schema → accessed from `req.body as Record<string, unknown>`
- **Verification**: `corepack pnpm --filter @workspace/api-server run typecheck` passed clean
- **Key insight**: The enrichment queries run BEFORE the transaction, not inside it, so they don't hold the transaction lock. Read queries don't need serialization guarantees since the lineage data (event logs, claimIds) is immutable by the time a feedback signal is created.

- **Recompute response design**: Extended from `{ ok, statsCount }` to include `modelVariantCount`, `promptVariantCount` (breaking out variant types), `comparisonsConducted` (Bayesian pairwise comparisons), and `signalCount` (feedback signals processed).both promptVersionId and modelName contributes to BOTH a prompt stat entry AND a model stat entry. This is intentional — one outcome provides evidence about both dimensions.

### Task 1.3 Learnings � Auto-process feedback signals
- **Pre-existing code**: The recompute endpoint already had signal-processed-marking logic (lines 414-419 with `WHERE processedAt IS NULL`), so this task was a precision improvement rather than a net-new feature.
- **Race condition fix**: The original broad `WHERE processedAt IS NULL` clause would mark newly-arrived signals (inserted between the SELECT and UPDATE) as processed even though they weren't included in this recompute. The fix collects exact signal IDs (`signalIds = signals.map(s => s.id)`) and uses `inArray(feedbackSignalsTable.id, signalIds)` to target only the signals that contributed to this batch.
- **Within same transaction**: Both SELECT and UPDATE run inside `db.transaction(async (tx) => { ... })`, so even without the precision fix, the window for new signals is small but real. The fix eliminates it entirely.
- **`inArray` already imported**: Line 2 of ai-learning.ts imports from drizzle-orm � no new imports needed.
- **Minimal change**: 2 lines changed (added `signalIds` collection, changed WHERE clause), 0 new tests needed, 0 schema changes.

### Task 1.4 Learnings � Composite (taskScope, variantType) comparison grouping
- **File modified**: `artifacts/api-server/src/routes/ai-learning.ts` (lines 309-328)
- **Problem**: After Task 1.1 added model variant stats alongside prompt variant stats, the comparison loop grouped ALL stats by `taskScope` alone. This caused prompt variants and model variants within the same scope (e.g., "resume_tailor") to be compared against each other in pairwise Bayesian comparisons � mathematically meaningless (comparing a prompt version ID against a hashed model name).
- **Fix applied**:
  1. **Grouping key** (line 311): Changed from `s.taskScope` to composite `${s.taskScope}::${s.variantType}`. This ensures prompt variants and model variants are in separate comparison groups.
  2. **Group key extraction** (lines 317-319): In the loop, `lastIndexOf("::")` extracts real `scope` and `variantType` from the composite key. The `scope` variable retains its original meaning (real taskScope), so downstream references (lines 375, 398, 415) continue to work unchanged.
  3. **DELETE scope** (lines 321-328): Added `eq(aiVariantComparisonsTable.variantAType, variantType)` using drizzle `and()`. The old DELETE `WHERE task_scope = scope` would wipe ALL comparisons for a scope (both prompt and model). The new DELETE only clears comparisons of the same variant type.
  4. **Variable rename**: `scopeStats` ? `groupStats` to reflect the narrower grouping.
- **Why `variantAType` for DELETE**: Within each group, all comparisons have `variantAType === variantBType` (same type only). So filtering by `variantAType = variantType` correctly scopes the DELETE without needing to match `variantBType` separately.
- **`and` already imported**: Line 2 of ai-learning.ts � no new import required.
- **Verification**: `corepack pnpm --filter @workspace/api-server run typecheck` passed clean (0 errors).
- **What stays unchanged**: Bayesian comparison logic (`compareVariants`, `isWinner`, `confidence`), auto-promote logic, variantId normalization (lines 362-369), and comparison insertion (lines 374-387) are all untouched. Only the grouping and DELETE changed.
- **Key delimiter choice**: `::` is a safe delimiter for taskScope values (e.g., "resume_tailor", "cover_letter") � none contain "::" naturally. `lastIndexOf` handles edge cases defensively.
