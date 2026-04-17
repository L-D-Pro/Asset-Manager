# Job Application Operations Platform

## Overview

Private, single-user, human-in-the-loop AI job application and freelance proposal copilot. It is not a mass auto-apply bot, stealth login bot, scraper, or auto-bidder. The app optimizes for truthfulness, reviewability, account safety, and high-quality applications/proposals.

## Stack

- pnpm monorepo
- Node.js 24
- TypeScript 5.9
- Express 5 API
- React + Vite dashboard
- PostgreSQL + Drizzle ORM
- OpenAPI 3.1 source of truth
- Orval-generated Zod schemas and React Query hooks
- OpenRouter AI integration

## Key Commands

```powershell
corepack pnpm install
corepack pnpm run dev
corepack pnpm run typecheck
corepack pnpm run build
corepack pnpm --filter @workspace/db run push
corepack pnpm --filter @workspace/api-spec run codegen
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/dashboard run build
```

## Required Env Vars

- `DATABASE_URL`
- `SESSION_SECRET`
- `AI_INTEGRATIONS_OPENROUTER_API_KEY`
- `AI_INTEGRATIONS_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL` for first-run bootstrap only

## Core Data Domains

- Job search: role profiles, jobs, claims, base resume versions, resume versions, cover letters, applications.
- Audit/learning: event logs, feedback signals, AI model configs, AI prompt versions, AI run evaluations, AI training examples.
- Assisted apply: site adapters, application sessions, form fields, actions.
- Freelance copilot: freelance profiles, project sources, freelance projects, proposal versions, proposal outcomes, client message templates.
- Auth/session: admin users and session table.

## Current AI Task Scopes

- `default`
- `jd_parsing`
- `claim_generation`
- `resume_tailoring`
- `cover_letter`
- `proposal_drafting`
- `job_fit_scoring`
- `project_fit_scoring`
- `validation`

## AI Pipeline Notes

- `callAI()` uses active `ai_prompt_versions` when configured, otherwise built-in pipeline prompts.
- `selectModelForTask()` reads `ai_model_configs` and supports fallback chains.
- Every AI call logs model, prompt version, tokens, cost estimate, and failures to `event_logs`.
- Resume tailoring requires a current base resume.
- Resume and cover-letter outputs are truth-locked against selected Claims Ledger IDs.
- AI-generated claims are draft-only until the user creates selected claims.
- Proposal drafts are pending review and are not submitted automatically.

## Dashboard Pages

- `/` Dashboard
- `/jobs`
- `/jobs/:id`
- `/claims`
- `/base-resume`
- `/resume-versions`
- `/cover-letters`
- `/applications`
- `/assisted-apply`
- `/freelance`
- `/feedback`
- `/role-profiles`
- `/ai-review`
- `/ai-config`
- `/guide`
- `/account`
- `/login`

## Safety Boundary

Do not build:

- MFA/CAPTCHA bypass
- stealth login/session automation
- mass auto-apply
- final submit automation on prohibited platforms
- unauthorized Upwork scraping
- auto-bidding
- auto-messaging

Assisted Apply and Freelance Copilot are assist-only unless official API access or written permission allows more.

## Deployment Notes

- Dashboard calls same-origin `/api/*`.
- Production ingress must route `/api` to the API service and preserve the prefix.
- Neon or DigitalOcean Managed PostgreSQL can be used as long as `DATABASE_URL` is set.
- After schema changes, run `corepack pnpm --filter @workspace/db run push`.

## Current Verification

Latest implementation has been verified with:

```powershell
corepack pnpm run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/dashboard run build
```

Dashboard build may show existing Vite sourcemap/chunk-size warnings; those are warnings, not failures.
