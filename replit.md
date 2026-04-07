# Job Application Operations Platform

## Overview

A private, human-in-the-loop AI job application copilot. NOT a mass auto-apply bot. Designed for quality, truthfulness, and compliance. Built backend-first with OpenRouter-based AI routing.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Data Model

Core entities (all in `lib/db/src/schema/`):

| Entity | Table | Purpose |
|--------|-------|---------|
| `RoleProfile` | `role_profiles` | Named search profiles with hard filters and soft skill weights |
| `Job` | `jobs` | Ingested job postings with parsed JD data |
| `Claim` | `claims` | Claims Ledger — atomic factual units (truth lock system) |
| `ResumeVersion` | `resume_versions` | Tailored resume versions with claim attribution and diff data |
| `CoverLetterVersion` | `cover_letter_versions` | Cover letter drafts with paragraph-level claim attribution |
| `Application` | `applications` | Application records with full lifecycle tracking |
| `EventLog` | `event_logs` | Immutable audit log of all state changes |
| `FeedbackSignal` | `feedback_signals` | Outcome signals that drive self-learning |
| `AiModelConfig` | `ai_model_configs` | Per-task AI model routing config (OpenRouter) |

## OpenAPI Routes

Defined in `lib/api-spec/openapi.yaml`. Key endpoint groups:

- `/role-profiles` — CRUD
- `/jobs` — CRUD + `/parse` (AI) + `/score` + `/claim-matches` + `/tailor` (AI) + `/cover-letter` (AI)
- `/claims` — CRUD
- `/resume-versions` — CRUD + `/approve` + `/reject`
- `/cover-letter-versions` — CRUD + `/approve` + `/reject`
- `/applications` — CRUD + `/stats`
- `/event-logs` — Read-only
- `/feedback-signals` — CRUD
- `/ai-model-configs` — CRUD

## AI Pipeline (Task 3 — COMPLETE)

OpenRouter integration wired. Model: `anthropic/claude-3.5-haiku` for all task scopes.

### AI task scopes seeded in `ai_model_configs`:
- `jd_parsing` — Claude 3.5 Haiku, 4096 tokens, $0.0000008/$0.000004 per in/out token
- `resume_tailoring` — Claude 3.5 Haiku, 8192 tokens
- `cover_letter` — Claude 3.5 Haiku, 4096 tokens

### Pipeline files:
- `artifacts/api-server/src/lib/ai-client.ts` — OpenRouter caller with retry logic and cost logging to EventLog
- `artifacts/api-server/src/lib/pipelines/jd-parse.ts` — JD parse pipeline
- `artifacts/api-server/src/lib/pipelines/resume-tailor.ts` — Resume tailoring pipeline
- `artifacts/api-server/src/lib/pipelines/cover-letter-draft.ts` — Cover letter draft pipeline

### How it works:
1. `selectModelForTask(scope)` resolves the active model via fallback chain from `ai_model_configs`
2. `callAI()` builds the full fallback model chain, calls each in turn on failure, logs every attempt (success AND failure) to EventLog
3. Each pipeline formats prompts with job + claim context, parses JSON response, runs truth-lock validation, persists results
4. All AI output goes to `pending_approval` status — human must approve before use
5. Approve/reject transitions enforce state machine: only `pending_approval` → `approved`/`rejected`; returns HTTP 409 otherwise

### OpenRouter env vars
The integration uses `AI_INTEGRATIONS_OPENROUTER_BASE_URL` and `AI_INTEGRATIONS_OPENROUTER_API_KEY`
(provisioned by the Replit OpenRouter integration), **not** a bare `OPENROUTER_API_KEY`.
The `openrouter` client reads these automatically via `@workspace/integrations-openrouter-ai`.

## Architecture Notes

- Claims Ledger is the truth lock: all resume bullets must map to approved claims
- AI pipelines use OpenRouter via `@workspace/integrations-openrouter-ai`
- All AI calls are cost-logged to event_logs with token counts and estimated USD
- Human approval required for all AI-generated content before use
- `lib/api-zod/src/index.ts` exports only `./generated/api` to avoid duplicate exports
- `lib/db/src/schema/index.ts` exports `conversations` and `messages` tables (for future AI chat history)

## React Dashboard (Task 4 — COMPLETE)

