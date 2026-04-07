# Task Status

Build history for the four planned implementation phases. All four tasks are complete.

## Task #1 — Foundation: Schema, Data Models & OpenAPI Spec

**Status: COMPLETE**

**What it delivers**:
- Full PostgreSQL schema via Drizzle ORM (11 tables): `role_profiles`, `jobs`, `claims`, `resume_versions`, `cover_letter_versions`, `applications`, `event_logs`, `feedback_signals`, `ai_model_configs`, `conversations`, `messages`
- All table schemas with constraints, indexes, relationships, and `drizzle-zod` insert schemas
- OpenAPI spec (`lib/api-spec/openapi.yaml`) with 55+ endpoint definitions covering all CRUD operations and AI-trigger routes
- Orval codegen config generating two downstream packages: `@workspace/api-client-react` (TanStack Query hooks) and `@workspace/api-zod` (Zod validation schemas)

**Key files**: `lib/db/src/schema/*.ts`, `lib/api-spec/openapi.yaml`, `lib/api-spec/orval.config.ts`

---

## Task #2 — Backend API: Route Handlers & Business Logic

**Status: COMPLETE**

**What it delivers**:
- Express 5 application (`artifacts/api-server/`) with all route handlers wired
- Full CRUD for all 9 entities
- Application stats endpoint (`GET /api/applications/stats`)
- Job scoring endpoint (`GET /api/jobs/:id/score`) — evaluates a job against a role profile's hard filters and soft weights
- Claim matching endpoint (`GET /api/jobs/:id/claim-matches`) — ranks all active claims by relevance to a job's parsed JD
- Approve/reject state machine endpoints for resume versions and cover letter versions
- EventLog immutable audit trail (read-only API)
- Zod-based request validation using generated schemas from `@workspace/api-zod`

**Key files**: `artifacts/api-server/src/routes/*.ts`, `artifacts/api-server/src/lib/scoring.ts`

---

## Task #3 — AI Router & Claims Ledger Pipelines

**Status: COMPLETE**

**What it delivers**:
- OpenRouter AI integration via `@workspace/integrations-openrouter-ai`
- `selectModelForTask()` — per-task model routing with priority ordering, fallback chain, and default-scope catch-all
- `callAI()` — full model chain execution with per-attempt EventLog cost logging (token counts + estimated USD)
- JD parse pipeline (`jd-parse.ts`) — AI-extracts structured fields from raw JD text
- Resume tailor pipeline (`resume-tailor.ts`) — matches claims to JD, generates bullet-attributed tailored resume, validates all claim IDs against the Claims Ledger (truth lock)
- Cover letter pipeline (`cover-letter-draft.ts`) — generates annotated paragraphs with paragraph-level claim attribution
- Truth-lock validation (`validation.ts`) — `validateBullet()`, `validateParagraph()`, `validateClaimIds()`, `TruthLockViolation` error class

**Dependency on Task #2**: requires route handlers to wire the AI trigger endpoints; requires the DB schema from Task #1.

**Key files**: `artifacts/api-server/src/lib/ai-client.ts`, `artifacts/api-server/src/lib/model-router.ts`, `artifacts/api-server/src/lib/pipelines/*.ts`

---

## Task #4 — React Dashboard: Job Ops Admin UI

**Status: COMPLETE**

**What it delivers**:
- React + Vite SPA (`artifacts/dashboard/`) with 10 pages + 404
- Full sidebar layout with react-router-dom routing
- Dashboard overview with application stats cards
- Jobs Pipeline: filterable job list, create form, per-role-profile score chips, link to job detail
- Job Detail: raw JD display, AI trigger buttons (parse/tailor/cover letter), score display, claim match list
- Claims Ledger: full CRUD, phrasing variants editor (useFieldArray), applicable tags editor, domain filter, active/inactive tabs
- Resume Queue: per-change diff review with thumbs-up/thumbs-down per bullet, approval blocked until all decisions made, decisions persisted to `notes` field on version record
- Cover Letter Queue: annotated paragraph view with claim attribution pills, request-revision dialog (note stored to `notes` field before rejection)
- Applications Tracker: pipeline stage management
- Role Profiles: hard filters editor (required/blocked keywords, min salary), soft weights dynamic array
- AI Model Config: per-task model config CRUD with custom task scope input (separate `isCustomScope` state)
- Feedback Signals: create/list outcome signals with notes

**Dependency on Tasks #1–#3**: requires the complete API to be running; uses `@workspace/api-client-react` generated hooks exclusively.

**Key files**: `artifacts/dashboard/src/App.tsx`, `artifacts/dashboard/src/pages/**/*.tsx`, `artifacts/dashboard/src/components/layout/sidebar.tsx`

---

## Dependency Chain

```
Task #1 (Schema + Spec)
    ↓
Task #2 (Route Handlers) — depends on #1 for DB schema and generated Zod schemas
    ↓
Task #3 (AI Pipelines) — depends on #2 for wired routes and DB client
    ↓
Task #4 (Dashboard) — depends on #1 for generated API hooks; exercises #2 and #3 via API calls
```

Tasks #1 through #3 must complete in order (each depends on the previous). Task #4 requires #1 for the generated React hooks but can be developed in parallel with #2 and #3 if the spec is stable.
