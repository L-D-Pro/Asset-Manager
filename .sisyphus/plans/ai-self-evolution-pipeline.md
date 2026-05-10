# AI Self-Evolution Pipeline — Implementation Plan

**Created**: 2026-05-09
**Status**: Complete ✅

## Summary

Close the fractured AI learning loop by: (1) processing collected feedback signals into optimization logic, (2) auto-generating evaluations from approvals/rejections, (3) extending the Bayesian comparison engine to support model variants, (4) adding agent specialization via DB-seeded prompt/config roles, and (5) auto-suggesting prompt improvements with human-in-the-loop promotion.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent model | Shared pipeline, different prompts | Leverages existing callAI() + model-router + prompt-router; fastest path to value |
| Auto-promote | Human approval required | Matches human-in-the-loop principle from AGENTS.md; existing suggest mode pattern |
| Config format | DB-seeded config | Consistent with existing pattern; runtime-queryable; no redeployment for changes |
| Priority | Self-healing loop first | Makes existing infrastructure actually work before adding new abstractions |
| Variant types | Extend from "prompt" to include "model" | Enables model A/B testing alongside prompt comparison |

## Scope

### IN
- Close feedback_signals → evaluation → comparison → promote loop
- Auto-generate evaluations from approval/rejection flows
- Extend variant tracking to support model configs alongside prompt versions
- Externalize pipeline prompts into ai_prompt_versions (seed from in-code constants)
- Define agent roles as DB-seeded taskScope configurations (resume_expert, cover_letter_strategist, application_analyst)
- Populate attributionData in feedback signals
- Auto-suggest training examples from approved outputs
- Dashboard: feedback loop status, variant leaderboard, promote suggestions

### OUT
- Model auto-switching without human approval
- New ai_agents table (use existing ai_prompt_versions + ai_model_configs)
- Rewriting existing pipelines to new abstraction
- Browser automation or external auto-submit
- Changing the OpenRouter integration layer

## Key Files

| Area | Files |
|------|-------|
| AI Client Core | `artifacts/api-server/src/lib/ai-client.ts`, `model-router.ts`, `prompt-router.ts`, `lineage.ts` |
| Pipelines | `artifacts/api-server/src/lib/pipelines/resume-tailor.ts`, `cover-letter-draft.ts`, `claim-generation.ts`, `jd-parse.ts`, `gap-analysis.ts`, `validation.ts` |
| Learning Engine | `artifacts/api-server/src/lib/bayesian-compare.ts`, `learning-aggregator.ts`, `learning-scheduler.ts` |
| DB Schema | `lib/db/src/schema/ai-prompt-versions.ts`, `ai-model-configs.ts`, `ai-variant-stats.ts`, `ai-variant-comparisons.ts`, `ai-learning-config.ts`, `ai-run-evaluations.ts`, `ai-training-examples.ts`, `feedback-signals.ts` |
| API Routes | `artifacts/api-server/src/routes/ai-learning.ts`, `feedback-signals.ts` |
| Dashboard | `artifacts/dashboard/src/pages/ai-learning/` |

## Risks & Guardrails (from Metis review)

| Risk | Mitigation |
|------|------------|
| Feedback loop producing bad auto-suggestions | Conservative confidence thresholds (0.95); human approval gate before any promotion |
| Cycle time too long (not enough signals) | Minimum sample size of 10 per variant before comparison; visual "waiting for data" state in dashboard |
| Regression after promotion | Revert endpoint already exists in comparison schema (revertedAt); add quick-revert button in dashboard |
| Model cost escalation from A/B testing | Track cost per variant in ai_variant_stats; show cost impact before promotion |
| Hardcoded prompts drifting from DB-seeded ones | Seed migration is one-time sync; prompt-router already prefers DB version when active |
| Dead loop: signals never reach threshold | Dashboard shows signal counts per variant; manual override to force recompute |
| Variant comparison bias (different sample sizes) | Bayesian approach naturally handles unequal sample sizes; display sample sizes prominently |
| Attribution data never populated | Make attribution population part of pipeline function contracts, not optional |

