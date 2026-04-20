# Job Application Operations Platform - Handoff Guide

## What This Is

A private, single-user, human-in-the-loop AI job application and freelance proposal copilot. It is not a mass auto-apply bot, stealth login bot, scraper, or auto-bidder. Every AI-generated output requires explicit human approval before use.

Core philosophy:

- No hallucinations: resume/cover/proposal content must trace back to verified user source material.
- Human in the loop: AI documents and proposals sit in `pending_approval` until reviewed.
- Explainability: AI calls, prompt versions, costs, failures, and state changes are logged.
- Compliance-aware: no bypassing MFA/CAPTCHA, no prohibited platform automation, no fabricated experience.

## Who This Is For

A single job seeker/contractor using a private dashboard as their operations center. There is no multi-tenancy or public-facing user surface.

## Repo Layout

```text
/
|-- artifacts/
|   |-- api-server/        Express 5 API server
|   |-- dashboard/         React + Vite dashboard
|   `-- mockup-sandbox/    design sandbox
|-- lib/
|   |-- db/                Drizzle schema + DB client
|   |-- api-spec/          OpenAPI spec + Orval config
|   |-- api-client-react/  generated React Query hooks
|   |-- api-zod/           generated Zod schemas
|   `-- integrations-openrouter-ai/
|-- scripts/
|-- docs/
|-- ARCHITECTURE.md
|-- AI_PIPELINE.md
|-- TASK_STATUS.md
|-- HANDOFF.md
`-- replit.md
```

## How to Run

Prerequisites:

- Node.js 24
- pnpm via Corepack
- PostgreSQL `DATABASE_URL`
- `SESSION_SECRET`
- `AI_INTEGRATIONS_OPENROUTER_API_KEY`
- `AI_INTEGRATIONS_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
- first-run `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`

```powershell
corepack pnpm install
corepack pnpm --filter @workspace/db run push
corepack pnpm run dev
corepack pnpm run typecheck
```

Regenerate API clients after editing OpenAPI:

```powershell
corepack pnpm --filter @workspace/api-spec run codegen
```

## Current Feature Highlights

- Session auth with admin bootstrap, account settings, password/email changes, TOTP, and recovery codes.
- Base Resume page with immutable history, restore, and DOCX/PDF import.
- Claims Ledger with manual CRUD plus AI Draft Claims from pasted notes or DOCX/PDF uploads.
- Resume tailoring tied to exact base resume version, full tailored draft text, and truth-lock claim attribution.
- Cover letter drafting with claim-attributed paragraphs.
- AI Review with prompt versions, AI run evaluations, training examples, and recent AI event overview.
- Assisted Apply scaffolding for safe human-checkpoint sessions and future browser worker/extension work.
- Freelance Copilot scaffolding for profiles, manual project capture, fit scoring, proposal drafts, and outcomes.

## Current Safety Boundary

Do not implement:

- MFA/CAPTCHA bypass
- stealth login automation
- exported cookie/session-token automation
- mass auto-apply
- automatic final submission on prohibited platforms
- unauthorized Upwork scraping, auto-bidding, or auto-messaging

Assisted Apply and Freelance Copilot are assist-only unless an official API or written permission allows more.

## Documentation Map

| Document | Location | What it covers |
| --- | --- | --- |
| `docs/USER_GUIDE.md` | `/docs` | User-facing dashboard guide |
| `docs/CHANGELOG.md` | `/docs` | Version history and release notes |
| `ARCHITECTURE.md` | `/` | Package graph, runtime flow, design boundaries |
| `lib/db/DATA_MODEL.md` | `/lib/db` | Current schema domains and tables |
| `AI_PIPELINE.md` | `/` | OpenRouter, prompt routing, pipelines, truth-lock |
| `TASK_STATUS.md` | `/` | Current feature status and next priorities |
| `docs/DEPLOY_DIGITALOCEAN.md` | `/docs` | DigitalOcean deployment |
| `docs/SMOKE_TEST.md` | `/docs` | Automated and manual smoke tests |
| `replit.md` | `/` | Project memory and quick reference |

## Required After Pulling Latest Schema Changes

Run:

```powershell
corepack pnpm --filter @workspace/db run push
```

Alternative if push fails due to drift:

```powershell
corepack pnpm --filter @workspace/db run compat
```

Without this, new pages such as AI Review, Assisted Apply, Freelance Copilot, and new base-resume/claim-drafting features may fail with missing-table errors.
