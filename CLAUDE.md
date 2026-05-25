# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Follow `AGENTS.md` as the canonical repository instruction file.

Superpowers is enabled for this workspace. Use relevant Superpowers skills through the Skill tool before acting when a skill may apply.

Do not duplicate or summarize Superpowers skill contents here. Invoke the current installed skill version instead.

## What This Is

**Job Ops** — a single-user, human-in-the-loop job application operations platform. Every AI output requires explicit human approval before use. The core invariant is **truth-lock**: AI-generated content (resumes, cover letters, proposals) must cite verified claims from the Claims Ledger; structurally invalid citations are dropped at the API level.

## Commands

```bash
# Development
pnpm run dev              # API (port 8080) + Dashboard (port 5173) in parallel

# Build & Typecheck
pnpm run build            # Full typecheck + build all artifacts
pnpm run typecheck        # TypeScript check across entire workspace

# Database
pnpm --filter @workspace/db run push      # Push Drizzle schema to PostgreSQL
pnpm --filter @workspace/db run generate  # Generate Drizzle migrations

# API Code Generation (run after editing openapi.yaml)
pnpm --filter @workspace/api-spec run codegen   # Regenerate Zod schemas + React Query hooks

# Testing
pnpm run smoke:test       # Smoke tests against a running instance
# Vitest: cd artifacts/api-server && pnpm test
# Playwright: cd artifacts/dashboard && pnpm exec playwright test
```

## Code Search

Use `semble search` to find code by describing what it does or naming a symbol/identifier, instead of grep:

```bash
semble search "authentication flow" ./my-project
semble search "save_pretrained" ./my-project
semble search "save model to disk" ./my-project --top-k 10
```

If you anticipate doing more than one search, use `semble index` to create an index.

```bash
semble index ./my-project -o my_index
```

You can then reuse this index later on:

```bash
semble search "save_pretrained" --index my_index
```

An index is not automatically updated, so if the code changes significantly, reindex. If you notice stale results while resolving searches to files, reindex.

Use `--content docs` to search documentation and prose, `--content config` for config files (yaml, toml, etc.), or `--content all` to search code, docs, and config:

```bash
semble search "deployment guide" ./my-project --content docs
semble search "database host port" ./my-project --content config
semble search "authentication" ./my-project --content all
```

Use `semble find-related` to discover code similar to a known location (pass `file_path` and `line` from a prior search result):

```bash
semble find-related src/auth.py 42 ./my-project
```

Like search, `find-related` also accepts an `--index` argument.

`path` defaults to the current directory when omitted; git URLs are accepted.

If `semble` is not on `$PATH`, use `uvx --from "semble[mcp]" semble` in its place.

### Search Workflow

1. Index the repo using `semble index -o cached_index`.
2. Start with `semble search` to find relevant chunks. Pass the index to achieve results faster.
3. Use `--content docs` for documentation, `--content config` for config files, or `--content all` for everything.
4. Inspect full files only when the returned chunk does not give enough context.
5. Optionally use `semble find-related` with a promising result's `file_path` and `line` to discover related implementations.
6. Use grep only when you need exhaustive literal matches or quick confirmation of an exact string.

## Architecture

Pnpm monorepo with three tiers:

```
Browser (React 19 + TanStack Query)
  ↓ /api/* (generated hooks from lib/api-client-react/)
Express 5 API (artifacts/api-server/, port 8080)
  ↓ Zod validation (generated from lib/api-zod/)
PostgreSQL (Drizzle ORM, ~45 tables)
```

**Spec-first API** — `lib/api-spec/openapi.yaml` is the single source of truth. [Orval](https://orval.dev/) generates:
- `lib/api-zod/src/generated/` — Zod request/response validators
- `lib/api-client-react/src/generated/` — TanStack Query hooks

Never hand-edit files in those `generated/` directories. After changing `openapi.yaml`, run codegen.

### Key Directories

| Path | Purpose |
|------|---------|
| `artifacts/api-server/src/routes/` | ~35 Express route modules |
| `artifacts/api-server/src/lib/pipelines/` | AI task pipelines (resume-tailor, cover-letter-draft, jd-parse, etc.) |
| `artifacts/api-server/src/lib/` | AI client, model router, prompt router, learning processor |
| `artifacts/dashboard/src/pages/` | ~34 React page modules |
| `lib/db/src/schema/` | All Drizzle table definitions |
| `lib/api-spec/openapi.yaml` | REST API specification (source of truth) |

### AI Runtime

Ten specialized agent roles (Resume Expert, Cover Letter Strategist, Application Analyst, Fact Reviewer, Resume Profile Builder, etc.) each have database-configurable prompts and model assignments via `ai_model_configs` + `ai_prompt_versions`. The runtime falls back to in-code `SYSTEM_PROMPT` constants when no DB config exists.

**Closed learning loop:**
1. AI generates output → logged to `event_logs`
2. User approves/rejects → `ai_run_evaluations`
3. Application outcomes → `feedback_signals`
4. `learning-processor.runRecompute()` → aggregates into `ai_variant_stats`
5. Bayesian comparison (`bayesian-compare.ts`) → `ai_variant_comparisons` (Win probability)
6. Dashboard leaderboard shows promote suggestions (gates: 0.95 confidence, 10+ samples, 5% margin)

Key AI files: `lib/ai-client.ts`, `lib/prompt-router.ts`, `lib/model-router.ts`, `lib/learning-processor.ts`, `lib/bayesian-compare.ts`.

### Database Domains

Nine domains across ~45 tables: Job Search, Audit/Learning, Assisted Apply, Freelance Copilot, Auth/User Management, Chat, Gamification, Job Board, Platform/UX (onboarding, wizard sessions, feedback, best practices).

### State Machine Contracts

`resume_versions`, `cover_letter_versions`, and `proposal_versions` follow strict transitions: `pending_approval → approved | rejected`. Re-approving/rejecting an already-decided entity returns 409.

## Environment

Copy `.env.example` to `.env`. Required variables:

```
DATABASE_URL=postgresql://...
SESSION_SECRET=<32+ random chars>
AI_INTEGRATIONS_OPENROUTER_API_KEY=sk-or-v1-...
AI_INTEGRATIONS_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
ADMIN_USERNAME=admin        # first-run bootstrap only — remove after login
ADMIN_PASSWORD=<password>   # first-run bootstrap only
ADMIN_EMAIL=<email>         # first-run bootstrap only
```

Node.js **24.x** (Current, not LTS) + pnpm **10.x** via Corepack is required.

## Conventions

- **TypeScript strict mode** everywhere (`tsconfig.base.json`). No `any`, no `as unknown as T`.
- **`@workspace/*` imports** — use workspace package names, not relative paths across packages.
- Route handlers must validate input with the generated Zod schemas from `lib/api-zod/`.
- All AI calls go through `callAI()` in `lib/ai-client.ts` — never call OpenRouter directly from routes.
- Immutable resume history: every save creates a new `base_resume_versions` row; "restore" clones.
- Truth-lock: AI outputs referencing claim IDs that don't exist in the user's ledger must be dropped at the pipeline level, not just via prompt instruction.
