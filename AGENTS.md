# AGENTS.md

Agent operating guide for Job Ops. Read before touching code.

See `CONVENTIONS.md` for naming, imports, and logging rules. See `ARCHITECTURE.md` for package layout and runtime flow. See `AI_PIPELINE.md` for AI pipeline details.

## Superpowers Skills

This repo uses the Superpowers plugin. Invoke the relevant skill before acting. Common mappings:

| Scenario | Skill |
|---|---|
| New feature, design change | brainstorming |
| Implementing approved design | writing-plans → executing-plans |
| Bug, regression, unknown root cause | systematic-debugging |
| Before claiming done | verification-before-completion |
| Non-trivial handoff | requesting-code-review |
| Finishing a branch | finishing-a-development-branch |

Announce skills as: `[skill-name] to [purpose]`. Do not duplicate skill content here.

## Non-Negotiable Invariants

Violating these breaks the platform:

- **Truth-Lock** — AI content must cite Claims Ledger IDs. `validation.ts` drops hallucinated IDs structurally. Do not weaken.
- **State Machines** — `resume/cover_letter/proposal_versions` follow `pending_approval → approved | rejected`. Repeat approve/reject must return 409.
- **Immutable Base Resume** — `base_resume_versions` is append-only. Restore clones; no mutation endpoints.
- **AI Call Routing** — All AI calls go through `callAI()` in `artifacts/api-server/src/lib/ai-client.ts`. Never call OpenRouter directly.
- **Spec-First API** — `lib/api-spec/openapi.yaml` is source of truth. `lib/api-zod/src/generated/` and `lib/api-client-react/src/generated/` are generated — never hand-edit.
- **M002 Run Lineage** — Use `mintRunId()`. Never invent or copy `run_id` values across unrelated records.

## Commands

```powershell
# Dev (API :8080 + Dashboard :5173)
corepack pnpm run dev

# Full typecheck (all workspace packages)
corepack pnpm run typecheck

# Build all artifacts
corepack pnpm run build

# Push DB schema
corepack pnpm --filter @workspace/db run push

# Schema drift fix (when push fails)
corepack pnpm --filter @workspace/db run compat

# Regenerate API schemas + client hooks (after openapi.yaml changes)
corepack pnpm --filter @workspace/api-spec run codegen

# Smoke tests (requires running instance)
corepack pnpm run smoke:test
```

Dependencies: `corepack pnpm install` when the lockfile changes, **before** any other command.

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

## Validation Checklist (Before Claiming Done)

```powershell
corepack pnpm run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/dashboard run build
```

After OpenAPI changes: `corepack pnpm --filter @workspace/api-spec run codegen`

After schema changes: `corepack pnpm --filter @workspace/db run push` (or `compat` on drift)

## Common Workflows

### Add an API endpoint
1. Edit `lib/api-spec/openapi.yaml`
2. `corepack pnpm --filter @workspace/api-spec run codegen`
3. Create/update `artifacts/api-server/src/routes/<entity-plural>.ts`
4. Register in `artifacts/api-server/src/routes/index.ts`
5. Use generated hook from `@workspace/api-client-react` in the dashboard

### Add a DB table
1. Create `lib/db/src/schema/<entity-plural>.ts`
2. Export from `lib/db/src/schema/index.ts`
3. `corepack pnpm --filter @workspace/db run push`

### Add/modify an AI pipeline
1. Create/edit `artifacts/api-server/src/lib/pipelines/<verb>-<noun>.ts`
2. Call `callAI({ taskType, systemPrompt, userPrompt, jobId? })`
3. Store result as `pending_approval`

### Modify the learning loop
Files: `learning-processor.ts`, `learning-aggregator.ts`, `bayesian-compare.ts`.
Trigger recompute via `learning-processor.runRecompute()` — never from a request handler under user latency budget.

## Key Constraints

- Node.js **24.x** minimum, pnpm **10.x** via Corepack
- TypeScript strict (individual flags in `tsconfig.base.json`), no `any`, use `safeParse()` not `.parse()`
- Drizzle ORM only — no raw SQL, always `.returning()` after mutations
- `@workspace/*` imports across packages, never relative paths
- No silent fallbacks — log and surface errors
- No automated test suite exists; rely on typecheck + smoke tests + dashboard manual testing

## Environment

Copy `.env.example` → `.env`. Must have: `DATABASE_URL`, `SESSION_SECRET`, `AI_INTEGRATIONS_OPENROUTER_API_KEY`, `AI_INTEGRATIONS_OPENROUTER_BASE_URL`. `ADMIN_*` vars for first-run bootstrap only — remove after.

`VITE_ENABLE_APPLY_WIZARD=true` enables the Apply Wizard dashboard feature.

## Hard Guardrails — Do Not Build

MFA/CAPTCHA bypass, stealth login automation, mass auto-apply, auto-submit without user confirmation, unauthorized Upwork scraping/auto-bidding, credential vault forwarding to browser workers.

Assisted Apply and Freelance Copilot are assist-only. No automation beyond official API permissions.

## Documentation Map

| File | Covers |
|---|---|
| `CLAUDE.md` | Commands, architecture, conventions summary |
| `ARCHITECTURE.md` | Package graph, AI runtime, learning loop, state machines |
| `CONVENTIONS.md` | Naming, imports, error handling, Drizzle patterns, testing |
| `AI_PIPELINE.md` | OpenRouter contract, model/prompt routing, pipelines, truth-lock |
| `lib/db/DATA_MODEL.md` | DB tables, M002 lineage |
| `lib/api-spec/API_CONTRACT.md` | Endpoint inventory, Zod strategy |
| `docs/APPLY_WIZARD_MVP.md` | Apply Wizard guide |
| `docs/DEPLOY_DIGITALOCEAN.md` | Production deploy |
| `DEV_SETUP_WINDOWS.md` | Windows dev environment setup |
