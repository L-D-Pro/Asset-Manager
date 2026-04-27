# Job Ops

> A single-user, human-in-the-loop job application operations platform. Not a mass auto-apply bot. Every AI output must be reviewed before use.

[![Node 24](https://img.shields.io/badge/node-%3E%3D24.x-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript 5.9](https://img.shields.io/badge/typescript-5.9-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![pnpm 10.x](https://img.shields.io/badge/pnpm-10.x-f69220?logo=pnpm)](https://pnpm.io/)
[![License MIT](https://img.shields.io/badge/license-MIT-green)](./package.json)

---

## What is Job Ops

Job Ops helps you run a careful, truthful job search with AI assistance — not automation. It maintains a verified factual Claims Ledger that serves as the boundary for all AI-generated content. Every resume, cover letter, and proposal is drafted with claim-level attribution and requires your explicit approval before use.

## Core Principles

- **Quality over quantity** — one great application beats fifty spray-and-pray submissions
- **Truthfulness over embellishment** — AI rephrases claims but never invents unsupported achievements
- **Human approval before use** — no output leaves the platform without your review
- **Full auditability** — every AI call and state change is logged to `event_logs`
- **Account safety** — the platform respects site terms and never automates logins, submissions, or CAPTCHA bypass

## Feature Status

| Area | Status | Description |
| --- | --- | --- |
| Session Auth | Ready | Admin bootstrap, login/logout, TOTP 2FA, recovery codes |
| Base Resume | Ready | Immutable version history, DOCX/PDF import, restore |
| Claims Ledger | Ready | Manual and AI-drafted verified claims |
| Jobs Pipeline | Ready | JD ingest, parse, score, claim matching |
| Resume Tailoring | Ready | Truth-locked claim-attributed tailoring with approval gate |
| Cover Letters | Ready | Claim-attributed paragraphs with approval state machine |
| Apply Wizard | Ready (flagged) | Guided single-job flow with custom model comparison |
| AI Learning | Ready | Prompt versions, evaluations, Bayesian variant comparison, leaderboard |
| AI Review | Foundation ready | Run evaluations, training examples, prompt versioning |
| Assisted Apply | Foundation ready | Scaffolded session/action records; no browser worker |
| Freelance Copilot | Foundation ready | Profiles, project scoring, proposal drafting |
| External auto-submit | Not implemented | Intentionally deferred and restricted |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 24.x |
| Language | TypeScript 5.9 (strict mode) |
| Package manager | pnpm 10.x (workspace monorepo) |
| API | Express 5, Zod validation, esbuild bundled |
| Database | PostgreSQL with Drizzle ORM |
| Frontend | React 19, Vite 7, Tailwind CSS 4, Framer Motion, TanStack Query |
| AI Integration | OpenRouter SDK wrapper with per-task model routing |
| API Spec | OpenAPI 3.0 source of truth, Orval code generation |
| Auth | express-session, connect-pg-simple, bcryptjs, speakeasy |

## Monorepo Layout

```
pnpm workspace root
├── artifacts/
│   ├── api-server/         Express 5 API (esbuild bundled)
│   ├── dashboard/          React + Vite frontend
│   └── mockup-sandbox/     Design mockup environment
├── lib/
│   ├── db/                 Drizzle schema + PostgreSQL client
│   ├── api-spec/           OpenAPI source of truth + Orval config
│   ├── api-zod/            Generated Zod request/response schemas
│   ├── api-client-react/   Generated TanStack Query hooks
│   └── integrations-openrouter-ai/  OpenRouter SDK wrapper
├── docs/                   User guide, deploy guide, changelog, specs
├── scripts/                Smoke tests, build helpers, compatibility tools
└── pnpm-workspace.yaml
```

## Quick Start

### Prerequisites

- **Git**
- **Node.js 24.x** (use nvm, fnm, or volta)
- **Corepack enabled** for pnpm 10.x

### 1. Clone and install

```powershell
git clone https://github.com/L-D-Pro/Asset-Manager.git
cd Asset-Manager
corepack pnpm install
```

### 2. Configure environment

Create a `.env` file at the repository root (do not commit secrets):

```bash
DATABASE_URL=postgresql://...
SESSION_SECRET=<at-least-32-random-characters>
AI_INTEGRATIONS_OPENROUTER_API_KEY=sk-or-v1-...
AI_INTEGRATIONS_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<your-password>
ADMIN_EMAIL=<your-email>
```

> `ADMIN_*` vars are for first-run bootstrap only. Remove them after your first successful login.

### 3. Push the database schema

```powershell
corepack pnpm --filter @workspace/db run push
```

If schema push fails due to drift, apply the compatibility patch:

```powershell
corepack pnpm --filter @workspace/db run compat
```

### 4. Start local development

```powershell
corepack pnpm run dev
```

This starts both the API server (port 8080) and the dashboard (port 5173) in parallel.

### 5. Open and log in

Navigate to `http://localhost:5173` and log in with your bootstrap admin credentials.

---

**Enable Apply Wizard** (optional):

```powershell
$env:VITE_ENABLE_APPLY_WIZARD="true"
corepack pnpm run dev
```

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Session signing secret (min 32 chars) |
| `AI_INTEGRATIONS_OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `AI_INTEGRATIONS_OPENROUTER_BASE_URL` | No | OpenRouter endpoint (defaults to `https://openrouter.ai/api/v1`) |
| `ADMIN_USERNAME` | First run only | Bootstrap admin username |
| `ADMIN_PASSWORD` | First run only | Bootstrap admin password |
| `ADMIN_EMAIL` | First run only | Bootstrap admin email |
| `PORT` | No | API server port (default: 8080) |
| `ALLOWED_ORIGINS` | Production | Comma-separated CORS origins |
| `VITE_ENABLE_APPLY_WIZARD` | No | Feature flag for Apply Wizard (dashboard only) |
| `API_SERVER_URL` | No | Override Vite dev proxy target |

The API server loads `.env` from the repository root. The dashboard parses `VITE_*` prefixed variables at build/dev time.

## Script Reference

| Command | Description |
| --- | --- |
| `pnpm run dev` | Start API + dashboard dev servers in parallel |
| `pnpm run typecheck` | Full workspace TypeScript check |
| `pnpm run build` | Typecheck + build API, dashboard, and mockup sandbox |
| `pnpm run smoke:test` | Run smoke tests against a running instance |
| `pnpm --filter @workspace/db run push` | Push Drizzle schema to PostgreSQL |
| `pnpm --filter @workspace/db run compat` | Apply runtime compatibility patch for schema drift |
| `pnpm --filter @workspace/db run generate` | Generate Drizzle migrations |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API schemas and client hooks from OpenAPI spec |

## Documentation

| Document | Description |
| --- | --- |
| [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) | Full user guide — setup, modules, workflows, troubleshooting |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Architecture overview — workspace layout, AI runtime, truth-lock design, state machines |
| [`CONVENTIONS.md`](CONVENTIONS.md) | Coding conventions — naming, imports, error handling, testing philosophy |
| [`AGENTS.md`](AGENTS.md) | Agent operating guide — repo protocol, validation checklist, guardrails |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Versioned changelog |
| [`docs/APPLY_WIZARD_MVP.md`](docs/APPLY_WIZARD_MVP.md) | Apply Wizard feature guide |
| [`docs/DEPLOY_DIGITALOCEAN.md`](docs/DEPLOY_DIGITALOCEAN.md) | DigitalOcean App Platform deployment guide |

## Deployment

The platform is designed to deploy on DigitalOcean App Platform (or any platform that supports Node.js + PostgreSQL + static site hosting). The deployment shape:

- **API** — Express web service on port 8080
- **Dashboard** — Static React site serving at `/`
- **PostgreSQL** — Managed database (Neon or DigitalOcean Managed PostgreSQL)

See [`docs/DEPLOY_DIGITALOCEAN.md`](docs/DEPLOY_DIGITALOCEAN.md) for the full deployment guide, including `.do/app.yaml` configuration, build scripts, and post-deploy smoke tests.

## License

MIT
