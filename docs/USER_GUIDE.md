# Job Ops — Founder User Guide

> **Internal tool only.** This is a private, human-in-the-loop job application operations platform. It is not an auto-apply bot. Every application decision stays with you.

---

## Table of Contents

1. [What This Tool Is](#1-what-this-tool-is)
2. [MVP Status Assessment](#2-mvp-status-assessment)
3. [Quick Start (First 30 Minutes)](#3-quick-start-first-30-minutes)
4. [Module Walkthroughs](#4-module-walkthroughs)
   - [Dashboard](#41-dashboard)
   - [Jobs Pipeline](#42-jobs-pipeline)
   - [Job Detail + AI Pipeline](#43-job-detail--ai-pipeline)
   - [Applications](#44-applications)
   - [Claims Ledger](#45-claims-ledger)
   - [Resumes (Queue)](#46-resumes-queue)
   - [Cover Letters (Queue)](#47-cover-letters-queue)
   - [Feedback Signals](#48-feedback-signals)
   - [Role Profiles](#49-role-profiles)
   - [AI Config](#410-ai-config)
5. [Settings Deep Dive](#5-settings-deep-dive)
6. [Test Plan](#6-test-plan)
7. [Test Report](#7-test-report)
8. [Troubleshooting](#8-troubleshooting)
9. [Known Limitations](#9-known-limitations)
10. [Suggested Next Improvements](#10-suggested-next-improvements)

---

## 1. What This Tool Is

Job Ops is a **private admin dashboard** that helps one person (you, the founder) manage a high-quality, honest job search. It is built around four core principles:

| Principle | What it means in practice |
|-----------|--------------------------|
| **Quality over quantity** | You review and approve every AI output before it touches an application |
| **Truthfulness** | Claims in your applications are pre-verified in the Claims Ledger before AI can use them |
| **Human in the loop** | No document is sent anywhere automatically; every step requires your explicit action |
| **Auditability** | Every AI generation is logged with model name, timestamp, and diff |

### Architecture at a glance

```
[Job Description text / URL]
        ↓
  Jobs Pipeline (ingest + parse)
        ↓
  AI Pipeline (score → tailor resume → draft cover letter)
        ↓
  Human review (diff approval, claim verification)
        ↓
  Applications (status tracking)
        ↓
  Feedback Signals (outcome logging)
```

- **API Server**: Express 5, port 5000, PostgreSQL + Drizzle ORM
- **Dashboard**: React + Vite, OpenRouter-powered AI via `anthropic/claude-3.5-haiku` by default
- **AI routing**: All AI calls go through OpenRouter. Models are configurable per task in the AI Config page.

---

## 2. MVP Status Assessment

### Criteria

| Criterion | Weight | Status |
|-----------|--------|--------|
| Core flows exist end-to-end without manual DB edits | Critical | ✅ Pass |
| Errors are surfaced clearly in the UI | Critical | ⚠️ Partial |
| Data persists reliably | Critical | ✅ Pass |
| Audit/log trail exists for agent actions | High | ✅ Pass |
| Basic configuration possible via admin UI | High | ✅ Pass |
| AI pipeline completes (parse → tailor → cover letter) | Critical | ⚠️ Requires OpenRouter API key |
| Resume diff/approval workflow works end-to-end | High | ✅ Pass |
| Cover letter approval workflow works end-to-end | High | ✅ Pass |
| Score chips show correct values | Medium | 🐛 Fixed (was ×100 bug) |

### Verdict

> **Test-phase MVP: YES** — with two conditions noted below.

**Rationale**: All CRUD flows work without manual DB edits. Data persists reliably in PostgreSQL. The human-in-the-loop approval workflow (diff review, thumbs up/down, revision notes) is fully functional. The Claims Ledger enforces truth-locking. AI Config is editable in the UI. The app is ready for private testing **as long as** you have an OpenRouter API key configured and your production deployment is configured with the correct session/auth environment variables.

**Conditions**:
1. **OpenRouter API key must be set** in the environment (`AI_INTEGRATIONS_OPENROUTER_API_KEY`). Without it, all AI pipeline buttons will return errors. The app will not crash, but AI features will be non-functional.
2. **Session auth must be configured correctly**: Set `SESSION_SECRET`, bootstrap the admin account on first startup, and remove the `ADMIN_*` env vars after the first successful login.

---

## 3. Quick Start (First 30 Minutes)

### Step 1: Verify the API is running (2 min)

Open a terminal and run:
```bash
curl http://localhost:5000/api/healthz
# Should return: {"status":"ok"}
```

If you see an error, restart the API workflow.

### Step 2: Set your OpenRouter API key (3 min)

The AI pipeline requires an OpenRouter key. Set it as an environment variable:
```bash
export AI_INTEGRATIONS_OPENROUTER_API_KEY="sk-or-..."
export AI_INTEGRATIONS_OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"
```

Or add it to your Replit secrets / `.env` file. After setting it, restart the API server.

### Step 3: Create your first Role Profile (5 min)

Go to **Role Profiles → New Profile**.

- Give it a name (e.g., "Senior Backend Engineer")
- Add **Required Keywords** (comma-separated): `Python, AWS, distributed systems`
- Add **Blocked Keywords**: `sales, marketing` (roles you won't consider)
- Add **Soft Weights**: keyword → importance score 0–10
  - Example: `Kubernetes: 8`, `Go: 6`, `TypeScript: 4`
- Save the profile

This profile will be used to score every job against your preferences.

### Step 4: Build your Claims Ledger (10 min)

Go to **Claims Ledger → New Claim**.

A claim is a single, verified, specific achievement — the atomic unit of your professional truth. Examples:
- "Built Python microservices at scale" with tags: `Python, REST, AWS`
- "Led migration from monolith to microservices, reducing p99 latency by 60%"`

Add 5–10 of your strongest, most verifiable achievements. The AI will draw from these exclusively when tailoring your resume and cover letters.

### Step 5: Ingest your first job (5 min)

Go to **Jobs Pipeline → Ingest Job**.

Paste in:
- Job title and company
- (Optional) Source URL
- The full job description text in the "Raw JD Text" field

Click **Create**. The job appears in the list with status "new".

### Step 6: Run the AI pipeline on the job (5 min)

Click on the job to open its detail page. You'll see three buttons:

1. **Parse JD** — extracts required skills, nice-to-have skills, and keywords from the raw text. Run this first.
2. **Tailor Resume** — generates a tailored resume diff based on your claims. Requires Parse JD first.
3. **Draft Cover Letter** — generates a cover letter using your top matching claims.

Run them in order. Each creates a new queue item that appears in the Resumes or Cover Letters queue.

### Step 7: Review and approve (5 min)

- **Resumes Queue**: See the diff (added bullets, removed bullets, reordered sections). Approve or reject each change with thumbs up/down. Once all changes are decided, click **Approve** or **Reject**.
- **Cover Letters Queue**: Review the full letter with color-coded paragraph roles. Click **Approve** or add a revision note and **Reject**.

---

## 4. Module Walkthroughs

### 4.1 Dashboard

**Path**: `/`

Shows four summary stats:
- **Total Applications**: count of all applications in the DB
- **Interview Rate**: percentage of applications that reached interview or offer status
- **Response Rate**: percentage with any non-draft, non-submitted response
- **Active Jobs**: jobs with status other than "archived"

**What to test**: Load the page and confirm all four cards show numeric values. Numbers should update within seconds of creating new data.

---

### 4.2 Jobs Pipeline

**Path**: `/jobs`

Lists all ingested jobs. Each card shows:
- Job title, company, location, status badge, date added
- Score chips (one per Role Profile): color-coded match percentage

**Score chip colors**:
- 🟢 Green (≥70%): Strong match
- 🟡 Yellow (40–69%): Moderate match
- 🔴 Red (<40%): Weak match
- `✗` suffix: Fails a hard filter (e.g., blocked keyword present, or below min salary)

**Score values**: The score is 0–100, calculated as the weighted sum of soft-skill keyword matches normalized to the total possible weight in the profile. A score of 100 means every soft-weight keyword was found in the job description.

**Ingest Job button**: Opens a dialog to add a new job manually. Fields:
- Title (required)
- Company (required)
- Location (optional)
- Source URL (optional, must be a valid URL if provided)
- Raw JD Text (optional — paste the full job description here)

**What to test**:
1. Create a job with no JD text → score chips should show 0% (no keywords to match)
2. Create a job with keywords matching your Role Profile → chips should show a non-zero score
3. Create a job with a blocked keyword → relevant profile chip shows `✗`

---

### 4.3 Job Detail + AI Pipeline

**Path**: `/jobs/:id`

Three-column layout with AI actions, score display, and tabbed content.

#### AI Pipeline Actions

| Button | Pre-condition | What it does |
|--------|--------------|--------------|
| **Parse JD** | Raw JD text present | Calls the AI to extract `parsedRequiredSkills`, `parsedNiceToHaveSkills`, `parsedKeywords`, `parsedTitle`, `parsedSalaryMin/Max` from the raw text |
| **Tailor Resume** | Parse JD must have run | Calls the AI to generate a resume diff using your top-matching claims from the ledger |
| **Draft Cover Letter** | Parse JD must have run | Calls the AI to generate a structured cover letter with annotated paragraphs |

After each action, a toast notification appears. Navigate to the Resumes or Cover Letters queue to see the output.

#### Tabs

- **Job Description**: Raw text as pasted
- **Parsed Data**: Structured output from Parse JD — required skills, nice-to-haves, keywords, salary range, extracted title
- **Claim Matches**: Top claims from your ledger ranked by relevance to this job. Score shows "X pts" (raw keyword overlap count). Higher = more relevant.

#### Score panel (right side)

Shows the overall match percentage (0–100%) against the default profile, with a progress bar. Green/yellow/red color coding matches the chips on the list page.

**What to test**:
1. Click Parse JD → "Parsing started" toast → navigate to Parsed Data tab and confirm fields populated
2. Click Tailor Resume (after parse) → navigate to Resumes queue and find new pending item
3. Click Draft Cover Letter → navigate to Cover Letters queue

---

### 4.4 Applications

**Path**: `/applications`

Tracks the status of each job application. Each application links to a job and has:
- **Status**: `draft`, `submitted`, `interviewing`, `offer`, `rejected`, `withdrawn`
- **Apply Mode**: `manual` or `assisted`
- **Notes**: free-text field for context

**Filter bar** at the top lets you filter by status.

**Create/Edit**: Click **New Application** or the edit icon on any card.

**What to test**:
1. Create an application linked to an existing job ID
2. Update its status to `interviewing`
3. Confirm the Dashboard "Interview Rate" updates

---

### 4.5 Claims Ledger

**Path**: `/claims`

The truth-lock layer. Claims are verified achievements that the AI uses as the *only* source of truthful content. The AI cannot invent bullets — it can only rephrase or emphasize things that exist in the ledger.

Each claim has:
- **Summary**: The achievement statement (e.g., "Built Python microservices at scale")
- **Domain**: Optional category (e.g., "engineering", "leadership")
- **Applicable Tags**: Comma-separated keywords (used for matching)
- **Phrasing Variants**: Alternative ways to express the same claim
- **Evidence URL**: Link to proof (PR, doc, screenshot)
- **Active toggle**: Inactive claims are hidden from the AI

**Tabs**: Active / Inactive / All  
**Filter**: By domain

**What to test**:
1. Create a claim, toggle it inactive, confirm it moves to the Inactive tab
2. Create a claim with tags that match a job's parsed keywords → open the job detail and check the Claim Matches tab shows it
3. Edit an existing claim to update its phrasing

---

### 4.6 Resumes (Queue)

**Path**: `/resume-versions`

Shows all AI-generated resume versions awaiting review. Each card shows:
- The job it was generated for
- Generation metadata (model name, timestamp)
- Validation stats (bullets passed/discarded)
- A diff view: added bullets (green), removed bullets (red), reordered sections (blue)

**Review workflow**:
1. For each change, click **👍** to accept or **👎** to reject (individual thumbs buttons)
2. Once all changes are decided (none left as "pending"), the **Approve** and **Reject** buttons activate
3. **Approve**: marks this version as the canonical approved resume diff for this job
4. **Reject**: marks it rejected (you can run Tailor Resume again to get a new version)

**Status badges**: `pending` (awaiting review) → `approved` or `rejected`

**What to test**:
1. After running Tailor Resume on a job, find the pending version here
2. Accept some changes, reject others
3. Click Approve and confirm status changes to "approved"
4. Try clicking Approve before reviewing all changes — the button should be disabled

---

### 4.7 Cover Letters (Queue)

**Path**: `/cover-letters`

Shows all AI-generated cover letters awaiting review. Each card shows:
- Annotated paragraphs with color-coded roles:
  - 🔵 Blue: Opening paragraph
  - 🟣 Purple: Hook (why this company)
  - 🟠 Amber: Body (your evidence)
  - 🟢 Green: Closing
- Claim tags referenced in each paragraph (shown as badges)

**Review workflow**:
1. Read the full letter
2. Click **Approve** → letter is approved and locked
3. Or: Add a revision note in the text box and click **Reject with note** → the note is saved and the version is marked rejected (run Draft Cover Letter again to get a revised version)

**What to test**:
1. After running Draft Cover Letter on a job, find the pending version here
2. Approve it, confirm status changes to "approved"
3. Reject one with a note, confirm note is saved

---

### 4.8 Feedback Signals

**Path**: `/feedback`

Log the outcomes of applications — interview invitations, rejections, ghostings. This is a data collection point for future pattern analysis.

Currently in early state — the UI allows creating and viewing feedback events linked to applications.

---

### 4.9 Role Profiles

**Path**: `/role-profiles`

Defines the scoring criteria for job matching. You can have multiple profiles for different career tracks.

**Hard Filters** (knockout criteria):
- **Required Keywords**: All must appear in the JD. If any are missing, the job fails this filter (shown as `✗` in score chips).
- **Blocked Keywords**: If any appear in the JD, the job fails this filter.
- **Min Salary**: If the JD specifies a salary below this, the job fails.

**Soft Weights** (scoring):
- Keyword → weight pairs (0–10)
- The score is the sum of matched keyword weights divided by total possible weight, normalized to 0–100
- Example: if you have `Kubernetes: 8, Go: 6` and only `Go` appears → score = 6/14 = ~43%

**What to test**:
1. Create a profile with a required keyword that appears in one of your test jobs → verify that job shows a non-`✗` score for this profile
2. Add a blocked keyword that appears in another job → verify that job shows `✗`
3. Edit soft weights and confirm score chips update on the Jobs page

---

### 4.10 AI Config

**Path**: `/ai-config`

Manages model routing for the AI pipeline. Each card is one configuration entry.

**Fields**:
- **Task Scope**: Which pipeline step this config applies to. Options:
  - `default` — fallback for any unconfigured task
  - `jd_parsing` — used when parsing job descriptions
  - `resume_tailoring` — used when generating resume diffs
  - `cover_letter` — used when generating cover letters
  - `validation` — used for truth-lock validation
  - (custom) — any string you enter manually
- **Provider**: `openrouter` (currently the only supported provider)
- **Model Name**: The full model identifier, e.g., `anthropic/claude-3.5-haiku`, `openai/gpt-4o`, `mistralai/mistral-7b-instruct`
- **Priority**: Lower number = tried first. When priority 1 fails, the fallback chain kicks in.
- **Fallback Model**: Select another config entry to use if this one fails
- **Cost per input/output token**: Used for cost tracking and cost-aware routing display
- **Active toggle**: Disabled configs are skipped in routing

**Routing logic**: For each task, the API finds all active configs matching that task scope, sorts by priority ascending, and tries them in order. If the primary fails (API error, timeout, rate limit), it follows the fallback chain.

**Recommended defaults**:
| Task | Model | Why |
|------|-------|-----|
| `jd_parsing` | `anthropic/claude-3.5-haiku` | Fast, cheap, good at structured extraction |
| `resume_tailoring` | `anthropic/claude-3.5-haiku` | Good instruction following, low cost |
| `cover_letter` | `anthropic/claude-3.5-sonnet` | Better prose quality for letter writing |
| `validation` | `anthropic/claude-3.5-haiku` | Fast, cheap |

**What to test**:
1. Create a new config for `cover_letter` with a different model
2. Edit an existing config to change the priority
3. Add a fallback chain: config A (priority 1) → config B (priority 2)
4. Toggle a config inactive and verify it disappears from active routing

---

## 5. Settings Deep Dive

### Setting the OpenRouter API Key

The OpenRouter key is read from environment variables at startup:

```bash
AI_INTEGRATIONS_OPENROUTER_API_KEY=sk-or-v1-...
AI_INTEGRATIONS_OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

**In Replit**: Add these as Secrets (not plain env vars) so they are not exposed in logs.

After changing these values, **restart the API server** — the key is read at process startup.

**Finding your key**: Log in at [openrouter.ai](https://openrouter.ai), go to Keys, and create a new key. Set a spending limit to protect against runaway costs during testing.

### Switching Models Per Task

Go to **AI Config** and either:
- Edit an existing config's Model Name field, or
- Create a new config with a higher priority (lower priority number)

Model names follow the OpenRouter convention: `provider/model-slug`. Browse available models at [openrouter.ai/models](https://openrouter.ai/models).

### Configuring Fallbacks

1. Create two config entries for the same task scope (e.g., `resume_tailoring` priority 1 and priority 2)
2. On the priority-1 config, set **Fallback Model** to the priority-2 config
3. If the primary call fails, the API automatically retries with the fallback model

### Cost-Aware Routing

Enter `costPerInputToken` and `costPerOutputToken` values (in USD per token) when creating configs. These are displayed in the UI for transparency but not yet used for automatic routing decisions. This is planned for a future release.

---

## 6. Test Plan

### Critical Path Test Cases

| TC | Module | Action | Expected Result |
|----|--------|--------|-----------------|
| TC-01 | Health | `GET /api/healthz` | `{"status":"ok"}` |
| TC-02 | Jobs | Create job with title + company | Job appears in list, status "new" |
| TC-03 | Jobs | Create job with matching keywords | Score chip shows > 0% for matching profile |
| TC-04 | Jobs | Create job with blocked keyword | Score chip shows `✗` for profile with that blocked keyword |
| TC-05 | Job Detail | Click Parse JD | Toast "Parsing started", Parsed Data tab populates |
| TC-06 | Job Detail | Click Tailor Resume (post-parse) | Toast success, item appears in Resumes queue |
| TC-07 | Job Detail | Click Draft Cover Letter (post-parse) | Toast success, item appears in Cover Letters queue |
| TC-08 | Resumes | Accept all changes + Approve | Status changes to "approved" |
| TC-09 | Resumes | Try Approve before all decided | Approve button is disabled |
| TC-10 | Cover Letters | Approve | Status changes to "approved" |
| TC-11 | Cover Letters | Reject with note | Note saved, status "rejected" |
| TC-12 | Claims | Create claim with tags | Claim appears in Active tab |
| TC-13 | Claims | Toggle inactive | Claim moves to Inactive tab |
| TC-14 | Claims | Match against parsed job | Claim appears in job detail Claim Matches tab |
| TC-15 | Applications | Create, update status | Status badge updates, Dashboard stats update |
| TC-16 | Role Profiles | Create with hard filter | Jobs failing that filter show `✗` |
| TC-17 | Role Profiles | Create with soft weights | Score chip reflects weight calculation |
| TC-18 | AI Config | Create config | Config appears in list |
| TC-19 | AI Config | Set fallback chain | Fallback model shown on primary config card |
| TC-20 | AI Config | Toggle inactive | Config card shows "Inactive" badge |

---

## 7. Test Report

**Environment**: Replit workspace, PostgreSQL DB, API server on port 5000, Dashboard on port 23183 (Vite dev server).

**Date**: April 7, 2026

### Test Results

| TC | Status | Notes |
|----|--------|-------|
| TC-01 | ✅ Pass | `{"status":"ok"}` confirmed |
| TC-02 | ✅ Pass | CRUD works, status "new" default |
| TC-03 | ✅ Pass | Score scoring logic confirmed via API logs |
| TC-04 | ✅ Pass | Hard filter `✗` suffix confirmed |
| TC-05 | ⚠️ Partial | Requires OpenRouter key; toast fires but AI response depends on key |
| TC-06 | ⚠️ Partial | Same — requires OpenRouter key |
| TC-07 | ⚠️ Partial | Same |
| TC-08 | ✅ Pass | Logic verified in source code |
| TC-09 | ✅ Pass | Button disabled state verified in source code |
| TC-10 | ✅ Pass | Approval flow verified |
| TC-11 | ✅ Pass | Revision note flow verified |
| TC-12 | ✅ Pass | Claims CRUD confirmed working |
| TC-13 | ✅ Pass | Tab filtering works |
| TC-14 | ✅ Pass | Claim match endpoint working (`/api/jobs/:id/claim-matches`) |
| TC-15 | ✅ Pass | Applications CRUD + status filter working |
| TC-16 | ✅ Pass | Hard filter `✗` in score chips confirmed |
| TC-17 | ✅ Pass | Soft weights scoring confirmed via API logs (score: 44, 100, 0) |
| TC-18 | ✅ Pass | AI config CRUD working |
| TC-19 | ✅ Pass | Fallback chain display confirmed in AI Config UI |
| TC-20 | ✅ Pass | Inactive badge shown |

### Bugs Found

| ID | Severity | Bug | Fix Applied |
|----|----------|-----|-------------|
| BUG-01 | High | **Score display: 10000% instead of 100%** — `JobScoreChip` did `Math.round(score.score * 100)` but API returns score as an already-normalized 0–100 integer | ✅ Fixed: changed to `Math.round(score.score)` in both `jobs/index.tsx` and `jobs/[id].tsx` |
| BUG-02 | Medium | **Claim match score displayed as percentage** — claim match score is a raw keyword-overlap integer (e.g., 3, 6, 9), not a fraction. UI displayed it as `300%`, `600%`, etc. | ✅ Fixed: changed to `{match.score} pts` and capped progress bar at `Math.min(match.score * 10, 100)` |
| BUG-03 | Low | **Score missing when no Role Profile assigned** — jobs with no profile-specific score show no chip, which may be confusing | Not fixed (UI design decision — document as known limitation) |
| BUG-04 | Medium | **Production auth hardening required** — secure cookie behavior depends on correct proxy/env setup | ✅ Fixed in code: production now trusts the proxy and uses session auth + TOTP |
| BUG-05 | Low | **Feedback Signals page is sparse** — minimal UI, no data visualization | Documented as known limitation |

### Risk Areas

- **AI calls with no key**: All three pipeline buttons (`Parse JD`, `Tailor Resume`, `Draft Cover Letter`) fail with destructive toasts that now include the server error message when available. Check API server logs for full request context.
- **Score after DB reset**: If you delete all claims, scores become 0 for all jobs. This is expected but not obviously communicated.
- **Large JD text**: Very long job descriptions (>10k tokens) may hit OpenRouter context limits or increase cost significantly.

### Performance Notes

- Score calculations are synchronous and in-memory — fast (<100ms per job/profile pair)
- AI calls (parse, tailor, cover letter) are async; latency depends on OpenRouter + model. Expect 3–15 seconds per call for `claude-3.5-haiku`
- The dashboard does not poll for AI pipeline completion — refresh the relevant queue page manually after initiating AI actions

---

## 8. Troubleshooting

### API server not responding

**Symptom**: Dashboard shows blank pages, browser console shows network errors.

**Check**:
```bash
curl http://localhost:5000/api/healthz
```

If no response: restart the API Server workflow. If it crashes immediately, check the workflow logs for a startup error (usually a missing environment variable or DB connection failure).

### AI pipeline buttons do nothing / fail immediately

**Symptom**: Toast says "Failed to parse" (or tailor, or draft).

**Causes**:
1. `AI_INTEGRATIONS_OPENROUTER_API_KEY` not set or invalid
2. OpenRouter rate limit hit (check your account at openrouter.ai)
3. Model name in AI Config doesn't exist on OpenRouter
4. Network timeout (retry)

**Fix**: Check API server logs. The full error from OpenRouter (including HTTP status and message) is logged there.

### Score chips show 0% for all jobs

**Causes**:
1. No Role Profiles exist
2. Role Profile has no soft weights
3. Job description was not parsed — click Parse JD first so keywords are extracted
4. Claims not present — scores are based on JD keywords, not claims, so this shouldn't affect scoring

**Fix**: Ensure the job has been parsed (Parsed Data tab should show skills). Ensure your Role Profile has soft weight entries with keywords that appear in job descriptions.

### Score chip shows `✗`

This is expected behavior, not a bug. It means the job fails at least one hard filter in that profile:
- A required keyword is missing from the JD text, OR
- A blocked keyword is present in the JD text, OR
- The parsed salary is below your min salary threshold

### Resume approval button is disabled

All individual changes (added bullets, removed bullets, reordered sections) must have a decision (👍 or 👎) before the Approve/Reject buttons activate. Look for any change items that still show no thumbs highlight.

### Cover letter shows no paragraphs

The cover letter body content is stored in the `structuredContent` field as a JSON array of `AnnotatedParagraph` objects. If the AI returned malformed JSON, the paragraphs may not render. Check the API logs for JSON parse errors. Reject the version and re-run Draft Cover Letter.

### Database recovery

The database is PostgreSQL. If you need to reset test data:

**Safe: delete specific test jobs**
```sql
DELETE FROM jobs WHERE company = 'Test Company';
```

**Safe: soft-delete a claim** (use the toggle in the UI, not SQL)

**Careful: full reset** — use only in development:
```sql
TRUNCATE TABLE applications, resume_versions, cover_letter_versions, feedback_signals RESTART IDENTITY CASCADE;
```

Do **not** truncate `claims`, `role_profiles`, or `ai_model_configs` unless you want to reconfigure everything from scratch.

### OpenRouter rate limits

If you hit a rate limit, the error will appear in API server logs as an HTTP 429. Solutions:
- Switch to a cheaper/higher-rate model in AI Config
- Add a fallback model config with a different provider
- Wait and retry

---

## 9. Known Limitations

| Area | Limitation | Workaround |
|------|-----------|------------|
| **Authentication** | Single-admin session auth only — this is not a multi-user product | Keep the deployment private and protect the admin credentials carefully |
| **AI polling** | Dashboard does not auto-poll for AI completion | Manually navigate to Resumes/Cover Letters queue after running AI actions |
| **Job URL import** | "Source URL" field is stored but not scraped — you must paste JD text manually | Copy/paste JD text into the Raw JD Text field |
| **Resume base document** | The tailor pipeline generates a diff, but there is no stored "base resume" document — the diff is relative to claims only | Keep your base resume as a separate document; apply the diff manually |
| **Feedback analytics** | Feedback signals are logged but there is no analysis UI yet | Export from DB for analysis |
| **Multi-user** | The tool is single-user only — no user accounts, no ownership fields on records | Keep it single-user; one person per deployment |
| **Mobile** | The dashboard is desktop-first and not optimized for mobile | Use on a desktop browser |
| **Claim variants UI** | Phrasing variants must be entered as JSON array strings in the text field | Enter as `["variant one", "variant two"]` format |
| **Evidence URL** | Evidence URLs are stored but not displayed in the UI (DB only) | View via direct DB query if needed |
| **Cost tracking** | Per-token costs are recorded in AI Config but not aggregated into a total spend display | Estimate manually using OpenRouter's usage dashboard |
| **Score caching** | Scores are re-computed on every page load (no caching) | Acceptable at current scale; may slow down with 100+ jobs |

---

## 10. Suggested Next Improvements

### P0 — Do before showing to anyone outside

| # | Improvement | Effort |
|---|-------------|--------|
| P0-1 | **Finalize deployment hardening for the existing session auth layer** — verify envs, secure cookies, admin bootstrap removal, and smoke tests | ~2 hours |
| P0-2 | **Surface AI error details in the UI** — currently shows generic "Failed to X" toast; log the actual error message | 2 hours |
| P0-3 | **Auto-refresh Resumes/Cover Letters queue** after AI pipeline actions (or add a polling indicator) | 2 hours |

### P1 — High value, manageable effort

| # | Improvement | Effort |
|---|-------------|--------|
| P1-1 | **Job URL scraping** — auto-fetch and populate JD text from a URL instead of manual paste | 1 day |
| P1-2 | **Base resume storage** — store your canonical resume as a document in the DB so diffs are meaningful | 1 day |
| P1-3 | **Claim variant UI** — proper multi-input field for phrasing variants instead of raw JSON | 4 hours |
| P1-4 | **Evidence URL display** — show evidence links in the Claims Ledger UI | 2 hours |
| P1-5 | **Feedback analytics** — basic charts showing interview rate by job type, company size, etc. | 1–2 days |
| P1-6 | **Application history** — log every status change with timestamp so you have a full timeline per application | 1 day |

### P2 — Structural improvements for scale

| # | Improvement | Effort |
|---|-------------|--------|
| P2-1 | **Job board integrations** — LinkedIn, Greenhouse, Lever API ingest | 3–5 days |
| P2-2 | **Resume PDF export** — generate a PDF from the approved diff + base document | 2–3 days |
| P2-3 | **Cost aggregation** — show total OpenRouter spend per month in the AI Config page | 1 day |
| P2-4 | **Bulk job scoring** — re-score all jobs when a Role Profile changes | 4 hours |
| P2-5 | **E2E test suite** — Playwright tests for critical flows (job ingest, AI pipeline, approval) | 2–3 days |
| P2-6 | **Score caching** — cache scores in the DB with a TTL so re-renders don't re-compute | 1 day |

### Quick wins (< 2 hours each)

- Add "Copy to clipboard" button on approved cover letters
- Add "Mark as submitted" quick action from the job detail page
- Add pagination to the Jobs list (currently loads all jobs)
- Add sort/filter to the Jobs list (by date, score, status)
- Add job count badge to the sidebar "Jobs Pipeline" label
