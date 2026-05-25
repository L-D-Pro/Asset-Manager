# Architecture

Last updated: May 16, 2026

## Workspace Layout

```text
pnpm workspace root
|
|-- lib/db                         Drizzle schema + PostgreSQL client
|-- lib/api-spec                   OpenAPI source of truth + Orval config
|-- lib/api-zod                    generated Zod request/response schemas
|-- lib/api-client-react           generated React Query hooks
|-- lib/integrations-openrouter-ai OpenRouter SDK wrapper
|-- artifacts/api-server           Express 5 API, esbuild bundle
|-- artifacts/dashboard            React + Vite dashboard
|-- artifacts/mockup-sandbox       design/mockup sandbox
|-- scripts                        smoke/test helper scripts
```

## Runtime Shape

```text
Browser
  |
  | /api/*
  v
Express app
  |
  | requireAuth for all non-auth/non-health routes
  v
Route handler
  |
  | validates with generated @workspace/api-zod schemas or local zod schemas
  v
Business logic / AI pipeline
  |
  | Drizzle ORM
  v
PostgreSQL
```

Dashboard API calls normally use generated hooks from `@workspace/api-client-react`. A small number of newer dashboard surfaces may use direct API helpers while the generated hooks are being adopted.

## Spec-First API

`lib/api-spec/openapi.yaml` is the source of truth for public API shape.

Workflow for route changes:

1. Edit OpenAPI.
2. Run `corepack pnpm --filter @workspace/api-spec run codegen`.
3. Use generated Zod schemas in the API where practical.
4. Use generated React Query hooks in the dashboard where practical.

Generated packages:

- `lib/api-zod`: server validation
- `lib/api-client-react`: dashboard hooks and TypeScript types

## Database Domains

Primary operational domains:

- Job search: `role_profiles`, `jobs`, `claims`, `base_resume_versions`, `resume_versions`, `cover_letter_versions`, `applications`
- Audit/learning: `event_logs`, `feedback_signals`, `ai_model_configs`, `ai_prompt_versions`, `ai_run_evaluations`, `ai_training_examples`, `ai_variant_stats`, `ai_variant_comparisons`, `ai_learning_config`
- Assisted apply: `site_adapters`, `application_sessions`, `application_form_fields`, `application_actions`
- Freelance copilot: `freelance_profiles`, `project_sources`, `freelance_projects`, `proposal_versions`, `proposal_outcomes`, `client_message_templates`
- Auth/user management: `admin_users`, `session`, `invite_codes`, `user_usage_limits`, `waitlist`
- Chat: `conversations`, `messages`
- Gamification: `user_stats`, `xp_log`, `achievements`, `user_achievements`, `quests`, `user_quests`
- Job board: `job_sources`, `job_listings`
- Platform/UX: `wizard_sessions`, `user_onboarding`, `best_practices`, `feedback`

## AI Runtime

```text
Pipeline or route
  |
  v
callAI(taskType, systemPrompt, userPrompt)
  |
  | resolve active ai_prompt_versions row if present (agent role with personality/goals/skills)
  | select active ai_model_configs row and fallback chain
  v
OpenRouter chat.completions.create()
  |
  | log event_logs success/failure with model, prompt version, tokens, cost
  v
Pipeline validates/parses output
  |
  v
Pending review record (resume_versions / cover_letter_versions / proposal_versions)
  |
  | approve → auto-create ai_run_evaluation + ai_training_example suggestion
  | reject → auto-create ai_run_evaluation
  v
feedback_signals (outcome: offer, rejection, etc.)
  |
  | attributionData auto-populated from event_log lineage
  | auto-recompute triggered when unprocessed >= minSampleSize
  v
learning-processor.runRecompute() → aggregateVariantStats (prompt + model variants)
  |
  v
Bayesian comparison → ai_variant_comparisons (P(A > B), confidence)
  |
  v
Promote suggestions (human approval gate for prompts; manual for models)
```

### Learning Loop Architecture

The learning loop is a closed feedback system spanning 7+ tables:

1. **AI generates output** (resume, cover letter, etc.) → recorded in `event_logs` with lineage
2. **User approves/rejects** → auto-creates `ai_run_evaluation` with rubric scores
3. **Application outcomes** recorded as `feedback_signals` with enriched `attributionData` (prompt version, model, claim IDs)
4. **`learning-processor.runRecompute()`** aggregates signals into `ai_variant_stats` for BOTH prompt and model variants
5. **Bayesian comparison engine** computes win probabilities → `ai_variant_comparisons`
6. **Dashboard** shows leaderboard with promote suggestions, gated on confidence threshold (0.95), min sample size (10), and min improvement margin (0.05)
7. **Configuration** via `ai_learning_config` controls auto-recompute, auto-evaluate, auto-train-suggest, and comparison thresholds

