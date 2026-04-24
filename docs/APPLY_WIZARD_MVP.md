# Apply Wizard MVP

The Apply Wizard is a guided, single-window flow for taking one job from intake to assisted-apply preparation.

## Enable the feature

Set this env var for the dashboard app:

```powershell
VITE_ENABLE_APPLY_WIZARD=true
```

Restart the dashboard dev server after changing env values.

## Where it appears

- Sidebar: `Wizard` (top nav item when enabled)
- Jobs Pipeline header: `Open Wizard` button
- Route: `/apply-wizard`

If the feature flag is disabled, the route still exists and renders a disabled notice card.

## MVP flow

1. **Intake**
   - Enter title, company, URL, JD text
   - Creates a `jobs` record
2. **Parse**
   - Runs JD parse pipeline
   - Lets you edit and reparse JD text
3. **Role + Claims**
   - Select existing role profile, or quick-create one inline
   - Review claim matches and choose claim IDs
4. **Tailor**
   - **System default mode**: generate one resume + one cover draft via configured task models
     - `POST /jobs/:id/tailor`
     - `POST /jobs/:id/cover-letter`
   - **Custom comparison mode**: choose up to 3 models for resume and up to 3 for cover letter
     - Hybrid picker searches full OpenRouter catalog (`GET /ai-model-catalog`)
     - Picker visually marks configured/default models from AI Config
     - Run compare calls:
       - `POST /jobs/:id/compare/resume`
       - `POST /jobs/:id/compare/cover-letter`
     - Select winner per artifact and promote:
       - `POST /jobs/:id/compare/promote-resume`
       - `POST /jobs/:id/compare/promote-cover-letter`
5. **Approve**
   - Approve/reject resume and cover letter versions
6. **Assisted Apply**
   - Create assisted apply session (`/application-sessions`)

## Safety and control

- Human-in-the-loop only
- No auto submission to external platforms
- Final submit remains manual
- Assisted session records enforce assist-only policy metadata
- Comparison metadata is logged for audit (`event_logs`)
- Only promoted winners are kept in normal resume/cover approval queues

## AI model behavior in wizard

- Normal wizard generation follows task routing in AI Config (`resume_tailoring`, `cover_letter`) with fallback chains.
- Custom comparison uses per-call model override without changing global AI Config defaults.
- OpenRouter catalog responses are cached briefly server-side for picker performance.

## Smoke test

1. Enable feature flag and restart dashboard.
2. Open `/apply-wizard`.
3. Enter job + JD and create job.
4. Run parser.
5. Create quick role profile inline and attach.
6. Select claim matches.
7. In Tailor step, choose one path:
   - System defaults: generate one resume and one cover letter.
   - Custom compare: select up to 3 models per artifact, run compare, pick winners, promote both.
8. Approve both promoted drafts.
9. Create assisted apply session.
10. Confirm summary IDs are populated:
   - Job ID
   - Role Profile ID
   - Resume Version ID
   - Cover Letter Version ID
   - Assisted Session ID
