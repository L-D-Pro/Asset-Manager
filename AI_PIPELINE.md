# AI Pipeline Reference

## OpenRouter Integration Contract

All AI calls flow through `@workspace/integrations-openrouter-ai`, a thin wrapper around the OpenAI-compatible SDK pointed at the OpenRouter base URL. The Replit OpenRouter integration provisions two environment variables automatically:

- `AI_INTEGRATIONS_OPENROUTER_BASE_URL` — the OpenRouter API endpoint
- `AI_INTEGRATIONS_OPENROUTER_API_KEY` — the API key

**Do not use a bare `OPENROUTER_API_KEY`**. The integration reads the `AI_INTEGRATIONS_` prefixed vars automatically. See `lib/integrations/integrations-openrouter-ai/` for the client setup.

## Model Routing

### `selectModelForTask(taskScope: string)` — `lib/model-router.ts`

Resolution order for a given task scope:

1. Find the active config with matching `taskScope`, lowest `priority` value (lower = tried first).
2. If no active config found for the scope, look for an inactive one with a `fallbackModelId` chain and walk that chain.
3. If chain exhausted or no config found, fall back to any active config with `taskScope = "default"`.
4. If still nothing, return `null` (calling code throws an error).

### Fallback Chain

Each `ai_model_configs` row may point to another row via `fallbackModelId`. This creates a linked list used both during model selection (to find an active model when the primary is inactive) and during call execution (to try the next model if the current one fails at the API level). A visited-set guards against circular references.

### Priority Within a Scope

If multiple configs have the same `taskScope` and `isActive = true`, the one with the lowest `priority` value is selected first. This enables A/B testing by setting two configs with different priorities.

### Seeded Task Scopes

| Task scope | Purpose | Default model |
|------------|---------|---------------|
| `jd_parsing` | Job description parsing | `anthropic/claude-3.5-haiku` |
| `resume_tailoring` | Resume bullet tailoring | `anthropic/claude-3.5-haiku` |
| `cover_letter` | Cover letter drafting | `anthropic/claude-3.5-haiku` |
| `default` | Catch-all fallback | — |

## `callAI()` — `lib/ai-client.ts`

The central AI call function. Used by all three pipelines.

```typescript
callAI({
  taskType: string,       // maps to taskScope in ai_model_configs
  systemPrompt: string,
  userPrompt: string,
  jobId?: number,         // for EventLog context
  applicationId?: number, // for EventLog context
}): Promise<AiCallResult>
```

Execution flow:
1. Call `selectModelForTask(taskType)` to get the primary model.
2. Call `resolveModelChain()` to build the full ordered fallback list.
3. Iterate the chain. For each model:
   - Call OpenRouter `chat.completions.create()`
   - On success: log to `event_logs` with token counts and estimated cost, return result.
   - On failure: log the error, advance to next model.
4. If all models fail: log a terminal failure event to `event_logs`, throw with full error context.

Every attempt — success or failure — is written to `event_logs` with:
- `eventType: "ai_call"` or `"ai_call_failed"`
- `metadata.promptTokens`, `metadata.completionTokens`, `metadata.estimatedCostUsd`
- `metadata.priorFailures` (list of failed models before the successful one)

## Pipelines

### 1. JD Parse Pipeline — `pipelines/jd-parse.ts`

**Trigger**: `POST /api/jobs/:id/parse` with `rawJdText` in body.

**What it does**:
1. Sends the raw JD text to the AI with a strict JSON-output system prompt.
2. Parses the response into `ParsedJD` (responsibilities, required/nice-to-have skills, keywords, seniority, location, salary, etc.).
3. Updates the `jobs` row with all parsed fields, sets `status = "scored"`.
4. On JSON parse failure: sets `status = "parse_failed"`, stores raw JD text.

**AI prompt strategy**: instructs the model to return only valid JSON matching a precise schema, to be conservative (only include explicitly mentioned skills), and to infer salary range only if stated.

### 2. Resume Tailor Pipeline — `pipelines/resume-tailor.ts`

**Trigger**: `POST /api/jobs/:id/tailor` with optional `claimIds[]` in body.

