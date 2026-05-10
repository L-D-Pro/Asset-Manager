# Job Ops User Guide

> Internal/private tool only. Job Ops is a single-user, human-in-the-loop job application operations platform. It is not a mass auto-apply bot. Every AI output must be reviewed before use.

Last updated: May 10, 2026

## 1. What Job Ops Does

Job Ops helps manage a careful, truthful job search:

- Track jobs, applications, outcomes, and AI-generated drafts.
- Maintain a global base resume with immutable version history.
- Maintain a Claims Ledger of verified factual claims.
- Tailor resumes and cover letters using only approved claims.
- Draft claims from notes or DOCX/PDF uploads, but never insert AI claims automatically.
- Track prompt versions, AI runs, evaluations, and future training examples.
- Scaffold assisted-apply sessions without bypassing site rules.
- Draft Upwork-style freelance proposals for human review and manual submission.

Core principles:

- Quality over quantity.
- Truthfulness over embellishment.
- Human approval before use.
- Full auditability.
- Account safety and terms-aware automation.

## 2. Current Status

The app is ready for private testing after the latest schema is pushed to the configured PostgreSQL database.

| Area | Status | Notes |
| --- | --- | --- |
| Session auth | Ready | Admin bootstrap, login/logout, account settings, protected routes |
| Base Resume | Ready | Plain text editor, immutable history, restore, DOCX/PDF import |
| Claims Ledger | Ready | CRUD plus AI Draft Claims from pasted text or DOCX/PDF |
| Jobs Pipeline | Ready | Manual JD ingest, parse, score, claim matches |
| Resume tailoring | Ready | Uses current base resume + claims, creates full tailored draft |
| Cover letters | Ready | Claim-attributed draft paragraphs with approval gate |
| AI Learning | Ready | Closed-loop feedback, Bayesian A/B testing (prompts + models), variant leaderboard, auto-recompute, agent roles, health monitoring |
| Assisted Apply | Foundation ready | Safe session/action scaffolding only; no browser worker yet |
| Freelance Copilot | Foundation ready | Profiles, projects, scoring, proposal draft queue |
| Trends & Market Research | Ready | AI market analysis, skills/certs/trends, job board aggregation |
| External site auto-submit | Not implemented | Intentionally deferred and restricted |

Run the schema sync before testing new pages:

```powershell
corepack pnpm --filter @workspace/db run push
```

If `push` fails due to schema drift, use the compatibility patch:

```powershell
corepack pnpm --filter @workspace/db run compat
```

## 3. Quick Start

1. Configure environment variables in `.env` or production env:

```bash
DATABASE_URL=postgresql://...
SESSION_SECRET=at-least-32-random-characters
AI_INTEGRATIONS_OPENROUTER_API_KEY=sk-or-v1-...
AI_INTEGRATIONS_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
ADMIN_USERNAME=admin
ADMIN_PASSWORD=...
ADMIN_EMAIL=...
```

2. Push schema:

```powershell
corepack pnpm --filter @workspace/db run push
```

3. Start locally:

```powershell
corepack pnpm run dev
```

4. Open the dashboard and log in.

5. Go to **Base Resume** and paste or import your source resume.

6. Go to **Claims Ledger** and create claims manually or use **AI Draft Claims**.

7. Go to **AI Config** and configure at least:

- `default`
- `jd_parsing`
- `claim_generation`
- `resume_tailoring`
- `cover_letter`
- `proposal_drafting`

8. Ingest a job, parse it, score it, tailor a resume, draft a cover letter, then review the queues.

## 4. Main Modules

### Dashboard

Shows application and job overview stats. Use it as the top-level operating console.

### Base Resume

Path: `/base-resume`

The global source-of-truth resume for tailoring.

- Saving text creates a new immutable current version.
- Importing DOCX/PDF extracts text server-side and stores only the extracted text.
- Restoring history clones the old version into a new current version.
- Scanned/image-only PDFs are not supported because V1 does not do OCR.

### Claims Ledger

Path: `/claims`

Claims are atomic verified facts. The AI may rephrase claims, but should not invent unsupported achievements.

AI Draft Claims:

- Accepts pasted notes/project summaries.
- Optionally accepts DOCX/PDF upload.
- Returns editable draft claims.
- Requires user selection before creating real Claims Ledger rows.

### Jobs Pipeline

Path: `/jobs`

Use this page to paste job descriptions and track job status.

Job detail supports:

- Parse JD.
- Score against role profiles.
- View claim matches.
- Tailor resume.
- Draft cover letter.

Resume tailoring requires a current base resume. If no base resume exists, `/jobs/:id/tailor` returns a clear `400` error.

### Apply Wizard

Path: `/apply-wizard` (feature-flagged via `VITE_ENABLE_APPLY_WIZARD=true`)

