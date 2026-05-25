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
2. Open the dashboard, jobs, claims, base resume, resume queue, cover letters, applications, AI Review, Assisted Apply, Freelance, Chat, Quests/Gamification, and Job Board pages.
3. Save a base resume manually.
4. Import a DOCX or text-based PDF resume.
5. Restore a historical base resume version.
6. Create a manual claim.
7. Use AI Draft Claims from pasted notes and create selected drafts.
8. Confirm API errors show as destructive toasts with the actual server message.
9. Ingest a test job.
10. Run Parse JD, Tailor Resume, and Draft Cover Letter.
11. Open the resume queue and confirm the full tailored draft renders with base resume version metadata.
12. Approve or reject one pending version and confirm state changes persist.
13. Create an AI prompt version in AI Review.
14. Create an Assisted Apply session record.
15. Create a Freelance profile, capture a project, score it, and draft a proposal.
16. Check account settings and verify password/email/2FA flows still work.
17. Confirm event logs are still being written for AI calls.

## Expected Failure Modes

- Missing `AI_INTEGRATIONS_OPENROUTER_API_KEY`: AI routes return explicit errors.
- Missing latest DB schema push: new pages may return 500/missing table errors.
- Missing current base resume: resume tailoring returns a clear 400.
- Missing `SESSION_SECRET`: API fails at startup.
- Missing ingress `/api` prefix preservation: dashboard auth and API calls fail even if the service is running.
- Missing `ALLOWED_ORIGINS`: cross-origin login/session behavior fails when using split origins.
