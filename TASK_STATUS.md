# Task Status

Last updated: April 20, 2026

## Completed Core Platform

### Foundation

- pnpm monorepo with Node 24 and TypeScript 5.9.
- Drizzle/PostgreSQL schema package in `lib/db`.
- OpenAPI source of truth in `lib/api-spec/openapi.yaml`.
- Orval-generated `@workspace/api-zod` and `@workspace/api-client-react`.
- Express 5 API bundled by esbuild.
- React/Vite/Tailwind dashboard.

### Auth and Production Readiness

- Session auth with `express-session` and `connect-pg-simple`.
- Admin bootstrap from env vars on first startup.
- Password hashing with `bcryptjs`.
- TOTP 2FA with `speakeasy`.
- Recovery codes.
- Protected dashboard routes.
- Session table startup safety.
- DigitalOcean deployment docs and smoke test docs.

### Job Ops Core

- Role profiles.
- Job ingestion and parsing.
- Job scoring.
- Claim matching.
- Claims Ledger CRUD.
- Base resume management with immutable history.
- DOCX/PDF base resume import.
- Resume tailoring with full draft text and base resume version traceability.
- Cover letter drafting.
- Resume and cover letter approval/rejection state machines.
- Application tracker.
- Feedback signals.
- Event logs.
- AI model config/fallback routing.

### AI Pipelines

- OpenRouter integration.
- Per-task model routing through `ai_model_configs`.
- Prompt-version override through `ai_prompt_versions`.
- AI event logging with model, prompt version, tokens, cost, and fallback metadata.
- JD parse pipeline.
- claim_generation pipeline for AI Draft Claims.
- resume_tailoring pipeline using current base resume + truth-lock claims.
- cover_letter pipeline using claim-attributed paragraphs.
- proposal_drafting pipeline for freelance proposal drafts.

### Dashboard

- Dashboard overview.
- Jobs Pipeline.
- Job Detail with AI actions.
- Claims Ledger with AI Draft Claims.
- Base Resume with text editor, history, restore, DOCX/PDF import.
- Resumes Queue.
- Cover Letters Queue.
- Applications.
- Feedback Signals.
- Role Profiles.
- AI Config.
- AI Review.
- Assisted Apply.
- Freelance Copilot.
- Account.
- Guide.

## Completed Smart AI Foundation

- `ai_prompt_versions`: versioned prompts for task scopes.
- `ai_run_evaluations`: human/system review records for AI outputs.
- `ai_training_examples`: curated examples for future few-shot/eval/fine-tune use.
- `feedback_signals` extended for richer attribution.
- `/ai-review/overview` dashboard/API surface.

Current learning strategy is supervised prompt/eval/outcome learning, not fine-tuning.

## Completed M002 Regression Audit & Stabilization (April 20, 2026)

- Identified root cause: database schema drift between runtime code expectations and actual DB state.
- Created `lib/db/runtime-compat.sql` - consolidated compatibility patch for:
  - M002 lineage columns: `event_logs.run_id`, `resume_versions.run_id/event_log_id`, `cover_letter_versions.run_id/event_log_id`, `feedback_signals` runtime columns
  - `ai_prompt_versions` and `ai_run_evaluations` tables with indexes
  - Assisted Apply tables: `site_adapters`, `application_sessions`, `application_form_fields`, `application_actions`
  - Freelance Copilot tables: `freelance_profiles`, `project_sources`, `freelance_projects`, `proposal_versions`, `proposal_outcomes`, `client_message_templates`
- Fixed migration helper (`apply-migration.mjs`) to use pg Pool.query for reliable multi-statement SQL execution.
- Added `compat` npm script to `@workspace/db` package.
- Added missing unique index `ai_run_evaluations_run_scope_entity_uidx` required by approval/rejection upserts.
- Mounted `aiMetricsSnapshotRouter` in main API router (was defined but not wired).
- Hardened AI Metrics frontend (`toBucketRows`) against undefined snapshot data - prevents page crash on backend errors.
- Verification: full workspace typecheck passes, 5 targeted tests pass across 3 test files.

## Completed Assisted Apply Foundation

- `site_adapters`
- `application_sessions`
- `application_form_fields`
- `application_actions`
- Assisted Apply dashboard page.
- Human-checkpoint and safety-policy metadata.

Not yet built:

- Browser extension.
- Playwright worker.
- Site-specific field adapters.
- Credential vault.
- Automated form fill.
- Final submission automation.

## Completed Freelance Copilot Foundation

- `freelance_profiles`
- `project_sources`
- `freelance_projects`
- `proposal_versions`
- `proposal_outcomes`
- `client_message_templates`
- project fit scoring heuristic
- proposal drafting AI pipeline
- Freelance Copilot dashboard page

Not yet built:

- Official Upwork API integration.
- Browser extension capture.
- Upwork outcome analytics.
- Advanced bid optimization.

## Current Verification

Latest verification run:

```powershell
corepack pnpm run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/dashboard run build
```

Status:

- Full workspace typecheck passes.
- API production build passes.
- Dashboard production build passes with existing Vite sourcemap/chunk-size warnings.

## Required Before Testing Latest Features

Push schema to the configured database:

```powershell
corepack pnpm --filter @workspace/db run push
```

Or if schema drift causes push to fail:

```powershell
corepack pnpm --filter @workspace/db run compat
```

Then smoke test:

- login/session
- base resume save/import/restore
- AI Draft Claims
- job parse/score/tailor/cover letter
- approval/rejection conflict behavior
- AI Review prompt version creation
- Assisted Apply session creation
- Freelance profile/project/proposal flow

## Next Engineering Priorities

1. ~~Run schema push and local/Neon smoke test.~~ ✓ Completed
2. ~~Commit/push latest feature set.~~ ✓ Completed - M002 regression audit fixes applied
3. ~~Apply `runtime-compat.sql` to production database~~ ✓ Completed - applied via SQL editor
4. ~~Browser test: Assisted Apply, Freelance Copilot, Resume Queue, AI Metrics pages~~ ✓ Completed - no console errors
5. Add richer AI evaluation forms and training-example promotion UI.
6. Add export/copy/PDF for approved documents/proposals.
7. Build browser extension MVP for user-opened page capture.
8. Build Playwright apply-worker only for whitelisted/permitted ATS flows.
9. Add outcome analytics correlating claims, prompt versions, models, and applications/proposals.