The wizard is a guided single-job flow: Intake -> Parse -> Role + Claims -> Tailor -> Approve -> Assisted Apply.

Tailor step supports two modes:

- **System defaults**
  - Generates one resume + one cover letter from AI Config routing.
  - Uses:
    - `POST /jobs/:id/tailor`
    - `POST /jobs/:id/cover-letter`
- **Custom model comparison (up to 3 per artifact)**
  - Resume and cover letter are compared independently.
  - Uses hybrid model picker backed by `GET /ai-model-catalog`:
    - searches full OpenRouter model catalog
    - marks configured/default models from AI Config
  - Compare endpoints:
    - `POST /jobs/:id/compare/resume`
    - `POST /jobs/:id/compare/cover-letter`
  - Promote winner endpoints:
    - `POST /jobs/:id/compare/promote-resume`
    - `POST /jobs/:id/compare/promote-cover-letter`

Comparison runs log metadata for auditability in `event_logs`. Only promoted winners are persisted as normal queue versions.

### Resume Queue

Path: `/resume-versions`

Shows pending/approved/rejected tailored resume drafts.

Each generated resume version stores:

- `baseResumeVersionId`
- `tailoredDocumentText`
- validated `tailoredBullets`
- `diffData`
- `claimIds`

Approval/rejection is a strict state machine. Repeating an approval or rejection returns `409`.

### Cover Letters Queue

Path: `/cover-letters`

Shows cover letter drafts generated from selected/matched claims. Body and hook paragraphs require valid claim attribution.

### Applications

Path: `/applications`

Tracks application lifecycle, documents used, platform, confirmation reference, notes, and assisted/auto mode metadata.

### Feedback Signals

Path: `/feedback`

Logs outcomes and learning signals, including interviews, offers, rejections, no-response, resume review notes, and cover letter revision notes.

Feedback now has fields to connect outcomes back to jobs, role profiles, base resume versions, resume versions, cover letters, prompt versions, model names, selected claims, and final results.

### AI Config

Path: `/ai-config`

Configures model routing by task scope. The API selects the active config with the lowest priority value and can follow fallback chains.

Wizard-specific behavior:

- System-default wizard generation uses normal task-scope routing (`resume_tailoring`, `cover_letter`) and fallback chains.
- Custom wizard comparison uses per-call `modelOverride` so experiments do not change global AI Config defaults.
- The model picker uses `GET /ai-model-catalog`, which is OpenRouter-backed and briefly cached server-side.

Important task scopes:

- `default`
- `jd_parsing`
- `claim_generation`
- `resume_tailoring`
- `cover_letter`
- `job_fit_scoring`
- `project_fit_scoring`
- `proposal_drafting`
- `validation`

### AI Review

Path: `/ai-review`

The foundation for self-learning:

- Shows recent AI events.
- Creates prompt versions.
- Tracks active prompt versions by task.
- Stores AI run evaluations.
- Stores curated training examples for future few-shot prompts/evals/fine-tuning.

This is not fine-tuning yet. It is prompt/version/evaluation learning.

### Assisted Apply

Path: `/assisted-apply`

Tracks safe, human-approved application assistance sessions.

Current behavior:

- Creates session audit records.
- Tracks platform, target URL, current step, and human checkpoint.
- Logs future fields/actions through API scaffolding.

Not implemented yet:

- Browser extension.
- Playwright worker.
- Site adapters that fill forms.
- Login/session storage.
- Automatic submission.

### Freelance Copilot

Path: `/freelance`

Supports Upwork-style project/proposal operations in an assist-only way:

- Create contractor/freelance profiles.
- Capture project descriptions manually.
- Score project fit.
- Draft proposals using the contractor profile.
- Store proposal outcomes.

The app does not scrape Upwork, auto-refresh feeds, auto-bid, or send messages automatically.

### Trends & Market Research

Path: `/trends`

Research job market conditions with AI-generated analysis:

- Enter a job title (required) and optionally a location, experience level, and target salary.
- Click **Analyze Market** to generate analysis across five tabs:
  - **Overview**: Demand level, competition, salary alignment vs market.
  - **Skills**: In-demand technical, soft, and domain skills ranked by frequency.
  - **Certifications**: Recommended certifications with demand ratings and value estimates.
  - **Trends**: Emerging technologies, declining skills, and industry shifts.
  - **Action Plan**: Prioritized checklist (immediate, short-term, long-term) to improve your candidacy.
- View salary range insights (low, median, high) and key factors.
- Browse matching job listings from aggregated RSS feeds below the analysis.
- Results are cached for 24 hours to reduce AI costs; subsequent searches for the same job title return instantly.

### Job Board Configuration

Administrators configure RSS/Atom feed sources via the `JOB_SOURCE_CONFIG` environment variable (JSON array). Feeds refresh automatically every 30 minutes.

Example:

