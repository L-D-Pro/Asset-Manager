# Production Smoke Test

Use this after each deployment or configuration change.

## Automated Checks

The repo includes a script at [smoke-test.ts](/c:/Users/uberc/Asset%20Manager%20Project/Asset-Manager/scripts/src/smoke-test.ts).

Required env vars:

- `JOB_OPS_BASE_URL`
- `JOB_OPS_USERNAME`
- `JOB_OPS_PASSWORD`

Optional env vars:

- `JOB_OPS_TOTP_TOKEN`
- `JOB_OPS_JOB_ID`
- `JOB_OPS_RUN_AI=true`

Example:

```bash
JOB_OPS_BASE_URL=https://your-domain \
JOB_OPS_USERNAME=admin \
JOB_OPS_PASSWORD='your-password' \
pnpm smoke:test
```

What it verifies:

- `/api/healthz`
- login
- optional TOTP step
- `/api/auth/me`
- protected reads for claims, jobs, resume versions, cover letters, and applications
- logout

If `JOB_OPS_RUN_AI=true` and `JOB_OPS_JOB_ID` is set, it also triggers:

- `POST /api/jobs/:id/parse`
- `POST /api/jobs/:id/tailor`
- `POST /api/jobs/:id/cover-letter`

## Manual Checks

Run these in the dashboard after the script passes:

1. Log in from a fresh browser session.
2. Open the dashboard, jobs, claims, resume queue, cover letters, and applications pages.
3. Confirm API errors show as destructive toasts with the actual server message.
4. Ingest a test job.
5. Run Parse JD, Tailor Resume, and Draft Cover Letter.
6. Open the resume queue and confirm the full tailored draft renders.
7. Approve or reject one pending version and confirm state changes persist.
8. Check account settings and verify password/email/2FA flows still work.
9. Confirm event logs are still being written for AI calls.

## Expected Failure Modes

- Missing `AI_INTEGRATIONS_OPENROUTER_API_KEY`: AI routes return explicit errors.
- Missing `SESSION_SECRET`: API fails at startup.
- Missing ingress `/api` prefix preservation: dashboard auth and API calls fail even if the service is running.
- Missing `ALLOWED_ORIGINS`: cross-origin login/session behavior fails when using split origins.
