# Changelog

All notable changes to the Job Ops platform.

## Unreleased

### Added
- **Trends & Market Research Hub** (`/trends`): AI-powered market analysis for any job title, including skills demand, certifications, salary insights, and personalized action plans.
- **Job Board Aggregation**: Background RSS/Atom feed aggregator that collects real job listings from configured sources. Configure via `JOB_SOURCE_CONFIG` env var.
- **Trends Cache**: 24-hour caching of AI-generated market research to reduce API costs.
- New sidebar navigation item: "Trends"

## Version 0.3 (April 22, 2026)

### Apply Wizard Model Comparison

- Added wizard-tailor custom comparison mode with up to 3 OpenRouter models per artifact (resume and cover letter compared independently).
- Added hybrid model picker support via `GET /ai-model-catalog`:
  - searches full OpenRouter catalog
  - marks configured models and current resume/cover defaults from AI Config
- Added compare endpoints:
  - `POST /jobs/:id/compare/resume`
  - `POST /jobs/:id/compare/cover-letter`
- Added winner-promotion endpoints:
  - `POST /jobs/:id/compare/promote-resume`
  - `POST /jobs/:id/compare/promote-cover-letter`
- Added per-call model override support so wizard comparison does not mutate global AI routing defaults.
- Comparison metadata is now logged to `event_logs` for auditability; only promoted winners remain in normal resume/cover queues.
- Apply Wizard route behavior updated so `/apply-wizard` remains registered and shows a disabled notice card when the feature flag is off.

## Version 0.2 (April 20, 2026)

### M002 Regression Audit & Stabilization

**Problem:** After implementing the M002 "Canonical run lineage enforcement" milestone, multiple app pages began failing with 500 errors and runtime crashes. Instead of fixing issues one-by-one, a comprehensive audit identified shared root causes.

**Root Cause:** Database schema drift between runtime code expectations and the actual database state. The M002 work added new schema requirements that exposed pre-existing drift in Assisted Apply, Freelance Copilot, and AI Metrics features.

**Solution:** Batch implementation of code-side fixes and a consolidated database compatibility patch.

#### Code Changes

- **Database Compatibility Patch** (`lib/db/runtime-compat.sql`)
  - Single SQL file covering all missing tables and columns
  - Uses `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` for idempotency
  - Covers M002 lineage, Assisted Apply, Freelance Copilot, and AI metrics support tables

- **Migration Helper Fix** (`lib/db/apply-migration.mjs`)
  - Switched from Drizzle ORM `db.execute()` to raw `pg.Pool.query()`
  - Multi-statement SQL now executes reliably

- **New npm Script** (`lib/db/package.json`)
  - `pnpm --filter @workspace/db run compat` - executes the runtime compatibility patch

- **Schema Fix** (`lib/db/src/schema/ai-run-evaluations.ts`)
  - Added missing unique index `ai_run_evaluations_run_scope_entity_uidx`
  - Required by `onConflictDoUpdate` upsert operations in approval/rejection flows

- **Backend Route Fix** (`artifacts/api-server/src/routes/index.ts`)
  - Mounted `aiMetricsSnapshotRouter` (was defined but not wired to API)

- **Frontend Hardening** (`artifacts/dashboard/src/pages/ai-metrics/index.tsx`)
  - `toBucketRows()` now guards against undefined/null snapshot
  - Prevents page crash when backend returns error or missing data

#### Database Schema Coverage

**M002 Lineage Enforcement:**
- `event_logs.run_id` column and index
- `resume_versions.run_id`, `resume_versions.event_log_id` columns and indexes
- `cover_letter_versions.run_id`, `cover_letter_versions.event_log_id` columns and indexes
- `feedback_signals` runtime columns: `job_id`, `role_profile_id`, `base_resume_version_id`, `cover_letter_version_id`, `prompt_version_id`, `model_name`, `selected_claim_ids`, `final_result`, `run_id`, `event_log_id`

**AI Metrics Support:**
- `ai_prompt_versions` table with indexes
- `ai_run_evaluations` table with all columns and indexes including unique constraint

**Assisted Apply:**
- `site_adapters` table
- `application_sessions` table
- `application_form_fields` table
- `application_actions` table

**Freelance Copilot:**
- `freelance_profiles` table
- `project_sources` table
- `freelance_projects` table
- `proposal_versions` table
- `proposal_outcomes` table
- `client_message_templates` table

#### Verification Results

- Full workspace typecheck: **PASS**
- Targeted API tests (3 files, 5 tests): **PASS**
  - `ai-metrics-snapshot-route.test.ts`
  - `approval-evaluation-capture.test.ts`
  - `lineage-enforcement.test.ts`

#### Manual Steps Still Required

Apply the compatibility patch to production database:

```powershell
$env:DATABASE_URL="your-neon-url"
corepack pnpm --filter @workspace/db run compat
```

Or execute `lib/db/runtime-compat.sql` directly in Neon SQL editor.

---

## Version 0.1 (April 16, 2026)

### Initial Release

**Core Platform:**
- pnpm monorepo with Node 24 and TypeScript 5.9
- Drizzle/PostgreSQL schema package
- OpenAPI source of truth with Orval code generation
- Express 5 API bundled by esbuild
- React/Vite/Tailwind dashboard

**Auth and Production:**
- Session auth with express-session and connect-pg-simple
- Admin bootstrap from env vars
- Password hashing with bcryptjs
- TOTP 2FA with speakeasy
- Recovery codes
- DigitalOcean deployment docs

**Job Ops Core:**
- Role profiles, job ingestion, parsing, scoring
- Claims Ledger with AI Draft Claims
- Base resume with immutable history and DOCX/PDF import
- Resume tailoring with truth-lock claim attribution
- Cover letter drafting with claim-attributed paragraphs
- Resume and cover letter approval/rejection state machines
- Application tracker and feedback signals

**AI Pipelines:**
- OpenRouter integration
- Per-task model routing through `ai_model_configs`
- Prompt-version override through `ai_prompt_versions`
- JD parse, claim generation, resume tailoring, cover letter, proposal drafting pipelines

**Assisted Apply Foundation:**
- `site_adapters`, `application_sessions`, `application_form_fields`, `application_actions`
- Dashboard page for safe human-checkpoint sessions

**Freelance Copilot Foundation:**
- `freelance_profiles`, `project_sources`, `freelance_projects`
- `proposal_versions`, `proposal_outcomes`, `client_message_templates`
- Project fit scoring and proposal drafting

**Dashboard Pages:**
- Dashboard overview, Jobs Pipeline, Job Detail
- Claims Ledger, Base Resume
- Resumes Queue, Cover Letters Queue
- Applications, Feedback Signals
- Role Profiles, AI Config, AI Review
- Assisted Apply, Freelance Copilot
- Account settings, Guide
