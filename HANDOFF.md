# Job Application Operations Platform — Handoff Guide

## What This Is

A private, human-in-the-loop AI job application copilot. It is **not** a mass auto-apply bot. Every AI-generated output requires explicit human approval before it is used. The platform optimizes for quality, truthfulness, and long-term account safety.

Core philosophy:
- **No hallucinations**: resume content must trace back to verified user claims in the Claims Ledger.
- **Human in the loop**: all AI outputs sit in `pending_approval` state until the user approves or rejects.
- **Explainability**: every decision, cost, state change, and AI call is logged to `event_logs`.
- **Compliance-aware**: no bypassing platform protections, no fabricating experience.

## Who This Is For

A single user (the job seeker) using the admin dashboard as their operations centre. There is no multi-tenancy or public-facing surface.

## Repo Layout

```
/                          — Root workspace (pnpm monorepo)
├── artifacts/
│   ├── api-server/        — Express 5 API server (@workspace/api-server)
│   └── dashboard/         — React + Vite admin UI (@workspace/dashboard)
├── lib/
│   ├── db/                — Drizzle ORM schema + client (@workspace/db)
│   ├── api-spec/          — OpenAPI spec + Orval codegen config
│   ├── api-client-react/  — Orval-generated TanStack Query hooks (@workspace/api-client-react)
│   ├── api-zod/           — Orval-generated Zod validation schemas (@workspace/api-zod)
│   └── integrations/
│       └── integrations-openrouter-ai/  — OpenRouter AI client (@workspace/integrations-openrouter-ai)
├── scripts/               — One-off utility scripts
├── HANDOFF.md             — This file
├── ARCHITECTURE.md        — Package graph, request lifecycle, design decisions
├── DATA_MODEL.md          — Full Drizzle table reference (in lib/db/)
├── AI_PIPELINE.md         — OpenRouter integration, pipelines, truth-lock, approval flow
├── API_CONTRACT.md        — OpenAPI spec-first workflow, endpoint inventory (in lib/api-spec/)
├── CONVENTIONS.md         — TypeScript setup, naming, shared patterns, error handling
├── TASK_STATUS.md         — Build phase history and current state
├── replit.md              — Living project memory (stack, commands, key details)
├── package.json           — Root workspace scripts
├── pnpm-workspace.yaml    — pnpm workspace config + security policy
└── tsconfig.json          — Root TypeScript project references
```

## How to Run

**Prerequisites**: Node.js 24, pnpm. Environment variables `DATABASE_URL`, `PORT`, `BASE_PATH`, `AI_INTEGRATIONS_OPENROUTER_BASE_URL`, `AI_INTEGRATIONS_OPENROUTER_API_KEY` must be set (Replit provisions these automatically).

```bash
# Install all dependencies
pnpm install

# Push the DB schema to PostgreSQL (dev only — never in production)
pnpm --filter @workspace/db run push

# Run the API server (port from $PORT env var)
pnpm --filter @workspace/api-server run dev

# Run the React dashboard (port from $PORT env var)
pnpm --filter @workspace/dashboard run dev

# Regenerate API hooks + Zod schemas after editing openapi.yaml
pnpm --filter @workspace/api-spec run codegen

# Full typecheck across all packages
pnpm run typecheck

# Build all packages
pnpm run build
```

## Documentation Map

| Document | Location | What it covers |
|----------|----------|----------------|
| `HANDOFF.md` | `/` | This file — entry point, layout, setup |
| `ARCHITECTURE.md` | `/` | Package graph, request lifecycle, AI flow, design rationale |
| `DATA_MODEL.md` | `lib/db/` | Every Drizzle table, columns, constraints, relationships |
| `AI_PIPELINE.md` | `/` | OpenRouter integration, pipelines, truth-lock, approval cycle |
| `API_CONTRACT.md` | `lib/api-spec/` | Spec-first workflow, endpoint inventory, Zod validation |
| `CONVENTIONS.md` | `/` | TypeScript, naming, error handling, env vars, shared libs |
| `TASK_STATUS.md` | `/` | Build task history and completion state |
| `replit.md` | `/` | Living memory — stack, commands, key implementation details |