Built at `artifacts/dashboard/` — React + Vite + Tailwind + shadcn UI.
Preview path: `/` (port 23183).

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard: stats cards (total apps, interview rate, response rate, active jobs) |
| `/jobs` | Jobs Pipeline: filterable list, create form |
| `/jobs/:id` | Job Detail: JD, AI triggers (parse/tailor/cover letter), score, claim matches |
| `/claims` | Claims Ledger: full CRUD for truth-lock claims |
| `/resume-versions` | Resume Queue: pending AI-tailored resumes with approve/reject |
| `/cover-letters` | Cover Letter Queue: pending AI cover letters with approve/reject |
| `/applications` | Application Tracker: track submitted apps and pipeline stage |
| `/role-profiles` | Role Profiles: CRUD for target scoring profiles |
| `/ai-config` | AI Model Config: manage per-task model configs |
| `/feedback` | Feedback Signals: log interview/rejection/offer outcomes |

### Key implementation details
- API hooks imported from `@workspace/api-client-react` (Orval-generated, Tanstack Query)
- All fetch calls include `credentials: "include"` for session cookies (set in `lib/api-client-react/src/custom-fetch.ts`)
- Loading states on all slow AI mutation triggers (parse, tailor, draft)
- Human-in-the-loop approve/reject flows are the primary user actions
- All interactive elements have data-testid attributes

## Authentication (COMPLETE)

Private session-based auth. Single admin user only.

### Stack
- **Backend**: `express-session` + `connect-pg-simple` (PostgreSQL session store) + `bcryptjs` (password hashing, cost 12) + `speakeasy` (TOTP 2FA)
- **Frontend**: `AuthContext` + protected routes via `ProtectedRoutes` component

### Pages / Routes

| Route | Description |
|-------|-------------|
| `/login` | Login page (outside MainLayout, always accessible) |
| `/account` | Account management — change password, email, enable/disable 2FA |

### API Endpoints (all at `/api/auth/...`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/login` | public | Password login, returns `{totpRequired: true}` if 2FA active |
| POST | `/auth/login/totp` | partial | Complete 2FA login with TOTP code or recovery code |
| POST | `/auth/logout` | public | Destroys session, clears cookie |
| GET | `/auth/me` | public | Returns current user or 401 |
| PUT | `/auth/password` | protected | Change password (requires current password) |
| PUT | `/auth/email` | protected | Change email address |
| POST | `/auth/2fa/setup` | protected | Generate TOTP secret + QR code |
| POST | `/auth/2fa/enable` | protected | Confirm setup with TOTP code, returns 8 recovery codes |
| POST | `/auth/2fa/disable` | protected | Disable 2FA (requires TOTP confirmation) |
| POST | `/auth/2fa/regenerate-codes` | protected | Regenerate 8 recovery codes (requires TOTP) |

### DB Tables
- `admin_users` — single admin user: `username`, `email`, `password_hash`, `totp_secret`, `totp_enabled`, `totp_recovery_codes` (hashed JSON array)
- `session` — express-session store (connect-pg-simple managed)

### Key files
- `lib/db/src/schema/admin-users.ts` — schema
- `artifacts/api-server/src/app.ts` — session middleware config
- `artifacts/api-server/src/middlewares/auth.ts` — `requireAuth` middleware
- `artifacts/api-server/src/routes/auth.ts` — all auth routes
- `artifacts/api-server/src/index.ts` — admin user bootstrap on startup
- `artifacts/dashboard/src/context/auth.tsx` — AuthContext with login/logout/verifyTotp
- `artifacts/dashboard/src/pages/login/index.tsx` — Login + TOTP verification UI
- `artifacts/dashboard/src/pages/account/index.tsx` — Account management page

### Environment Variables Required
- `SESSION_SECRET` — random secret for signing sessions (already provisioned as a Replit secret)

### Admin User Bootstrap
On first startup, the server auto-creates the admin user from env vars:
- `ADMIN_USERNAME` + `ADMIN_PASSWORD` (≥12 chars) + `ADMIN_EMAIL`
- After creation, delete these vars from environment for security
- The current admin user: username `admin`, email `admin@jobops.local` (created at deploy time)

### Security Notes
- Sessions expire after 7 days; `httpOnly`, `SameSite: lax` (dev) / `strict` (prod)
- Timing-attack-safe login (bcrypt runs even for nonexistent users)
- 8 bcrypt-hashed single-use recovery codes for 2FA lockout scenarios
- All protected API routes return 401 with `{"error":"Unauthorized"}` — no route enumeration

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
