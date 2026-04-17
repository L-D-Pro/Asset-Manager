# AI Pipeline Reference

Last updated: April 16, 2026

## OpenRouter Contract

All model calls flow through `@workspace/integrations-openrouter-ai`, which uses the OpenRouter OpenAI-compatible API.

Required env vars:

- `AI_INTEGRATIONS_OPENROUTER_API_KEY`
- `AI_INTEGRATIONS_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`

Do not use a bare `OPENROUTER_API_KEY`; the integration uses the `AI_INTEGRATIONS_` convention.

## Model Routing

`selectModelForTask(taskScope)` reads `ai_model_configs`.

Resolution order:

1. Select the active config for the requested `taskScope` with the lowest `priority`.
2. If none is active, walk the configured `fallbackModelId` chain from an inactive scoped config when available.
3. Fall back to an active `default` config.
4. Return `null` if no model can be resolved.

During execution, `callAI()` builds a fallback chain from the selected model and attempts each model until one succeeds. Successes and terminal failures are logged to `event_logs`.

Important task scopes:

- `default`
- `jd_parsing`
- `claim_generation`
- `resume_tailoring`
- `cover_letter`
- `proposal_drafting`
- `job_fit_scoring` and `project_fit_scoring` for future AI-assisted scoring
- `validation`

## Prompt Routing

`resolvePromptForTask()` reads `ai_prompt_versions`.

Behavior:

- If no active prompt version exists for the task, the pipeline's built-in prompt is used.
- If an active prompt version exists, its `systemPrompt` overrides the built-in system prompt.
- `userPromptTemplate` may contain `{{userPrompt}}`; the runtime prompt is substituted there.
- If no placeholder exists, the template is prepended to the runtime prompt.
- AI event metadata includes `promptVersionId` and `promptLabel` when a prompt version is used.

This enables supervised prompt iteration without fine-tuning.

## Central AI Call

`callAI()` accepts:

```ts
{
  taskType: string;
  systemPrompt: string;
  userPrompt: string;
  jobId?: number;
  applicationId?: number;
}
```

Returns:

```ts
{
  content: string;
  modelName: string;
  provider: string;
  taskScope: string;
  promptTokens: number;
  completionTokens: number;
  promptVersionId: number | null;
}
```

Event log metadata records:

- task type
- model name/provider
- prompt version
- token counts
- estimated cost when configured
- fallback attempt number
- prior failures

## Pipelines

### JD Parse

Trigger: `POST /api/jobs/:id/parse`

Flow:

1. Sends raw JD text to AI with `jd_parsing`.
2. Expects strict JSON.
3. Stores parsed skills, responsibilities, keywords, seniority, salary, location, remote type.
4. Marks job parsed/scored depending on route behavior.

### Claim Generation

Trigger: `POST /api/claims/draft`

Input:

- pasted source text
- optional user prompt/instruction
- optional DOCX/PDF upload

Flow:

1. Extracts uploaded document text in memory only.
2. Combines pasted text and extracted text.
3. Truncates AI source context to 30,000 characters.
4. Calls AI with `claim_generation`.
5. Requires JSON draft claims shaped like `CreateClaimBody[]`.
6. Returns draft claims only; no Claims Ledger rows are inserted automatically.

Evidence type defaults:

- `document` when a file contributed source text
- `self_attestation` otherwise

### Resume Tailoring

Trigger: `POST /api/jobs/:id/tailor`

Hard dependency:

- A current `base_resume_versions` row must exist.
- If none exists, the API returns `400` with a clear error.

Flow:

1. Loads the current base resume version.
2. Uses explicit `claimIds` if provided; otherwise ranks active claims via `matchClaimsToJob()` and selects top matches.
3. Sends base resume, job context, and selected claims to AI with `resume_tailoring`.
4. Requires JSON containing `documentText` and attributed bullets.
5. Validates each bullet against selected claims.
6. Stores a `resume_versions` row with:
   - `baseResumeVersionId`
   - `tailoredDocumentText`
   - `tailoredBullets`
   - `diffData`
   - `claimIds`
   - `status = pending_approval`

Failure behavior:

- Malformed JSON stores a pending review record with raw content.
- Truth-lock failure stores a pending review record with diagnostic notes.
- No selected claims stores a pending review record explaining that claims are needed.

### Cover Letter Drafting

Trigger: `POST /api/jobs/:id/cover-letter`

Flow:

1. Selects explicit claims or top matched claims.
2. Calls AI with `cover_letter`.
3. Requires annotated paragraphs with claim IDs.
4. Validates body/hook paragraphs against selected claims.
5. Stores a `cover_letter_versions` row in `pending_approval`.

### Proposal Drafting

Trigger: `POST /api/freelance-projects/:id/draft-proposal`

Flow:

1. Loads the freelance project.
2. Loads the linked or provided freelance profile.
3. Calls AI with `proposal_drafting`.
4. Requires JSON containing:
   - proposal text
   - optional client message
   - bid recommendation
   - milestones
   - cited proof
   - risk notes
5. Stores a `proposal_versions` row in `pending_approval`.

Proposal drafts are for human review and manual submission. The app does not auto-bid or send client messages.

## Truth-Lock Validation

`validateBullet()`:

- Requires non-empty bullet text.
- Requires at least one claim ID.
- Drops hallucinated claim IDs.
- Discards bullets with no valid claim IDs left.
- Sets `isAggregated` when multiple claim IDs are used.

`validateParagraph()`:

- Validates claim IDs the same way.
- Requires valid claim IDs for `body` and `hook`.
- Allows unattributed `opening` and `closing`.

`assertMinimumContent()`:

- Throws `TruthLockViolation` if all generated items are discarded.
- Callers catch it and persist useful raw/diagnostic content.

## Human Approval

AI-generated documents and proposals begin in `pending_approval`.

State machine:

```text
pending_approval -> approved
pending_approval -> rejected
approved/rejected -> 409 on repeat action
```

Applied to:

- resume versions
- cover letter versions
- proposal versions

## Self-Learning Strategy

Current learning is supervised and auditable, not fine-tuning.

Tables:

- `ai_prompt_versions`: versioned task prompts
- `ai_run_evaluations`: review scores and outcomes for AI outputs
- `ai_training_examples`: curated approved or human-edited examples
- `feedback_signals`: downstream outcome data
- `event_logs`: raw AI run/cost/failure metadata

Intended progression:

1. Improve source material and prompts.
2. Use prompt versions and model routing to test changes.
3. Store evaluations and approved examples.
4. Correlate outcomes with prompts, models, claims, and documents.
5. Consider fine-tuning only after enough approved, terms-safe examples exist.

## Safety Boundaries

The app must not:

- bypass MFA/CAPTCHA
- run stealth login bots
- auto-submit on prohibited platforms
- mass apply
- auto-bid or auto-message on Upwork
- scrape platforms where terms prohibit automation

Assisted apply and freelance proposal features are human-approved copilot flows unless an official API or written permission allows more.