## Implementation Waves

### Wave 1: Close the Feedback Loop ✅

The core loop that makes the existing infrastructure actually work.

### Wave 2: Agent Specialization (Prompt Externalization) ✅

Define agent roles as DB-seeded configurations and externalize prompts.

### Wave 3: Self-Healing Intelligence

Auto-evaluation, auto-training-example suggestion, and dashboard visualization.

---

## Wave 1 Tasks: Close the Feedback Loop

### Task 1.0: Update OpenAPI spec for new endpoints ✅

**What**: Add all new API endpoints introduced by this plan to `lib/api-spec/openapi.yaml` per the spec-first workflow (AGENTS.md).

**Why**: Per project convention, API changes must follow spec-first workflow: edit OpenAPI → codegen → apply generated schemas → wire routes.

**Files to create/modify**:
- `lib/api-spec/openapi.yaml`

**Implementation**:
1. Add the following new endpoints to the OpenAPI spec:
   - `GET /ai-learning/health` — Loop health check
   - `GET /ai-training-examples/suggested` — List suggested training examples
   - `GET /best-practices/suggested` — List AI-suggested best practices
2. Update existing endpoint schemas where request/response shapes change:
   - `POST /feedback-signals` — Add `attributionData` auto-population behavior
   - `POST /ai-learning/recompute` — Add `unprocessedOnly` query param, return processed signal count
   - `GET/POST/PATCH /ai-prompt-versions` — Add `personality`, `goals`, `skillTags`, `roleLabel` fields
   - `GET /ai-learning/leaderboard` — Include model variant entries
3. Run `corepack pnpm --filter @workspace/api-spec run codegen`
4. Apply generated schema changes to `lib/api-zod`
5. Update route handlers to match new schemas

**QA**: Run typecheck. Verify all generated code compiles. Verify new endpoint schemas are valid.

---

### Task 1.1: Extend `learning-aggregator.ts` to support model variants ✅

**What**: The current `aggregateVariantStats()` only handles `variantType: "prompt"`. Extend it to also group by `modelName` when present in feedback signals.

**Why**: Without model variant tracking, the Bayesian comparison engine cannot compare model performance, only prompt versions.

**Files to modify**:
- `artifacts/api-server/src/lib/learning-aggregator.ts`

**Implementation**:
1. Add `"model"` to the `variantType` union, making it `"prompt" | "model"`
2. Add a `modelName` field to `RawSignal` interface
3. In `aggregateVariantStats()`, create entries for both `prompt:${promptVersionId}` and `model:${modelName}` groupings
4. Return `AggregatedStat[]` with entries for both variant types

**QA**: Unit test: feed signals with both promptVersionId and modelName, verify stats are grouped for both variant types. Verify backward compatibility — signals with null promptVersionId are still handled (skip prompt entry but add model entry if modelName is present).

---

### Task 1.2: Populate `attributionData` in feedback signal creation ✅

**What**: When feedback signals are created (in `routes/feedback-signals.ts` POST handler), populate the `attributionData` jsonb field with the actual tailoring context: which claims were selected, which prompt version was used, which model generated the output.

**Why**: `attributionData` is currently always `{}`. Without it, the learning loop cannot correlate outcomes with specific tailoring decisions.

**Files to modify**:
- `artifacts/api-server/src/routes/feedback-signals.ts`

**Implementation**:
1. When creating a feedback signal, look up the associated `resumeVersionId` to find its `runId`
2. Use `runId` to look up the originating `event_logs` row — extract `modelName`, `taskType`, `promptTokens`, `completionTokens`
3. Look up the `ai_prompt_versions` row via `promptVersionId` from the event log or resume version
4. Build `attributionData` object: `{ promptVersionId, promptLabel, modelName, taskType, claimIds: signal.selectedClaimIds, estimatedCostUsd }`
5. Set `attributionData` on insert

