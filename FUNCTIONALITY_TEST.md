# Job Ops Functionality Test Quest Log

Welcome, Operator. This guide is a hands-on playbook for verifying the app from login to AI-assisted resume and cover letter approval. Treat each section like a quest. Earn the XP by proving the behavior, not by trusting vibes.

## Test Rules

- Use fresh test data. Existing resumes, jobs, claims, and cover letters are disposable in this development app.
- Keep one browser tab open to the dashboard and one terminal open for logs.
- When testing AI features, use a real OpenRouter model when available. The app should remain model-agnostic, so any valid OpenRouter model ID should work.
- Do not approve an AI draft unless every important statement is supported by a claim, base resume, job description, or stored research.

## Preflight: Unlock The Test Arena

Reward: 50 XP

1. Pull the latest code and install dependencies if needed.

```powershell
corepack pnpm install
```

2. Confirm required env vars exist in `.env`.

Required for normal local AI testing:

```text
DATABASE_URL
SESSION_SECRET
AI_INTEGRATIONS_OPENROUTER_API_KEY
AI_INTEGRATIONS_OPENROUTER_BASE_URL
ADMIN_USERNAME
ADMIN_PASSWORD
ADMIN_EMAIL
```

3. Start the app.

```powershell
corepack pnpm run dev
```

4. Open the dashboard.

```text
http://localhost:5173
```

Pass condition:

- The app loads without the Vite error overlay.
- Login works.
- The dashboard renders with readable text.

## Quest 1: Navigation Smoke Test

Reward: 75 XP

Visit each primary route from the sidebar:

- Dashboard
- Jobs
- Apply Wizard
- Stats
- Base Resume
- Resume Versions
- Cover Letters
- Claims
- Pipeline
- Role Profiles
- Assisted Apply
- AI Review
- AI Metrics
- AI Config
- AI Learning
- Feedback
- Admin Docs
- Trends

Pass condition:

- No route crashes.
- No blank page.
- No unreadable pale text on important labels, badges, buttons, inputs, or descriptions.
- Sidebar active state is visible.

Boss check:

- Open `/admin/docs`.
- Verify code blocks and environment variable labels are readable and do not look like redacted bars.

## Quest 2: Base Resume Source Of Truth

Reward: 100 XP

1. Go to `Base Resume`.
2. Paste a small test resume with real, controlled facts. Example:

```text
CYRUS TEST

Professional Summary
Learning and development leader with experience building onboarding programs and compliance training.

Experience
Learning Program Manager
- Led onboarding program for 40 employees.
- Reduced ramp time by 20%.
- Built compliance training for HIPAA and cybersecurity awareness.
```

3. Save it as the current base resume.
4. Open the version history.

Pass condition:

- The saved resume appears as current.
- The content remains plain text.
- Version history is readable.

## Quest 3: Claims Ledger Truth Source

Reward: 150 XP

Create several claims in `Claims`.

Use at least these:

1. Supported metric claim:

```text
Summary: Led onboarding program for 40 employees and reduced ramp time by 20%.
Evidence: Internal onboarding report confirms 40 employees and 20% faster ramp time.
Tags: onboarding, training, ramp time
Disallowed implications: sole founder, certified trainer
```

2. Compliance claim:

```text
Summary: Built compliance training for HIPAA and cybersecurity awareness.
Evidence: Training curriculum and rollout notes.
Tags: HIPAA, cybersecurity, compliance training
```

3. Leadership claim:

```text
Summary: Partnered with cross-functional stakeholders to launch learning programs.
Evidence: Project notes and stakeholder rollout plan.
Tags: stakeholder alignment, program launch, learning operations
```

Pass condition:

- Claims save successfully.
- Claims can be viewed and edited.
- Inactive claims are not used by generation.

Truth-lock checkpoint:

- Add at least one disallowed implication to a claim.
- Later, verify generated drafts do not use that implication without being flagged.

## Quest 4: Job Intake And JD Parsing

Reward: 150 XP