```json
[
  {
    "key": "example-careers",
    "name": "Example Careers",
    "feedUrl": "https://example.com/careers/feed.xml",
    "sourceType": "rss",
    "category": "tech",
    "keywords": ["software", "engineer"]
  }
]
```

## 5. AI Strategy

Job Ops does not currently fine-tune a model. It improves AI behavior through:

1. Better inputs: base resume, claims, role profiles, job text, project text.
2. Prompt versions: task-specific prompt templates can override built-in prompts.
3. Model routing: each task can use a different OpenRouter model.
4. Evaluations: AI outputs can be reviewed and scored.
5. Training examples: approved or human-edited outputs can be curated for future use.
6. Feedback signals: real-world outcomes are stored for future correlation.

Fine-tuning should wait until there are enough high-quality, human-approved examples and terms-safe training data.

## 6. Assisted Apply Policy

LinkedIn, Indeed, ZipRecruiter, Upwork, and many company career sites restrict unauthorized automation.

Allowed:

- Draft answers.
- Draft resumes, cover letters, proposals, and messages.
- Copy approved content.
- Capture user-opened pages with permission.
- Fill fields after explicit approval on permitted/whitelisted flows.
- Use official APIs if approved.

Not allowed:

- Bypassing MFA/CAPTCHA.
- Stealth login bots.
- Exported-cookie/session-token automation.
- Mass auto-apply.
- Automatic final submission on prohibited platforms.
- Unauthorized Upwork scraping or auto-bidding.

## 7. Smoke Test

After pulling changes and pushing schema:

1. Log in and refresh the page.
2. Save a base resume.
3. Import DOCX/PDF base resume.
4. Restore a prior base resume version.
5. Create a manual claim.
6. Draft claims from pasted text and create selected drafts.
7. Ingest a job.
8. Parse JD.
9. Score job.
10. Tailor resume.
11. Draft cover letter.
12. Approve/reject resume and cover letter.
13. Create an AI prompt version.
14. Create an assisted-apply session.
15. Create freelance profile.
16. Capture freelance project.
17. Score freelance project.
18. Draft proposal.

### GSD A/B Prompt Verification (No Existing Data)

Use this when GSD asks for:
- `taskScope`
- `windowStart` / `windowEnd` (ISO)
- Prompt Version A ID
- Prompt Version B ID

#### Step 1: Prepare baseline app data

1. Go to `Base Resume` and save a resume.
2. Go to `Claims Ledger` and create at least 3-5 claims.
3. Go to `Jobs Pipeline` and ingest at least 2 jobs with full JD text.
4. Parse each JD.

#### Step 2: Create Prompt Version A (baseline)

1. Go to `AI Review`.
2. In **Create Prompt Version**, fill:
   - Task Scope: `resume_tailoring`
   - Label: `baseline-v1`
   - Version Number: `1`
   - System Prompt: simple baseline prompt (example: `You are a resume writer.`)
   - User Prompt Template: keep `{{userPrompt}}`
   - Check **Make active for this task**
3. Click **Save Prompt Version**.

#### Step 3: Generate runs for Version A

1. Return to `Jobs Pipeline`.
2. For 1-2 jobs, click **Tailor Resume**.
3. Open `Resumes (Queue)` and approve or reject each generated resume.

#### Step 4: Create Prompt Version B (improved)

1. Go back to `AI Review`.
2. Create a second prompt version:
   - Task Scope: `resume_tailoring`
   - Label: `improved-v2`
   - Version Number: `2`
   - System Prompt: your stronger truth-locked prompt
   - User Prompt Template: `{{userPrompt}}`
   - Check **Make active for this task**
3. Save.

#### Step 5: Generate runs for Version B

1. In `Jobs Pipeline`, tailor resumes for 1-2 jobs (same style of jobs if possible).
2. In `Resumes (Queue)`, approve/reject those outputs.

#### Step 6: Capture values for GSD

In `AI Review`, copy these values:
- `taskScope`: `resume_tailoring`
- Prompt Version A ID: the row with `baseline-v1`
- Prompt Version B ID: the row with `improved-v2`

Use a time window that covers both test rounds, for example:
- `windowStart`: start time before Step 3
- `windowEnd`: end time after Step 5

ISO example:
- `windowStart`: `2026-04-21T00:00:00Z`
- `windowEnd`: `2026-04-22T23:59:59Z`

#### Step 7: Send to GSD

Provide exactly:

```text
taskScope: resume_tailoring
windowStart: <ISO>
windowEnd: <ISO>
promptVersionAId: <baseline-v1 id>
promptVersionBId: <improved-v2 id>
```

## 8. Troubleshooting

### New pages return 500 or missing table errors

Run:

```powershell
corepack pnpm --filter @workspace/db run push
```

If that fails, apply the runtime compatibility patch:

```powershell
corepack pnpm --filter @workspace/db run compat
```