### Agent Specialization

Pipeline prompts externalized into `ai_prompt_versions` as DB-seeded agent roles:

| Role | Task Scope | Pipeline |
|------|-----------|----------|
| Resume Expert | `resume_tailoring` | resume-tailor.ts |
| Cover Letter Strategist | `cover_letter` | cover-letter-draft.ts |
| Application Analyst (JD Parser) | `jd_parsing` | jd-parse.ts |
| Claim Generator | `claim_generation` | claim-generation.ts |
| Proposal Drafter | `proposal_drafting` | proposal-draft.ts |
| Market Researcher | `market_research` | market-research.ts |
| Gap Analyst | `gap_analysis` | gap-analysis.ts |
| Job Researcher | `job_research` | job-research.ts |
| Fact Reviewer | `fact_review` | fact-review.ts |
| Resume Profile Builder | `resume_to_profile` | resume-to-profile.ts |

Each role has personality, goals, and skill tags configured in the database. The prompt-router resolves the active version at call time, falling back to the in-code `SYSTEM_PROMPT` constant when no DB version exists.

Current AI-producing flows:

- JD parsing
- claim generation
- resume tailoring
- cover letter drafting
- freelance proposal drafting
- market research
- gap analysis
- job research
- resume-to-profile extraction
- fact review

## Truth-Lock Design

The Claims Ledger is the factual boundary.

Resume tailoring and cover letter drafting send selected claims to the model as `[ID:N] claim summary` context. Returned content must cite claim IDs. Validation drops hallucinated IDs and discards unsupported bullets/paragraphs.

This is a structural guard, not only a prompt instruction.

## Base Resume Design

`base_resume_versions` is global and immutable:

- Saves always create new rows.
- One current row is maintained by app-level transaction plus current-row uniqueness strategy.
- Restore creates a fresh current row cloned from history.
- Resume tailoring stores `baseResumeVersionId` on each generated `resume_versions` row.

This makes every tailored draft traceable to the exact source document used.

## Human Approval State Machines

Pending review entities:

- `resume_versions`
- `cover_letter_versions`
- `proposal_versions`

Allowed state transitions:

```text
pending_approval -> approved
pending_approval -> rejected
approved/rejected -> 409 on repeat approve/reject
```

## Assisted Apply Boundary

Assisted apply is currently scaffolding:

- `application_sessions` record the user-approved session.
- `application_form_fields` stores detected/suggested/approved field values.
- `application_actions` stores action logs.
- `site_adapters` record platform policy and allowed automation level.

No browser worker, browser extension, job-site credential storage, CAPTCHA bypass, or auto-submit exists yet.

## Freelance Copilot Boundary

Freelance support is a proposal copilot:

- manually capture project text
- score project fit
- draft proposal and client message
- track proposal outcome

It does not scrape Upwork, auto-refresh feeds, auto-bid, or auto-message clients.

## Deployment Shape

The intended production shape remains:

- API web service
- Dashboard static site
- PostgreSQL database, currently compatible with Neon or DigitalOcean Managed PostgreSQL

The dashboard calls relative `/api/*`, so production ingress must route `/api` to the API service with the prefix preserved.

## Schema Evolution Safety

When `drizzle-kit push` fails due to schema drift (common after M002 lineage enforcement), use:

```powershell
corepack pnpm --filter @workspace/db run compat
```

This executes `lib/db/runtime-compat.sql` - a consolidated compatibility patch that creates missing tables/columns for:
- M002 lineage columns (`run_id`, `event_log_id`)
- `ai_prompt_versions` role metadata columns (`role_label`, `personality`, `goals`, `skill_tags`)
- `ai_learning_config` auto-feature flags (`auto_recompute_enabled`, `auto_evaluate_enabled`, `auto_train_suggest_enabled`)
- Agent role prompt version seeding (8 task scopes with personality/goals/skills)
- Assisted Apply tables (`site_adapters`, `application_sessions`, etc.)
- Freelance Copilot tables (`freelance_profiles`, `proposal_versions`, etc.)
