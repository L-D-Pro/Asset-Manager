# AGENTS.md

This file is the canonical operating guide for agents working in this repository. Use it to get productive quickly and to stay safe/consistent across two development machines.

## Scope and precedence

- Scope: entire repository tree rooted at this file.
- If multiple instruction sources exist, follow this order:
  1. System/developer/user prompt instructions
  2. More deeply nested `AGENTS.md` files (if any)
  3. This root `AGENTS.md`

## Project snapshot (current state)

- Product: Job Ops (single-user, human-in-the-loop job-ops platform).
- Monorepo: `pnpm` workspace, Node `24.x`, TypeScript `5.9`, strict mode.
- Core apps:
  - `artifacts/api-server` (Express 5 API)
  - `artifacts/dashboard` (React + Vite UI)
- Shared libs:
  - `lib/db` (Drizzle schema/client)
  - `lib/api-spec` (OpenAPI source of truth)
  - `lib/api-zod` (generated validation schemas)
  - `lib/api-client-react` (generated hooks/types)
  - `lib/integrations-openrouter-ai` (OpenRouter wrapper)

### Current high-impact features

- Apply Wizard route: `/apply-wizard` (feature flag `VITE_ENABLE_APPLY_WIZARD=true`).
- Wizard tailor step supports:
  - system-default generation
  - custom model comparison (up to 3 models per artifact)
- Hybrid model picker uses `GET /ai-model-catalog` and marks configured/default models.
- Compare endpoints:
  - `POST /jobs/:id/compare/resume`
  - `POST /jobs/:id/compare/cover-letter`
- Winner promotion endpoints:
  - `POST /jobs/:id/compare/promote-resume`
  - `POST /jobs/:id/compare/promote-cover-letter`
- Comparison metadata is audit-logged; only promoted winners persist in normal queues.

## Canonical repo and remotes

- Canonical GitHub repo: `https://github.com/L-D-Pro/Asset-Manager`
- Expected `origin` URL:
  - `https://github.com/L-D-Pro/Asset-Manager.git`

Use this check at session start:

```powershell
git remote -v
```

## Fresh-machine bootstrap checklist

1. Install prerequisites:
   - Git
   - Node `24.x`
   - Corepack enabled (`pnpm 10.x`)
2. Clone repo and install:

```powershell
corepack pnpm install
```

