# HANDOFF.md — Cross-PC Session Transition Checklist

Use this checklist when switching development between two machines (e.g., desktop and laptop) to ensure a clean start of session on the other PC.

## Before Leaving This PC

- [ ] **Commit all work** — no dirty working tree.
  ```powershell
  git status --short --branch
  ```
  Expected: clean working tree, branch `main` up to date or ahead.

- [ ] **Push to origin** so the other PC can fetch the latest.
  ```powershell
  git push origin main
  ```

- [ ] **Log the last commit hash** for reference.
  ```powershell
  git log -1 --oneline
  ```

- [ ] **Note if the DB schema changed** in this session. If yes, the other PC must run:
  ```powershell
  corepack pnpm --filter @workspace/db run push
  ```
  Or the compat fallback if push fails.

- [ ] **Note if new dependencies were installed** (`npm install`, `pnpm add`, etc.). The other PC must run:
  ```powershell
  corepack pnpm install
  ```

- [ ] **Note if any new `.env` variables** are needed (e.g., rate-limit config, new OpenRouter key).

## Starting on the Other PC

- [ ] **Sync from origin:**
  ```powershell
  git fetch --all --prune
  git status --short --branch
  git rev-list --left-right --count HEAD...origin/main
  ```

- [ ] **Rebase if remote is ahead or diverged:**
  ```powershell
  git pull --rebase origin main
  ```

- [ ] **Install any new dependencies:**
  ```powershell
  corepack pnpm install
  ```

- [ ] **Push any schema changes to the DB:**
  ```powershell
  corepack pnpm --filter @workspace/db run push
  ```

- [ ] **Verify environment** — check root `.env` has all required variables (see `docs/DEPLOY_DIGITALOCEAN.md` for the full list).

- [ ] **Run typecheck to confirm nothing is broken:**
  ```powershell
  corepack pnpm run typecheck
  ```

- [ ] **Start dev and smoke-test:**
  ```powershell
  corepack pnpm run dev
  ```
  - Log in at `http://localhost:5173/login`
  - Browse Dashboard, Jobs Pipeline, AI Config, AI Learning pages
  - Confirm no runtime errors in browser console

## Common Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `Cannot find module '@workspace/db'` | Stale `pnpm install` | Run `corepack pnpm install` |
| DB "relation does not exist" | Schema not pushed on this DB | Run `corepack pnpm --filter @workspace/db run push` |
| Typecheck errors in generated code | Stale codegen | Run `corepack pnpm --filter @workspace/api-spec run codegen` |
| `drizzle-kit push` TUI prompts | Interactive-only on Windows | Run `corepack pnpm --filter @workspace/db run compat` instead, or use manual SQL migration |
| Session/auth errors | Missing/expired `SESSION_SECRET` | Check `.env` has a valid `SESSION_SECRET` |

## After First Deployment with User Management

If the User Management system has been deployed, the bootstrap admin needs manual role promotion:

```sql
UPDATE admin_users SET role = 'admin' WHERE id = 1;
```

Run this once per database instance (local dev DB and production DB). Without it, the `/admin/users` page and sidebar admin group will be hidden.
