# DigitalOcean Deployment Guide

This repo is ready to deploy as a private human-in-the-loop system on DigitalOcean App Platform. The deployment serves:

- a Node/Express API at `/api/*`
- a static React dashboard at `/`
- a managed PostgreSQL database

It does **not** automate job-site logins, bypass MFA/CAPTCHA, scrape prohibited platforms, auto-bid on Upwork, or submit applications/proposals on external platforms.

## Before You Start

1. Push the repo to GitHub with `pnpm-lock.yaml` committed.
2. Make sure the root `package.json` changes are present:
   - `packageManager: pnpm@10.33.0`
   - `engines.node: 24.x`
3. Decide whether you want to use the default `*.ondigitalocean.app` domain first or attach a custom domain immediately.

## App Spec Path

The repo includes a DigitalOcean App Platform template at [app.yaml](/c:/Users/uberc/Asset%20Manager%20Project/Asset-Manager/.do/app.yaml).

Before using it:

1. Replace `REPLACE_WITH_YOUR_GITHUB_OWNER/REPLACE_WITH_YOUR_REPO`.
2. Replace `REPLACE_WITH_YOUR_DOMAIN`.
3. Replace the bootstrap admin values.
4. Replace the OpenRouter key and session secret placeholders.

## Recommended Deploy Flow

1. In DigitalOcean, create a new App Platform app from GitHub.
2. Import or paste the `.do/app.yaml` spec.
3. Keep the app in a single region for all components.
4. Confirm the API service uses:
   - build command: `./scripts/do-build.sh api`
   - run command: `node --enable-source-maps artifacts/api-server/dist/index.mjs`
   - internal port: `8080`
   - health check: `/api/healthz`
5. Confirm the dashboard static site uses:
   - build command: `./scripts/do-build.sh dashboard`
   - output directory: `artifacts/dashboard/dist/public`
6. Confirm ingress rules:
   - `/api` routes to the `api` service
   - `/` routes to the `dashboard` static site
   - `/api` preserves the path prefix when forwarded
7. Review the managed PostgreSQL database component, attach an existing DigitalOcean cluster, or use an external Neon `DATABASE_URL`.
8. Deploy.
  9. After first deploy, push the latest schema to the production database before testing new AI Review, Assisted Apply, Freelance, base-resume import, AI claim drafting, AI Learning, and User Management features:

```bash
corepack pnpm --filter @workspace/db run push
```

If `push` fails due to schema drift, use the compat recovery path:

```bash
corepack pnpm --filter @workspace/db run compat
```

10. If deploying the User Management system for the first time, run this SQL against the production database to give the bootstrap admin elevated privileges:

```sql
UPDATE admin_users SET role = 'admin' WHERE id = 1;
```

## Required Environment Variables

The API service must have:

- `NODE_ENV=production`
- `DATABASE_URL`
- `SESSION_SECRET`
- `AI_INTEGRATIONS_OPENROUTER_API_KEY`
- `AI_INTEGRATIONS_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_EMAIL`
- `ALLOWED_ORIGINS=https://<your-dashboard-domain>`

The dashboard build can optionally set:

- `VITE_ENABLE_APPLY_WIZARD=true` (enables the `/apply-wizard` route otherwise gated)

If the root `.env.example` does not include a variable you need, check `artifacts/dashboard/.env.example` for dashboard-specific Vite-prefixed vars. Copy it to `artifacts/dashboard/.env` if you need local overrides.

Notes:

- `PORT` is injected automatically by App Platform from `http_port`.
- `ADMIN_*` vars are first-run bootstrap only. Remove them after the first successful login and redeploy.
- `ALLOWED_ORIGINS` should match the final dashboard origin exactly.

## Why The DO Build Script Exists

DigitalOcean App Platform builds on Linux, and this monorepo has already shown the usual platform-sensitive native package issues around `esbuild` and Rollup optional binaries when the install state is stale or was produced on another OS.

The DigitalOcean build script in [do-build.sh](/c:/Users/uberc/Asset%20Manager%20Project/Asset-Manager/scripts/do-build.sh):

- removes `package-lock.json` and `yarn.lock` if they exist
- removes all `node_modules` directories
- performs a fresh Linux-side `pnpm install --frozen-lockfile`
- runs the right codegen/build steps for the selected component

Important:

- it does **not** delete `pnpm-lock.yaml`
- it is intended for the App Platform build environment, not your normal local development flow

## First Boot Checklist

1. Open `https://<your-domain>/api/healthz` and confirm `{"status":"ok"}`.
2. Open the dashboard and log in with the bootstrap admin account.
3. Confirm the admin user is created.
4. Remove `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_EMAIL` from the app config.
5. Redeploy once more.
6. Re-test login.

## Post-Deploy Smoke Test

Run the script in [smoke-test.ts](/c:/Users/uberc/Asset%20Manager%20Project/Asset-Manager/scripts/src/smoke-test.ts):

```bash
JOB_OPS_BASE_URL=https://your-domain \
JOB_OPS_USERNAME=admin \
JOB_OPS_PASSWORD='your-password' \
pnpm smoke:test
```

If the account has 2FA enabled:

```bash
JOB_OPS_BASE_URL=https://your-domain \
JOB_OPS_USERNAME=admin \
JOB_OPS_PASSWORD='your-password' \
JOB_OPS_TOTP_TOKEN=123456 \
pnpm smoke:test
```

To include the AI endpoints for a known job:

```bash
JOB_OPS_BASE_URL=https://your-domain \
JOB_OPS_USERNAME=admin \
JOB_OPS_PASSWORD='your-password' \
JOB_OPS_JOB_ID=123 \
JOB_OPS_RUN_AI=true \
pnpm smoke:test
```

Manual checks after the script:

- Base Resume: save text, import DOCX/PDF, restore history
- Claims Ledger: create a claim and run AI Draft Claims
- AI Review: create a prompt version
- **AI Learning**: visit `/ai-learning` and confirm the page loads (requires 10+ applications with outcomes to show data)
- **User Management**: visit `/admin/users` (admin-only) and confirm the user table loads
- Assisted Apply: create a safe session record
- Freelance Copilot: create profile, capture project, score project, draft proposal

## Known Production Constraints

- The app is still human-in-the-loop. It has assisted-apply scaffolding, but it does not log into LinkedIn, Indeed, ZipRecruiter, Greenhouse, Lever, Workday, Upwork, or company career sites.
- Upwork/freelance support drafts proposals for review; it does not scrape Upwork, auto-bid, or message clients automatically.
- Secure session cookies require proxy awareness; the API now sets `trust proxy` in production for App Platform.
- The dashboard expects same-origin `/api/*` routing in production, so the ingress rule is not optional.
- **Landing page**: Unauthenticated visitors see the public marketing landing page at `/`. Authenticated users are redirected to `/dashboard`. The route is served client-side via React Router.
- **AI Learning** (`/api/ai-learning/*`): The auto-promotion scheduler runs `node-cron` inside the API process. The default schedule is daily at 2 AM. Auto-promotion only activates when `autoPromoteEnabled` is toggled on via the dashboard or DB config.
- **User Management** (`/api/auth/users/*`): Admin-only endpoints. The initial bootstrap admin must have `role = 'admin'` set in the DB. Rate limiting is applied to auth endpoints (5/15min for login).