3. Configure root `.env` (do not commit secrets):
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `AI_INTEGRATIONS_OPENROUTER_API_KEY`
   - `AI_INTEGRATIONS_OPENROUTER_BASE_URL`
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL` (first-run bootstrap only)
4. Sync DB schema:

```powershell
corepack pnpm --filter @workspace/db run push
```

If schema drift blocks push:

```powershell
corepack pnpm --filter @workspace/db run compat
```

5. Start local dev:

```powershell
corepack pnpm run dev
```

6. Optional wizard flag in dashboard env context:

```powershell
VITE_ENABLE_APPLY_WIZARD=true
```

## Strict two-PC git sync protocol (required)

### Start-of-session (every time, every PC)

Run in repo root:

```powershell
git status --short --branch
git remote -v
git fetch --all --prune
git rev-list --left-right --count HEAD...origin/main
```

Interpret `git rev-list --left-right --count HEAD...origin/main` output as:
- `<ahead> <behind>`
- `0 0`: synced
- `N 0`: local ahead (unpushed commits)
- `0 N`: remote ahead (must integrate before new work)
- `N M`: diverged (reconcile immediately)

If remote is ahead or diverged, rebase before coding:

```powershell
git pull --rebase origin main
```

### During session

- Make small, focused commits.
- Keep working tree non-dirty when switching context.
- Never use `git push --force` on `main`.
- Do not rewrite shared history on `main`.
- Avoid mixing unrelated changes in one commit.

### End-of-session

1. Validate (minimum):

```powershell
corepack pnpm run typecheck
```

2. Commit and push:

```powershell
git add -A
git commit -m "<clear scope message>"
git push origin main
```

3. Confirm clean state:

```powershell
git status --short --branch
```

### Conflict handling (when both PCs changed same areas)

- Prefer `git pull --rebase origin main` and resolve commits one-by-one.
- After resolving conflicts:

```powershell
git add <resolved-files>
git rebase --continue
```

- Re-run typecheck, then push.
- If conflict risk is high, stop and create a short handoff note before proceeding.

### Prohibited commands on shared `main`

- `git reset --hard`
- `git checkout -- <file>`
- `git push --force`

(Unless explicitly requested by the user in-session.)

## Change rules for agents

- Follow spec-first API workflow when endpoints change:
  1. edit `lib/api-spec/openapi.yaml`
  2. run `corepack pnpm --filter @workspace/api-spec run codegen`
  3. apply generated schema/client changes
  4. wire route + dashboard usage
- Prefer generated `@workspace/api-zod` schemas for request validation in API routes.
- Use `safeParse()` in handlers (not `parse()` throwing in request path).
- Keep truth-lock boundaries intact for resume/cover/proposal flows.
- Preserve human-in-the-loop policy and no auto-submit guarantees.
- Keep edits scoped; do not opportunistically refactor unrelated modules.

## Validation checklist before handoff

Run the smallest relevant checks first, then broader checks if needed.

- API route/pipeline changes:

```powershell
corepack pnpm --filter @workspace/api-server run typecheck
```

- Dashboard page/UI changes:

```powershell
corepack pnpm --filter @workspace/dashboard run typecheck
```

- Cross-package/schema changes:

```powershell
corepack pnpm run typecheck
```

If behavior changed, update docs in the same PR/commit set (`docs/USER_GUIDE.md`, `docs/CHANGELOG.md`, wizard docs as applicable).

## Guardrails and gotchas

- Route `/apply-wizard` may render a disabled notice when flag is off; this can be expected behavior.
- Generated code under `lib/api-zod` and `lib/api-client-react` should be regenerated, not hand-edited unless explicitly required.
- `lib/db/runtime-compat.sql` is the recovery path for DB drift after schema changes.
- Never hardcode secrets in code/docs.

## High-signal file map

- Architecture and conventions:
  - `ARCHITECTURE.md`
  - `CONVENTIONS.md`
- Core docs:
  - `docs/USER_GUIDE.md`
  - `docs/APPLY_WIZARD_MVP.md`
  - `docs/CHANGELOG.md`
- API hotspots:
  - `artifacts/api-server/src/routes/jobs.ts`
  - `artifacts/api-server/src/routes/ai-model-configs.ts`
  - `artifacts/api-server/src/lib/ai-client.ts`
  - `artifacts/api-server/src/lib/pipelines/resume-tailor.ts`
  - `artifacts/api-server/src/lib/pipelines/cover-letter-draft.ts`
- Dashboard hotspots:
  - `artifacts/dashboard/src/pages/apply-wizard/index.tsx`
  - `artifacts/dashboard/src/pages/guide/index.tsx`
- Data/schema:
  - `lib/db/src/schema/*`
  - `lib/db/runtime-compat.sql`

## Working style expectation

- Be precise, minimal, and verifiable.
- Explain changes briefly with file paths.
- Prefer safe, reversible operations.
- If unexpected workspace changes appear, stop and ask before proceeding.

## Tooling reliability: large-file write strategy

When creating or overwriting files with **> ~500 lines** of content, the `Write` or `Edit` tool may abort during the "preparing write" phase or fail to complete. When this happens, use this reliable two-step pattern:

1. **Write a temporary JS wrapper** to a temp file (e.g. `temp-write-<name>.js`) using the `Write` tool. Inside it, place the actual target content as a JavaScript template literal assigned to a variable.
2. **Extract and write the real file** by running a short Python command via `Bash`. The Python script reads the temp JS file, extracts the content between the backtick delimiters, and writes it to the final destination.
3. **Clean up** by deleting the temp file via `Bash`.

This avoids template-literal escaping issues in shell `node -e` and bypasses the write-tool abort entirely. After extraction, verify the file was written correctly with a quick `Read`.