1. Go to `Apply Wizard`.
2. Choose single job mode.
3. Create a job description that asks for:

```text
Title: Learning Experience Designer
Company: Acme Learning
Location: Remote

Responsibilities:
- Build onboarding programs for new employees.
- Create compliance training for cybersecurity and privacy.
- Partner with cross-functional stakeholders.
- Manage LMS administration.

Required skills:
- onboarding
- compliance training
- stakeholder alignment
- LMS administration
```

4. Parse the job description.

Pass condition:

- Parsed required skills include onboarding, compliance training, stakeholder alignment, and LMS administration.
- The job reaches a scored or parsed state.
- No fake company research appears unless it was provided in the job or stored research.

Gap checkpoint:

- `LMS administration` should be treated as a gap if no claim supports it.

## Quest 5: Resume Tailoring Truth-Lock

Reward: 300 XP

1. In `Apply Wizard`, select the relevant claims.
2. In Step 4, choose a resume template.
3. Generate a tailored resume.
4. Open the generated resume preview.
5. Then open `Resume Versions` for a deeper review.

Pass condition:

- Draft status is `pending_approval`.
- The draft is not auto-approved.
- The selected template is shown in Step 4 preview and Step 5 review.
- The preview follows deterministic template rendering, not model-authored markdown.
- The resume contains no markdown artifacts such as `**`, `#`, or `- **Label:**`.
- Resume Queue shows a Truth Review panel.
- Truth Review shows counts for supported, needs review, and unsupported items.
- Added bullets cite claims through stored metadata.
- JD keywords used are visible when present.
- Any unsupported requirement appears as a gap, not as fake experience.
- DOCX export uses the selected template style and is allowed to be 1-2 pages.

Critical checks:

- The resume must not claim `LMS administration` unless a claim supports it.
- The resume must not inflate `40 employees` to `400 employees`.
- The resume must not inflate `20%` to `80%`.
- The resume must not say `certified trainer` or `sole founder` if those are disallowed implications.

Fail-closed checkpoint:

- If the model invents a serious unsupported metric, title, tool, credential, or disallowed implication, the version should still be visible for review, but notes should explain that truth review failed.
- If the model returns readable plain text instead of the required structured JSON, the app should try repair. If repair fails, approval must be blocked with `Resume must be regenerated before approval`.
- If the model returns markdown formatting, the saved preview should be renderer-clean or the draft should be blocked for regeneration.

Template checkpoint:

- Test all built-ins: Student Technical Assistant, Software Developer, and Data Engineer.
- The template selector should be required before resume generation.
- Section order should match the selected template.
- No hybrid template should appear. For example, Data Engineer should not gain Coursework unless that template allows it.
- Longer candidates may use up to 2 pages; the app should trim lower-relevance bullets before exceeding that v1 budget.

## Quest 6: Cover Letter Truth-Lock

Reward: 250 XP

1. Generate a cover letter from the same job.
2. Open it in `Apply Wizard`.
3. Open `Cover Letters` for full review.

Pass condition:

- Draft status is `pending_approval`.
- Paragraphs show role labels: opening, hook, body, closing.
- Body and hook paragraphs cite claim IDs.
- Paragraphs show truth status badges: Supported, Needs Review, or Unsupported.
- Unsupported phrases and gap notes appear when relevant.

Critical checks:

- The letter should connect 2-3 verified achievements to the employer needs.
- It should not simply repeat the resume.
- It should not invent company news, mission, products, people, awards, or recent events.
- Any company reference must come from the job description or stored research.
- Opening and closing may be uncited only if they contain no factual claims.

Boss check:

- If the letter says something like `I admire Acme's new satellite platform` and that fact is not in the JD or research data, it should be flagged.

## Quest 7: Model-Agnostic OpenRouter Check

Reward: 200 XP

1. Go to the model comparison area in `Apply Wizard`.
2. Add at least two valid OpenRouter model IDs.
3. Run resume comparison.
4. Run cover letter comparison.
5. Promote one successful candidate for each artifact.

Pass condition:

- The app accepts arbitrary valid OpenRouter model IDs.
- Failed models produce readable failure messages without crashing the page.
- Successful comparison candidates are stored as `comparison_candidate`.
- Promoting a winner changes it to `pending_approval`.
- Truth Review metadata is preserved on promoted candidates.

Suggested model test matrix:

```text
Fast model: a low-cost model for quick draft quality
Strong model: a more capable reasoning/writing model
Fallback test: one intentionally invalid model ID
```

## Quest 8: Human Approval Gate

Reward: 150 XP

1. Try approving a resume with unresolved change decisions.
2. Accept or reject each change.
3. Approve the resume.
4. Approve or reject a cover letter.

Pass condition:

- Resume approval requires all per-change decisions when diff review exists.
- Approval records review decisions in notes.
- Rejected items stay rejected.
- Approved versions can be exported.
- Rejected/pending versions can be cleaned up without deleting approved versions.

Safety checkpoint:

- Even supported AI outputs must require human approval.
- No application should be auto-submitted.

## Quest 9: AI Learning And Feedback Loop

Reward: 175 XP

1. Approve at least one resume and cover letter.
2. Create feedback for the application or generated artifacts.
3. Visit `AI Metrics`.
4. Visit `AI Learning`.
5. Run or inspect recompute behavior if available.

Pass condition:

- Feedback signals include attribution to model name and prompt version when available.
- Prompt/model performance can be inspected.
- Bayesian comparison data appears when enough signals exist.
- Auto-promotion should only happen if explicitly configured.

Reality check:

- Because this is a development app, small sample sizes are not meaningful. The goal is to verify plumbing, not prove model quality.

## Quest 10: Admin And Docs Readability

Reward: 100 XP

1. Open `Admin Docs`.
2. Scroll through all sections.
3. Inspect environment variable examples and command snippets.

Pass condition:

- Text is readable.
- Code blocks have enough contrast.
- Placeholder or secret-looking labels do not cover nearby text.
- No section looks visually redacted unless intentionally masking a secret.

## Regression Sweep

Reward: 300 XP

Run these commands:

```powershell
corepack pnpm run typecheck
corepack pnpm --filter @workspace/api-server run typecheck
corepack pnpm --filter @workspace/dashboard run typecheck
corepack pnpm --filter @workspace/api-server run build
corepack pnpm --filter @workspace/dashboard run build
```

For API tests with local dummy OpenRouter env:

```powershell
$env:AI_INTEGRATIONS_OPENROUTER_BASE_URL='https://openrouter.ai/api/v1'
$env:AI_INTEGRATIONS_OPENROUTER_API_KEY='test-key'
corepack pnpm --filter @workspace/api-server run test
```

Pass condition:

- API typecheck passes.
- Dashboard typecheck passes.
- Full workspace typecheck passes.
- API build passes.
- Dashboard build passes.
- API tests pass.
- Any build warnings are known warnings only, such as sourcemap or large chunk warnings.

## Final Scorecard

Use this table when finishing a manual QA run.

| Quest | Status | Notes |
| --- | --- | --- |
| Preflight | Pending |  |
| Navigation Smoke Test | Pending |  |
| Base Resume | Pending |  |
| Claims Ledger | Pending |  |
| Job Intake And Parse | Pending |  |
| Resume Truth-Lock | Pending |  |
| Cover Letter Truth-Lock | Pending |  |
| OpenRouter Model Check | Pending |  |
| Human Approval Gate | Pending |  |
| AI Learning Loop | Pending |  |
| Admin Docs Readability | Pending |  |
| Regression Sweep | Pending |  |

## Victory Conditions

The app is ready for the next development checkpoint when:

- AI drafts remain grounded in claims, base resume, JD, and stored research.
- Unsupported metrics, credentials, company facts, or disallowed implications are flagged.
- Resume and cover letter drafts remain human-reviewed.
- Any valid OpenRouter model can be tested without changing code.
- The UI makes truth-review status visible enough that a user can make an informed approval decision.
- The regression commands pass.

Total available reward: 1,950 XP
