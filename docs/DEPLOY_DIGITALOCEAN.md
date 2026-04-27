# DigitalOcean Deployment Guide — `jops.ldpro.io`

This guide deploys Job Ops as a **separate App Platform app** under your existing L&D Pro project, accessible at `https://jops.ldpro.io`. The database stays on Neon — nothing is provisioned on DigitalOcean besides compute.

It does **not** automate job-site logins, bypass MFA/CAPTCHA, scrape prohibited platforms, auto-bid on Upwork, or submit applications/proposals on external platforms.

---

## Architecture

```
Browser ──► https://jops.ldpro.io
               │
         DigitalOcean App Platform (sfo3)
               │
     ┌─────────┴─────────┐
     │                    │
  /api/*              /* (static)
     │                    │
  api service         dashboard
  (Node/Express)      (React SPA)
     │
     ▼
  Neon PostgreSQL
  (external, us-west-2)
```

- **api** — Node/Express service, listens on port 8080, handles all `/api/*` routes
- **dashboard** — Static Vite-built React SPA, serves the UI at `/`
- **database** — Neon-hosted PostgreSQL (external to DigitalOcean)

---

## Prerequisites

1. ✅ The repo is pushed to GitHub at `L-D-Pro/Asset-Manager` with `pnpm-lock.yaml` committed.
2. ✅ Root `package.json` has `packageManager: pnpm@10.33.0`.
3. ✅ You have a Neon database with a connection string ready.
4. ✅ You have access to the L&D Pro project on DigitalOcean.
5. ✅ You manage DNS for `ldpro.io` (visible in your DO dashboard).

---

## Step 1: Add DNS Record

Go to **DigitalOcean → Networking → Domains → ldpro.io**:

1. Click **Add Record** → **CNAME**
2. Fill in:
   - **Hostname**: `jops`
   - **Value**: `<your-new-app>.ondigitalocean.app.` (you'll get this after creating the app, but you can add it now as a placeholder or add it after Step 2)
   - **TTL**: 3600
3. Save.

> **Note**: You can also set this up after creating the app. DO will show you the exact CNAME target in the app's **Settings → Domains** section.

---

## Step 2: Create the App

1. Go to **DigitalOcean → Apps → Create App**
2. Under **Git repository**, select **GitHub** as the provider
3. From the **Repository** dropdown, select `L-D-Pro/Asset-Manager`
4. Click **Next**
5. DO will auto-detect components from your repo. You need exactly **two**:

#### Component 1: `api` (Web Service)
| Setting | Value |
|---------|-------|
| Name | `api` |
| Type | Web Service |
| Source | `L-D-Pro/Asset-Manager` (branch: `main`) |
| Source Directory | `/` |
| Build Command | `./scripts/do-build.sh api` |
| Run Command | `node --enable-source-maps artifacts/api-server/dist/index.mjs` |
| HTTP Port | `8080` |
| Instance Size | Basic ($5/mo — 1 vCPU, 0.5 GB RAM) |
| Health Check Path | `/api/healthz` |

#### Component 2: `dashboard` (Static Site)
| Setting | Value |
|---------|-------|
| Name | `dashboard` |
| Type | Static Site |
| Source | `L-D-Pro/Asset-Manager` (branch: `main`) |
| Source Directory | `/` |
| Build Command | `./scripts/do-build.sh dashboard` |
| Output Directory | `artifacts/dashboard/dist/public` |
| Catchall Document | `index.html` |

4. Under **Settings → Domains**, add `jops.ldpro.io` as the primary domain.

---

## Step 3: Configure Environment Variables

In the DO dashboard, go to **App → Settings → api component → Environment Variables**:

| Variable | Value | Scope | Type |
|----------|-------|-------|------|
| `NODE_ENV` | `production` | Run Time | General |
| `PORT` | `8080` | Run Time | General |
| `DATABASE_URL` | `postgresql://neondb_owner:...` | Run Time | **Secret** |
| `SESSION_SECRET` | *(new random 64-char hex)* | Run Time | **Secret** |
| `AI_INTEGRATIONS_OPENROUTER_API_KEY` | `sk-or-v1-...` | Run Time | **Secret** |
| `AI_INTEGRATIONS_OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Run Time | General |
| `CHUTES_API_KEY` | `cpk_...` | Run Time | **Secret** |
| `ADMIN_USERNAME` | `admin` | Run Time | General |
| `ADMIN_PASSWORD` | *(strong, 12+ chars)* | Run Time | **Secret** |
| `ADMIN_EMAIL` | Your email | Run Time | General |
| `ALLOWED_ORIGINS` | `https://jops.ldpro.io` | Run Time | General |

For the **dashboard** component, add one build-time variable:

| Variable | Value | Scope | Type |
|----------|-------|-------|------|
| `BASE_PATH` | `/` | Build Time | General |

> **Generate a production SESSION_SECRET** — never reuse your local dev one. Run this in PowerShell:
> ```powershell
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## Step 4: Configure Ingress Routes

In the DO dashboard, go to **App → Settings → Routing Rules** (or this may already be set from the app spec):

| Route | Component | Preserve Path Prefix |
|-------|-----------|---------------------|
| `/api` | `api` | ✅ Yes |
| `/` | `dashboard` | — |

The order matters — `/api` must come **before** `/` so API requests hit the service, not the static site.

---

## Step 5: Deploy

1. Click **Deploy** (or it will auto-deploy if `deploy_on_push: true` was set).
2. Watch the build logs. The build takes ~2–4 minutes per component.
3. Common build issues:
   - If corepack/pnpm fails: make sure `pnpm-lock.yaml` is committed and pushed
   - If codegen fails: make sure `lib/api-spec/openapi.yaml` is valid

---

## Step 6: Push Schema to Production Database

After the first successful deploy, push the Drizzle schema to your Neon production database. Run this from your **local machine** with your `.env` pointing to the production Neon URL:

```powershell
corepack pnpm --filter @workspace/db run push
```

If `push` fails due to schema drift:

```powershell
corepack pnpm --filter @workspace/db run compat
```

> **Important**: `drizzle-kit push` is TUI-interactive on Windows. If it prompts for confirmation, follow the prompts manually.

---

## Step 7: First Boot Verification

### 7a. Health Check
Open in your browser:
```
https://jops.ldpro.io/api/healthz
```
You should see: `{"status":"ok"}`

### 7b. Dashboard
Open:
```
https://jops.ldpro.io
```
You should see the **public landing page**. Click "Log In".

### 7c. Admin Login
Log in with the `ADMIN_USERNAME` and `ADMIN_PASSWORD` you configured.

### 7d. Promote Admin Role
Run this SQL against your Neon database (via Neon console or `psql`):

```sql
UPDATE admin_users SET role = 'admin' WHERE id = 1;
```

### 7e. Remove Bootstrap Credentials
After confirming login works:
1. Go to **App → Settings → api → Environment Variables**
2. **Delete** `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_EMAIL`
3. Click **Save** → this triggers a redeploy
4. Re-test login to confirm it still works

---

## Step 8: Smoke Test

From your local machine:

```powershell
$env:JOB_OPS_BASE_URL = "https://jops.ldpro.io"
$env:JOB_OPS_USERNAME = "admin"
$env:JOB_OPS_PASSWORD = "your-production-password"
corepack pnpm smoke:test
```

Manual checks after the script:
- Base Resume: save text, import DOCX/PDF, restore history
- Claims Ledger: create a claim and run AI Draft Claims
- AI Review: create a prompt version
- AI Learning: visit `/ai-learning`
- User Management: visit `/admin/users`
- Assisted Apply: create a safe session record
- Freelance Copilot: create profile, capture project

---

## Step 9: Update DNS CNAME (if you haven't already)

After the app is created, DigitalOcean will show you the app's default URL (e.g., `job-ops-xxxxx.ondigitalocean.app`).

Go to **DigitalOcean → Networking → Domains → ldpro.io** and update the CNAME:

| Type | Hostname | Value |
|------|----------|-------|
| CNAME | `jops` | `job-ops-xxxxx.ondigitalocean.app.` |

Wait for DNS propagation (usually 1–5 minutes, up to 48 hours).

DigitalOcean will automatically provision a Let's Encrypt SSL certificate for `jops.ldpro.io`.

---

## Cost Estimate

| Resource | Monthly Cost |
|----------|-------------|
| API service (Basic, 0.5 GB) | $5.00 |
| Dashboard (Static Site) | $0.00 (included) |
| Database (Neon) | $0.00 (your existing Neon plan) |
| **Total** | **~$5.00/mo** |

---

## Known Production Constraints

- The app is human-in-the-loop. It does not log into job sites or submit applications automatically.
- Secure session cookies require proxy awareness; the API sets `trust proxy` in production.
- The dashboard expects same-origin `/api/*` routing — the ingress rule is mandatory.
- Landing page: Unauthenticated visitors see the public marketing page at `/`. Authenticated users redirect to `/dashboard`.
- AI Learning auto-promotion scheduler runs `node-cron` inside the API process (daily at 2 AM by default).
- User Management admin endpoints require `role = 'admin'` in the DB.

---

## Continuous Deployment

With `deploy_on_push: true`, every push to `main` on GitHub will automatically trigger a rebuild and redeploy of both the API and dashboard. No manual action needed after the initial setup.