**QA**: Create a feedback signal via API, verify `attributionData` is populated (not `{}`). Verify lineage chain: signal → resume version → event log → prompt version is complete.

---

### Task 1.3: Auto-process feedback signals (set `processedAt`) ✅

**What**: Add a function that marks feedback signals as processed after they've been incorporated into variant stats via the `/ai-learning/recompute` endpoint.

**Why**: `processedAt` is always null. This field exists to track which signals have been incorporated into optimization decisions, preventing double-counting.

**Files to modify**:
- `artifacts/api-server/src/routes/ai-learning.ts` (the POST `/ai-learning/recompute` handler)
- `artifacts/api-server/src/lib/learning-aggregator.ts` (return processed signal IDs)

**Implementation**:
1. In the recompute handler, after aggregating stats and upserting to `ai_variant_stats`, collect the IDs of all signals that were included in the aggregation
2. Update those signals' `processedAt` to `now()` in a batch update
3. Add a query param `?unprocessedOnly=true` (default) to the recompute endpoint to only process signals where `processedAt IS NULL`
4. Return the count of newly processed signals in the response

**QA**: Call recompute, verify unprocessed signals get `processedAt` set. Call recompute again, verify previously-processed signals are not double-counted. Verify `?unprocessedOnly=false` processes all signals regardless of processedAt.

---

### Task 1.4: Extend Bayesian comparison to support model variants ✅

**What**: The `POST /ai-learning/compare` and `POST /ai-learning/promote` flows currently only work for prompt variants. Extend to support model variants.

**Why**: Without model-level comparison, you cannot determine if switching from Claude 3.5 Haiku to GPT-4o improves outcomes for a given task scope.

**Files to modify**:
- `artifacts/api-server/src/routes/ai-learning.ts`
- `artifacts/api-server/src/lib/learning-aggregator.ts` (already extended in 1.1)

**Implementation**:
1. Add `variantBType: "model"` as a valid option in the `ai_variant_comparisons` insert (DB schema already supports any string)
2. In the recompute handler, after aggregating model variant stats, find eligible model pairs for comparison (same `taskScope`, both with `>= minSampleSize` total outcomes)
3. Run Bayesian comparison for each model pair and upsert results to `ai_variant_comparisons` with `variantAType/variantBType = "model"`
4. In the promote endpoint, handle model promotion: when promoting a model variant, update `ai_model_configs` to set the winning model as the active config for that task scope, and demote the loser
5. Add safety: never auto-promote models — only allow suggest mode for model changes (more impactful than prompt tweaks)

**QA**: Create test signals with different modelNames for the same task scope. Call recompute. Verify model comparison entries appear in `ai_variant_comparisons`. Verify promotion updates `ai_model_configs.isActive` correctly. Verify manual approval is required for model promotion.

---

### Task 1.5: Wire feedback signals to the recompute pipeline ✅

**What**: When feedback signals are created or updated, automatically trigger recompute for the relevant task scope if enough signals have accumulated.

**Why**: Currently recompute is fully manual. The loop should auto-trigger when new data arrives.

**Files to modify**:
- `artifacts/api-server/src/routes/feedback-signals.ts` (POST and PATCH handlers)