**What it does**:
1. If `claimIds` provided: use those claims. Otherwise: call `matchClaimsToJob()` to rank all active claims by relevance to the job's parsed skills/keywords, take top 15.
2. Format claims as `[ID:N] Summary (Evidence: ...)` context for the AI.
3. Call AI with `resume_tailoring` task scope — instructs the model to produce bullets that each cite one or more claim IDs from the provided set.
4. Parse the response. If unparseable: store raw output in `ResumeVersion` with `status = "pending_approval"`.
5. Validate each bullet with `validateBullet()` (truth lock — see below).
6. If zero valid bullets remain: throw `TruthLockViolation`, store a failed version for debugging.
7. Build `diffData` with `addedBullets`, `removedBullets`, `reorderedSections`, `summary`, token stats.
8. Insert a new `ResumeVersion` row with `status = "pending_approval"`.

### 3. Cover Letter Pipeline — `pipelines/cover-letter-draft.ts`

**Trigger**: `POST /api/jobs/:id/cover-letter` with optional `claimIds[]` in body.

**What it does**:
1. Same claim selection logic as the resume pipeline (provided IDs or top-15 by matching).
2. Call AI with `cover_letter` task scope — instructs the model to produce annotated paragraphs where each paragraph cites the claim IDs it uses. Roles: `opening`, `hook`, `body`, `closing`.
3. Validate each paragraph with `validateParagraph()`:
   - `body` and `hook` paragraphs must have at least one valid claim ID.
   - `opening` and `closing` paragraphs may be unattributed.
4. Insert a new `CoverLetterVersion` row with `status = "pending_approval"`.

## Truth-Lock Validation — `pipelines/validation.ts`

### `validateBullet(bullet, selectedClaims)`

- Returns `null` (discard) if: text is empty, no claim IDs provided, or all provided IDs are hallucinated (not in `selectedClaims`).
- Hallucinated IDs are silently dropped (logged as warnings). If any valid IDs remain after dropping hallucinations, the bullet is kept.
- The `isAggregated` flag is set automatically if a bullet cites more than one claim ID.

### `validateParagraph(para, selectedClaims)`

- Same ID validation as `validateBullet`.
- `body`/`hook` roles with no valid IDs are discarded. `opening`/`closing` roles without claim IDs are kept (they are transition/salutation text).

### `validateClaimIds(returnedIds, selectedClaims, context)`

- Filters the AI-returned ID list to only those present in `selectedClaims`.
- Logs a warning for any hallucinated IDs.
- Does not throw — dropping is preferred over hard failure.

### `assertMinimumContent(items, rawContent, context)`

- Throws `TruthLockViolation` if `items` is empty after validation.
- Callers catch `TruthLockViolation` specifically and store the raw AI output in the version record for debugging.

### `TruthLockViolation`

A typed error class with a `details` property. Callers check `instanceof TruthLockViolation` to distinguish truth-lock failures from unexpected errors.

## Human Approval Flow

All AI-generated content starts in `status = "pending_approval"`. The state machine is enforced in the route handlers:

```
pending_approval → approved  (POST /api/resume-versions/:id/approve)
pending_approval → rejected  (POST /api/resume-versions/:id/reject)
any other state  → 409 Conflict
```

The dashboard UI enforces a secondary layer:
- Users must decide (accept/reject) each individual added/removed/reordered bullet before approving a resume version.
- Decisions are serialized into the `notes` field on the `ResumeVersion` record before the approve call fires.
- Cover letter revision notes are stored in the `notes` field on the `CoverLetterVersion` record before rejection.

## Three-Phase Roadmap (from PRD)

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 1 | Job ingestion, Claims Ledger, resume diff approval, status tracking, AI pipelines | **COMPLETE** |
| Phase 2 | Assisted apply, ATS autofill, browser extension capture | Planned |
| Phase 3 | Selective auto-apply, outcome-driven optimization, self-learning loop | Planned |

The `feedback_signals` table and `attribution_data` column are designed to support Phase 3 outcome correlation and optimization.
