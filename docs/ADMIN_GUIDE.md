# Job Ops Admin Guide

> Internal documentation for platform administrators. Contains technical architecture, database details, deployment procedures, and security considerations. Do not share with pilot users.

Last updated: April 29, 2026

## 1. Architecture

| Layer | Tech | Notes |
|-------|------|-------|
| API Server | Express 5, Node.js 24.x | Session-based auth, bcrypt password hashing, TOTP 2FA |
| Frontend | React 19, Vite, Tailwind | TanStack Query for server state, shadcn/ui components |
| Database | PostgreSQL (Neon) | Drizzle ORM, migrations via drizzle-kit or runtime-compat.sql |
| AI | OpenRouter API | JD parsing, resume tailoring, cover letter drafting |
| Email | Resend | Transactional emails (verification, welcome, password reset) |
| Hosting | DigitalOcean App Platform | API + Dashboard deployed as apps |
| Session Store | connect-pg-simple | PostgreSQL-backed session table |

## 2. Database Schema

### Core Tables
- `admin_users` — All user accounts (admin + pilot users). Includes email verification, pilot enrollment, UTM tracking
- `jobs` — Job listings with parsed fields and status tracking
- `claims` — Verified factual claims for resume tailoring
- `base_resume_versions` — Immutable base resume history
- `resume_versions` — Job-tailored resume versions
- `cover_letter_versions` — Drafted cover letters with claim attribution
- `applications` — Application records tracking

### Auth & Pilot Tables
- `invite_codes` — Pilot invitation codes with maxUses, usedCount, expiry
- `user_usage_limits` — Weekly AI request quotas (default 5/week)
- `wizard_sessions` — Saved wizard progress for resume/restore
- `session` — connect-pg-simple session store

### AI Tables
- `ai_prompt_versions` — Prompt templates with versioning
- `ai_run_evaluations` — AI call logs with inputs/outputs
- `ai_model_configs` — Per-model configuration
- `ai_training_examples` — Training data from feedback signals
- `ai_learning_config` — Bayesian optimizer settings

### Event & Feedback
- `event_logs` — Audit log for mutations
- `feedback_signals` — Application outcome tracking (interview, offer, etc.)

## 3. Environment Variables

Required in `.env`:

```bash
DATABASE_URL=postgresql://...
SESSION_SECRET=<random-64-char>
RESEND_API_KEY=re_...
FROM_EMAIL=Job Ops <noreply@jops.ldpro.io>
AI_INTEGRATIONS_OPENROUTER_API_KEY=sk-or-v1-...
AI_INTEGRATIONS_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong-password>
ADMIN_EMAIL=<email>
```

For wizard feature: `VITE_ENABLE_APPLY_WIZARD=true`

## 4. Database Operations

### Push schema changes
```powershell
# Load DATABASE_URL from .env first
$env:DATABASE_URL = (Select-String -Path .env -Pattern "^DATABASE_URL=(.*)" | ForEach-Object { $_.Matches.Groups[1].Value })

# Push via drizzle-kit (TUI interactive)
corepack pnpm --filter @workspace/db run push

# Or apply runtime compat migration (non-interactive)
corepack pnpm --filter @workspace/db run compat
```

### Bootstrap admin user
On first run with `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL` in `.env`, a bootstrap admin is created automatically.

### Make existing user admin
```sql
UPDATE admin_users SET role = 'admin' WHERE id = 1;
```

## 5. Deployment (DigitalOcean)

API Server: `run_command` in `app.yaml` overrides package.json `start` script.
Dashboard: Static site build with `VITE_API_BASE_URL=/api`.

### After deploy
1. Push DB schema: `compat` script
2. Verify admin account works
3. Generate invite codes via admin panel or API

## 6. Admin Dashboard

Accessible at sidebar > Account section (admin only):
- **User Management** — `/admin/users` — Create, edit, delete users. Password resets.
- **Invite Codes** — `/admin/invite-codes` — Generate codes (maxUses, expiry). Revoke active codes.
- **Usage Limits** — `/admin/usage-limits` — View all users' weekly usage. Edit weekly limits per user.

## 7. API Endpoints

### Public
- `POST /api/auth/register` — Registration with invite code
- `POST /api/auth/login` — Username + password
- `POST /api/auth/login/totp` — TOTP verification
- `POST /api/auth/logout` — Destroy session
- `GET /api/auth/verify-email/:token` — Email verification
- `POST /api/auth/resend-verification` — Resend verification email
- `POST /api/auth/forgot-password` — Request reset
- `POST /api/auth/reset-password` — Confirm reset
- `POST /api/invite-codes/validate` — Validate invite code
- `GET /api/auth/me` — Current user info

### Admin (requireAuth + admin role)
- `GET /api/users` — List users
- `POST /api/users` — Create user
- `PUT /api/users/:id` — Update user
- `DELETE /api/users/:id` — Delete user
- `GET /api/invite-codes` — List codes
- `POST /api/invite-codes` — Generate code
- `DELETE /api/invite-codes/:id` — Revoke code
- `GET /api/usage-limits` — List all limits
- `PATCH /api/usage-limits/:userId` — Edit limit

### User (requireAuth)
- `GET /api/jobs`, `POST /api/jobs`, `GET /api/jobs/:id`, `PATCH /api/jobs/:id`, `DELETE /api/jobs/:id`
- `POST /api/jobs/:id/parse` — AI JD parsing
- `POST /api/jobs/:id/tailor` — Resume tailoring
- `POST /api/jobs/:id/draft-cover-letter` — Cover letter drafting
- `GET /api/usage-limits/me` — Current user's quota

## 8. Security

- Passwords: bcrypt (cost factor 12)
- Sessions: PostgreSQL-backed, httpOnly cookies, sameSite strict in production
- 2FA: TOTP with single-use recovery codes
- Rate limiting: login (5/15min), TOTP (10/15min)
- Email verification required before login for pilot users
- Usage limits enforced at API layer on AI endpoints
- Do not expose: `passwordHash`, `totpSecret`, `totpRecoveryCodes` in API responses

## 9. Troubleshooting

### Drizzle push fails (TUI blocks)
Use the compat script instead — it applies `runtime-compat.sql` via raw SQL.

### Session issues after deploy
Clear cookies, ensure `SESSION_SECRET` matches, check PostgreSQL session table exists.

### Email not sending
Check `RESEND_API_KEY` and `FROM_EMAIL` in `.env`. Verify domain DNS records at resend.com/domains.

### User can't log in
Check `email_verified = true` and `is_active = true` in `admin_users` table.

### Usage limit not working
Check `user_usage_limits` table has a row for the user. Limits are auto-created on registration.

## 10. Monitoring

- API logs via pino (console + structured)
- Database query logging via drizzle
- Email delivery logs via Resend dashboard
- DigitalOcean app metrics for CPU/memory
- Session activity via PostgreSQL `session` table