**Implementation**:
1. In the POST handler, after creating a signal, count how many unprocessed signals exist for the same `taskScope` (derived from the signal's resume/cover letter prompt version)
2. If count >= `ai_learning_config.minSampleSize`, enqueue a recompute job (call the existing recompute logic directly — don't make an HTTP call to self)
3. Extract the recompute logic from the route handler into a reusable function in `learning-aggregator.ts` or a new `learning-processor.ts`
4. Add a config option `autoRecomputeEnabled` to `ai_learning_config` (default `true`)
5. In PATCH handler, if outcome changes, also check if recompute should trigger

**QA**: Create enough signals to exceed minSampleSize, verify recompute fires and processes stats. Create a signal below threshold, verify no recompute. Toggle `autoRecomputeEnabled` off, verify no auto-recompute.

---

### Task 1.6: Dashboard — feedback loop status page ✅ ✅

**What**: Add a "Loop Status" section to the AI Learning dashboard showing: unprocessed signal count, last recompute time, variant comparison results (both prompt and model), and promote suggestions.

**Why**: Users need visibility into whether the loop is working and what optimizations are available.

**Files to modify**:
- `artifacts/dashboard/src/pages/ai-learning/` (existing page structure)

**Implementation**:
1. Add a new section/tab "Loop Status" to the AI Learning page
2. Show: total signals, processed vs unprocessed counts, per-variant-type breakdown
3. Show: last recompute timestamp (from `ai_variant_stats.lastComputedAt`)
4. Show: comparison leaderboard with P(variant A > B) for both prompt and model variants
5. Show: promote suggestions (confidence > threshold, sample size > minimum) with "Approve" buttons
6. Add "Recompute Now" button that calls POST `/ai-learning/recompute`
7. Show "waiting for data" state when sample sizes are below minSampleSize

**QA**: Load the dashboard with some test signals and evaluations. Verify all sections render. Click "Recompute Now" and verify stats update. Click "Approve" on a suggestion and verify promotion goes through.

---

## Wave 2 Tasks: Agent Specialization

### Task 2.1: Create DB migration to seed agent role prompt versions ✅

**What**: Create a Drizzle migration that seeds `ai_prompt_versions` with externalized prompts extracted from the hardcoded SYSTEM_PROMPT constants in pipeline files. Each pipeline gets its own taskScope matching the agent role.

**Why**: Prompts currently live in code. The prompt-router already overlays DB versions when active, but no DB versions exist. Seeding them makes the prompts editable via the dashboard without code changes.

**Files to create/modify**:
- `lib/db/runtime-compat.sql` — Add INSERT statements for seeded prompt versions
- `lib/db/src/schema/ai-prompt-versions.ts` (read-only, verify schema)

**Implementation**:
1. Extract the SYSTEM_PROMPT from each pipeline file:
   - `resume-tailor.ts` → taskScope `resume_tailoring`, label "Resume Expert v1"
   - `cover-letter-draft.ts` → taskScope `cover_letter`, label "Cover Letter Strategist v1"
   - `jd-parse.ts` → taskScope `jd_parsing`, label "JD Parser v1"
   - `claim-generation.ts` → taskScope `claim_generation`, label "Claim Generator v1"
   - `proposal-draft.ts` → taskScope `proposal_drafting`, label "Proposal Drafter v1"
   - `market-research.ts` → taskScope `market_research`, label "Market Researcher v1"
2. Create INSERT statements for `ai_prompt_versions` with version 1, isActive true, and the extracted systemPrompt as systemPromptTemplate
3. Use `userPromptTemplate = "{{userPrompt}}"` (pass-through) for all initial versions
4. Add these to `lib/db/runtime-compat.sql` so they can be applied via `corepack pnpm --filter @workspace/db run compat`

**QA**: Run the compat script. Verify all 6 prompt versions exist in the database. Verify the prompt-router resolves them correctly by calling `resolvePromptForTask("resume_tailoring", fallbackSystem, fallbackUser)` and confirming it returns the DB version. Verify pipelines still work end-to-end with DB prompts active.

---

### Task 2.2: Assign taskScopes to gap analysis and job research ✅

**What**: The `gap-analysis.ts` and `job-research.ts` pipelines currently use `default` taskScope. Assign them their own task scopes so they can be independently optimized.

**Why**: Tasks using `default` taskScope share one model config and prompt pool. They need their own scopes for agent specialization.

**Files to modify**:
- `artifacts/api-server/src/lib/pipelines/gap-analysis.ts`
- `artifacts/api-server/src/lib/pipelines/job-research.ts`

**Implementation**:
1. In `gap-analysis.ts`, change the `taskType` parameter in `callAI()` calls from `"default"` to `"gap_analysis"`
2. In `job-research.ts`, change the `taskType` parameter in `callAI()` calls from `"default"` to `"job_research"`
3. Add default model config entries for `gap_analysis` and `job_research` task scopes in `runtime-compat.sql` (copy the `default` config as baseline)
4. Add seeded prompt versions for these scopes in `runtime-compat.sql`

**QA**: Verify gap analysis pipeline calls use `taskType: "gap_analysis"`. Verify job research uses `taskType: "job_research"`. Verify model-router falls back to `default` scope when no specific config exists. Verify end-to-end pipeline execution.

---

### Task 2.3: Add agent role metadata fields to `ai_prompt_versions` schema and extend `ai_learning_config` ✅

**What**: Extend the `ai_prompt_versions` table with optional metadata fields for agent personality, goals, and skill tags. Extend `ai_learning_config` with new boolean flags for auto-features.

**Why**: The user wants agents.md (personalities) and skills.md (capabilities). These should be DB-configurable, not separate markdown files. Adding metadata fields to the existing table is simpler than creating a new `ai_agents` table. The learning config needs flags for the new auto-features.

**Files to modify**:
- `lib/db/src/schema/ai-prompt-versions.ts` — Add columns
- `lib/db/src/schema/ai-learning-config.ts` — Add columns
- `lib/db/runtime-compat.sql` — Add ALTER TABLE statements

**Implementation**:
1. Add these columns to `aiPromptVersionsTable`:
   - `personality` (text, nullable) — Agent personality description (e.g., "You are an expert resume writer specializing in ATS-optimized, job-specific resumes.")
   - `goals` (text, nullable) — Agent goals (e.g., "Maximize ATS pass-through rate while maintaining truthfulness of claims.")
   - `skillTags` (text array, default `[]`) — Skill tags (e.g., `["ats-optimization", "claim-attribution", "job-mirroring"]`)
   - `roleLabel` (text, nullable) — Human-readable role name (e.g., "Resume Expert", "Cover Letter Strategist")
2. Add these columns to `ai_learning_config`:
   - `autoRecomputeEnabled` (boolean, default `true`) — Auto-trigger recompute when signals accumulate
   - `autoEvaluateEnabled` (boolean, default `true`) — Auto-generate evaluations from approvals/rejections
   - `autoTrainSuggestEnabled` (boolean, default `true`) — Auto-suggest training examples from approved outputs
3. Add ALTER TABLE statements to `runtime-compat.sql`
4. Run `corepack pnpm --filter @workspace/db run compat` to apply

**QA**: Verify the schema change applies cleanly. Verify existing rows are unaffected (nullable columns). Verify API routes that write to `ai_prompt_versions` still work without the new fields.

---

### Task 2.4: Seed agent role definitions ✅

**What**: Populate the new metadata fields for each agent role based on the hardcoded prompts and pipeline responsibilities.

**Why**: Gives each "agent" a distinct identity — personality, goals, and skills — while keeping them as prompt configurations in the existing table.

**Files to modify**:
- `lib/db/runtime-compat.sql` — UPDATE statements for seeded rows

**Implementation**:
1. For each seeded prompt version from Task 2.1, add:
   - `resume_tailoring`: roleLabel="Resume Expert", personality="You are an expert resume writer specializing in ATS-optimized, job-specific resumes.", goals="Maximize ATS pass-through rate while maintaining truthfulness of claims. Mirror the job's exact phrasing. Place top JD skills in prominent positions.", skillTags=["ats-optimization","claim-attribution","job-mirroring","bullet-optimization"]
   - `cover_letter`: roleLabel="Cover Letter Strategist", personality="You are an expert career coach specializing in cover letters.", goals="Highlight 2-3 key achievements most relevant to this job. Show genuine enthusiasm. Address specific business problems.", skillTags=["tone-matching","claim-attribution","company-research","persuasion"]
   - `jd_parsing`: roleLabel="Application Analyst", personality="You are a precise job description parser that extracts structured information.", goals="Accurately extract required skills, qualifications, responsibilities, and company culture signals from job descriptions.", skillTags=["skill-extraction","qualification-parsing","culture-signal-detection"]
   - `claim_generation`: roleLabel="Claim Generator", personality="You are a meticulous claims drafter who creates factually grounded professional claims.", goals="Generate new claims from user source material. Every claim must be verifiable and specific.", skillTags=["fact-extraction","claim-drafting","evidence-linking"]
   - `proposal_drafting`: roleLabel="Proposal Drafter", personality="You are an expert freelance proposal writer.", goals="Draft compelling proposals that address specific client needs and showcase relevant experience.", skillTags=["proposal-structuring","client-needs-analysis","experience-highlighting"]
   - `market_research`: roleLabel="Market Researcher", personality="You are a thorough market analyst.", goals="Provide comprehensive market analysis with actionable insights.", skillTags=["market-analysis","competitor-research","trend-identification"]

**QA**: Verify all 6 roles have their metadata populated. Verify the AI Learning dashboard displays role labels. Verify prompt version editing preserves metadata fields.

---

### Task 2.5: Update AI Learning dashboard to show agent roles ✅

**What**: Add an "Agent Roles" view to the AI Learning dashboard that shows each role with its personality, goals, skills, current prompt version, current model, and performance metrics.

**Why**: Users need to see and manage agent roles as distinct entities, not just prompt versions.

**Files to modify**:
- `artifacts/dashboard/src/pages/ai-learning/` (existing page)

**Implementation**:
1. Add an "Agents" tab to the AI Learning page
2. Fetch prompt versions with metadata (roleLabel, personality, goals, skillTags)
3. Display each agent as a card with: role icon, label, personality, goals, skill tags, current prompt version, current model, success rate
4. Allow editing personality, goals, skill tags inline
5. Show link to "View comparison history" for each agent
6. Color-code performance: green if winning variant, yellow if no data, red if losing variant

**QA**: Navigate to AI Learning → Agents tab. Verify all 6 agent roles appear. Edit a role label and verify it persists. Verify skill tags display correctly. Verify performance metrics link to variant comparison data.

---

## Wave 3 Tasks: Self-Healing Intelligence ✅

### Task 3.1: Auto-generate evaluations from approval/rejection flows ✅

**What**: When a user approves or rejects a resume version or cover letter version, automatically create an `ai_run_evaluation` record with appropriate scores.

**Why**: Currently evaluations are created manually via API. The most natural evaluation signal is whether the user approved or rejected the AI output — this should be captured automatically.

**Files to modify**:
- `artifacts/api-server/src/routes/jobs.ts` (where approval/rejection happens)
- `artifacts/api-server/src/lib/lineage.ts` (for runId resolution)

**Implementation**:
1. Find the endpoint where resume versions are approved/rejected (status change from `pending_approval` to `approved` or `rejected`)
2. On approval: create `ai_run_evaluation` with `approvalOutcome: "approved"`, high truthfulness/relevance/formatting scores (default 0.9), evaluatorType "user_action"
3. On rejection: create `ai_run_evaluation` with `approvalOutcome: "rejected"`, evaluatorType "user_action", notes from user if available
4. Resolve `runId` from the version's lineage chain (event_log linked to the generation)
5. Set `promptVersionId` from the runId's event log metadata
6. Add a config option `autoEvaluationEnabled` to `ai_learning_config` (default `true`)

**QA**: Approve a resume version, verify an `ai_run_evaluation` is automatically created with approval outcome "approved". Reject a cover letter, verify evaluation created with "rejected". Verify runId and promptVersionId are correctly linked. Verify manual evaluations still work alongside auto-generated ones.

---

### Task 3.2: Auto-suggest training examples from approved outputs ✅

**What**: When an evaluation has high scores AND approval outcome is "approved", automatically create a candidate `ai_training_example` entry for the task scope.

**Why**: Currently training examples require manual curation. The best training data comes from outputs that users actually approved — these should be auto-suggested.

**Files to modify**:
- `artifacts/api-server/src/routes/ai-learning.ts` (or a new `training-example-suggester.ts` in lib)
- `artifacts/api-server/src/lib/learning-processor.ts` (new file for learning loop logic)

**Implementation**:
1. Create a function `suggestTrainingExampleFromEvaluation(evaluationId)` in `learning-processor.ts`
2. When a new auto-evaluation is created (from Task 3.1), check if `approvalOutcome === "approved"` AND average score >= 0.8
3. If yes: fetch the original AI output (resume version or cover letter version), create an `ai_training_example` with `isActive: false` (requires manual activation), `qualityScore: average of evaluation scores`
4. Populate `inputSnapshot` with the job description + claims used as input
5. Populate `approvedOutput` with the approved version's content
6. Populate `rejectedOutput` with null (no rejected version to compare)
7. Add a listing endpoint `GET /ai-training-examples/suggested` to show candidate training examples not yet activated

**QA**: Approve a high-scoring resume, verify a training example is auto-suggested (isActive: false). Verify it appears in the suggested listing. Verify low-scoring or rejected evaluations do NOT create suggestions. Activate a suggestion and verify it appears in `fetchFewShotExamples()`.

---

### Task 3.3: Implement best-practices auto-update from feedback signals ✅

**What**: When feedback signals show consistent quality issues (e.g., high rejection rate for a specific task scope), auto-generate candidate best-practice entries.

**Why**: Best practices are currently static/hardcoded. The learning loop should detect quality anti-patterns and suggest new rules.

**Files to create/modify**:
- `artifacts/api-server/src/lib/learning-processor.ts` (extend from 3.2)
- `lib/db/src/schema/best-practices.ts` (verify existing schema supports this)

**Implementation**:
1. Read the existing `best_practices` schema to understand the table structure
2. In `learning-processor.ts`, add a function `suggestBestPracticesFromSignalPatterns(taskScope)`:
   - Query feedback signals for the task scope with negative outcomes
   - If rejection rate > 30% in the last 20 signals, create a candidate best practice with `source: "ai"`, noting the pattern
   - For example: "Cover letters for technical roles are being rejected at 45% — suggest adding technical keyword matching rule"
3. Use the AI itself to draft the best-practice text (call `callAI` with taskType `"best_practice_drafting"`)
4. Create the best practice with `isActive: false` (requires manual activation)
5. Add an endpoint `GET /best-practices/suggested` to show AI-suggested practices

**QA**: Simulate a batch of negative feedback signals for a task scope. Verify a best-practice suggestion is created with source "ai". Verify it's inactive by default. Activate it and verify it appears in pipeline prompts via `formatBestPracticesForPrompt()`.

---

### Task 3.4: Add learning loop health monitoring ✅

**What**: Add a health-check endpoint and dashboard metrics showing whether the learning loop is functioning correctly.

**Why**: Without monitoring, a broken loop (no evaluations, no signals, no comparisons) silently degrades.

**Files to modify**:
- `artifacts/api-server/src/routes/ai-learning.ts`
- `artifacts/dashboard/src/pages/ai-learning/`

**Implementation**:
1. Add `GET /ai-learning/health` endpoint that returns:
   - `loopActive`: boolean — are signals being processed? (check if any signals have processedAt in last 7 days)
   - `signalsLastProcessed`: timestamp of last processed signal
   - `unprocessedSignalCount`: number of signals with processedAt IS NULL
   - `evaluationCount7d`: evaluations created in last 7 days
   - `trainingExampleCount`: total active training examples
   - `variantComparisonCount`: total comparisons with status "completed"
   - `autoPromoteEnabled`: from config
   - `autoEvaluateEnabled`: true (new config from 3.1)
   - `autoTrainSuggestEnabled`: true (from 3.2)
2. Add a "Health" panel to the AI Learning dashboard showing these metrics
3. Show warning indicators: red if no signals processed in 30 days, yellow if unprocessed count > 50, green if everything is flowing

**QA**: Call GET /ai-learning/health, verify all fields are populated. Create signals and evaluations, verify counts update. Verify dashboard renders health panel correctly.

---

### Task 3.5: Wire everything together — end-to-end integration test ✅

**What**: Create an end-to-end test that exercises the complete learning loop: feedback signal → evaluation → comparison → suggestion.

**Why**: The loop involves 7+ tables and multiple API endpoints. An integration test validates the entire chain works end-to-end.

**Files to create**:
- `artifacts/api-server/src/lib/__tests__/learning-loop-integration.test.ts`

**Implementation**:
1. Test the complete flow:
   - Create a job, application, resume version (with lineage)
   - Create a feedback signal (outcome: "offer")
   - Verify attributionData is populated
   - Verify auto-evaluation is created
   - Call recompute
   - Verify variant stats are aggregated
   - Verify signal processedAt is set
   - Create a second variant (different prompt version) with positive signals
   - Call recompute again
   - Verify Bayesian comparison is computed
   - Verify promote suggestion appears
   - Manually approve the promotion
   - Verify active prompt version is updated
2. Test failure paths:
   - Signal without lineage → should still be created but with null attributionData
   - Recompute with no signals → should return empty stats
   - Comparison with insufficient sample size → should not suggest promotion

**QA**: Run the integration test. All assertions should pass. This IS the QA for the entire learning loop.

---

## Final Verification Wave

### Task FV.1: Typecheck all changes ✅

**What**: Run `corepack pnpm run typecheck` at the monorepo root to verify all TypeScript compiles cleanly.

**Why**: Catch type errors across all packages before considering the work complete.

**Command**: `corepack pnpm run typecheck`

**QA**: Zero type errors.

---

### Task FV.2: Database schema compatibility check ✅

**What**: Run `corepack pnpm --filter @workspace/db run compat` to apply schema changes and verify no conflicts.

**Why**: New columns and seeded data must apply cleanly against the existing database.

**Command**: `corepack pnpm --filter @workspace/db run compat`

**QA**: All ALTER TABLE statements apply. Seeded data INSERTs succeed. No constraint violations.

---

### Task FV.3: Manual smoke test — complete learning loop ✅

**What**: Manually walk through the entire learning loop in the running application:
1. Start dev server
2. Create a job with a JD
3. Tailor a resume (triggers AI call with lineage)
4. Approve the resume version
5. Create a feedback signal (outcome: "offer")
6. Verify attributionData is populated in the feedback signal
7. Verify auto-evaluation was created
8. Call recompute
9. Verify variant stats show up
10. Check the dashboard "Loop Status" and "Agents" views
11. Verify health endpoint returns active loop

**Why**: No automated test can fully substitute for a manual end-to-end walkthrough of the user-facing flow.

**QA**: Every step produces the expected result. No errors in the server log. Dashboard renders correctly.

---

### Task FV.4: User sign-off ✅

**What**: Present the completed work to the user for review. Walk through the dashboard, verify agent roles are visible, verify the learning loop is active, verify promote suggestions work.

**Why**: The human-in-the-loop principle requires explicit user approval before marking work complete.

**Action**: Run `/review-work` after tasks FV.1–FV.3 pass. Address any issues found. Then ask user for explicit sign-off.