This executes `lib/db/runtime-compat.sql` which creates missing tables/columns required by Assisted Apply, Freelance Copilot, and M002 lineage features.

### AI calls fail

Check:

- `AI_INTEGRATIONS_OPENROUTER_API_KEY`
- `AI_INTEGRATIONS_OPENROUTER_BASE_URL`
- Active AI model config exists for the task or `default`
- OpenRouter account limits
- Model ID exists on OpenRouter

### Resume tailoring returns 400

Save or import a current base resume first.

### PDF import produces empty text

The PDF is likely scanned/image-only. V1 does not do OCR. Paste text manually or use a text-based PDF/DOCX.

### Proposal drafting fails

Configure `proposal_drafting` or `default` in AI Config and ensure the project has a linked freelance profile.

## 9. Changelog

See `docs/CHANGELOG.md` for detailed version history.

### Version 0.2 (April 20, 2026)
- M002 Regression Audit: Fixed database schema drift affecting Assisted Apply, Freelance Copilot, and AI Metrics
- Added `runtime-compat.sql` for reliable schema reconciliation
- Fixed AI Metrics backend route mounting and frontend crash resilience
- Added `pnpm --filter @workspace/db run compat` command

## 10. Roadmap

Near-term:

- Apply runtime compatibility patch to production database.
- Browser validation of Assisted Apply, Freelance Copilot, AI Metrics pages.
- Add richer AI evaluation UI.
- Add export/copy/PDF for approved resumes, cover letters, and proposals.
- Add browser extension MVP for user-opened page capture.

Later:

- Playwright apply worker for permitted/whitelisted ATS flows.
- Outcome analytics correlating claims, prompts, models, and interviews/offers.
- Official API integrations where allowed.
- Fine-tuning only after enough approved examples exist.

## 11. AI Learning Dashboard

The AI Learning Dashboard (`/dashboard/ai-learning`) is the control center for the self-evolution pipeline. It shows how the AI is improving over time and lets you manage prompt versions, model configurations, and agent roles.

### 11.1 Access

Navigate to **AI Learning** from the dashboard sidebar. Requires admin authentication.

### 11.2 Health Overview

The top section shows system health:
- **Status badge**: Healthy (green) / Warning (yellow) / Degraded (red) based on data flow
- **Unprocessed signals**: Count of feedback signals waiting to be incorporated into learning
- **Variant stats**: Total aggregated performance records across all task scopes
- **Comparisons**: Bayesian A/B test results between prompt versions and models
- **Suggested promotions**: Winning variants ready for your approval

### 11.3 Loop Status

Shows the state of the feedback → learning → improvement loop:
- **Signal counts**: Processed vs unprocessed feedback signals
- **Last recompute**: When the Bayesian engine last ran
- **Variant breakdown**: Performance stats per variant type (prompt vs model) across all task scopes
- **Waiting state**: A notice appears when not enough data has accumulated (below `minSampleSize`)

### 11.4 Agent Roles

Displays all 8 AI agent roles as cards:
- **Resume Expert**, **Cover Letter Strategist**, **Application Analyst** (JD Parser)
- **Claim Generator**, **Proposal Drafter**, **Market Researcher**
- **Gap Analyst**, **Job Researcher**

Each card shows:
- Role label and task scope badge
- Active/inactive status
- **Personality**: The agent's behavioral instructions
- **Goals**: What the agent optimizes for
- **Skill tags**: Specific capabilities (e.g., "ats-optimization", "tone-matching")

Agent roles are configured in the database via `ai_prompt_versions` and can be edited through the API.

### 11.5 Variant Leaderboard

A performance ranking table showing:
- **Variant**: Prompt version label or model name
- **Type**: "prompt" or "model"
- **Task scope**: Which pipeline the variant serves
- **Successes / Failures / Pending**: Outcome counts from feedback signals
- **Success rate**: Percentage of positive outcomes
- **Sample size**: Total evaluations (must exceed `minSampleSize` for comparison)
- **Active badge**: Whether this variant is currently in use

### 11.6 Recompute Now

The **Recompute Now** button manually triggers the Bayesian learning engine:
- Queries all unprocessed feedback signals
- Aggregates performance stats by variant (prompt AND model)
- Runs Bayesian comparisons between variants
- Marks signals as processed
- Updates the leaderboard and promotion suggestions

Auto-recompute can be enabled via **Learning Configuration** (`autoRecomputeEnabled`). When enabled, creating feedback signals automatically triggers recompute when enough unprocessed signals accumulate (threshold: `minSampleSize`).

### 11.7 Promote Suggestions

When a variant statistically outperforms its peers (confidence > 95%, sample size ≥ 10, improvement margin > 5%), it appears as a **promotion suggestion**. You must manually approve promotions — the system never auto-promotes without your consent. Model promotions require extra care as they impact cost and latency.
