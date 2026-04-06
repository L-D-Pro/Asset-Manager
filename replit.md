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

## Architecture Notes

- Claims Ledger is the truth lock: all resume bullets must map to approved claims
- AI calls are abstracted behind a provider-agnostic interface (Task 3)
- All decisions are logged to event_logs for full auditability
- Human approval required for all AI-generated content before use
- `lib/api-zod/src/index.ts` exports only `./generated/api` to avoid duplicate exports

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
