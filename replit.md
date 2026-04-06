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
1. `selectModelForTask(scope)` resolves the active model via fallback chain
2. `callAI()` calls OpenRouter, retries on failure (up to 2x), logs token usage + cost to EventLog
3. Each pipeline formats prompts with job + claim context, parses JSON response, persists results
4. All AI output goes to `pending_approval` status — human must approve before use

## Architecture Notes

- Claims Ledger is the truth lock: all resume bullets must map to approved claims
- AI pipelines use OpenRouter via `@workspace/integrations-openrouter-ai`
- All AI calls are cost-logged to event_logs with token counts and estimated USD
- Human approval required for all AI-generated content before use
- `lib/api-zod/src/index.ts` exports only `./generated/api` to avoid duplicate exports
- `lib/db/src/schema/index.ts` exports `conversations` and `messages` tables (for future AI chat history)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
