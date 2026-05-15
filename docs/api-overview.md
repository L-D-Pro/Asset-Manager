# Job Ops API — Design Digest

A condensed reference of every backend endpoint, grouped by resource. This file is hand-curated for design conversations (claude.ai, claude.design, etc.); the canonical machine-readable spec is [lib/api-spec/openapi.yaml](../lib/api-spec/openapi.yaml).

- **Base path:** `/api`
- **Auth:** session cookie (except `/auth/*`, `/healthz`, `/invite-codes/*`, `/growth/*`)
- **All entity ids are integers** unless otherwise noted

> Truth-lock invariant: AI-generated outputs (resumes, cover letters, proposals) must cite claim IDs from the user's verified ledger. Structurally invalid citations are dropped at the API level. UI should surface citation provenance.

---

## 1. Auth & account

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | Username + password (admin user table) |
| POST | `/auth/login/totp` | Step-2 TOTP code if 2FA enabled |
| POST | `/auth/logout` | End session |
| GET | `/auth/me` | Current user; returns `{ id, username, email, role, …profile }` or 401 |
| POST | `/auth/register` | Self-signup (pilot enrollment gates apply) |
| POST | `/auth/verify-email` | Confirm email via token |
| POST | `/auth/password-reset/request` | Send reset email |
| POST | `/auth/password-reset/confirm` | Apply new password via token |
| GET / PATCH | `/users/me` | Profile management |
| GET | `/healthz` | Public liveness probe |

**User shape:** id, username, firstName, lastName, email, role (`admin` | `user`), totpEnabled, emailVerified, isPilotParticipant, isActive, createdAt, updatedAt.

---

## 2. Jobs pipeline

The job listing is the spine: every resume/cover-letter/application hangs off a job id.

| Method | Path | Purpose |
|---|---|---|
| GET | `/jobs` | List jobs (default ordering: most recent) |
| POST | `/jobs` | Create a job (from URL paste or manual input) |
| GET | `/jobs/{id}` | Job detail (includes parsed JD facets) |
| PATCH | `/jobs/{id}` | Update title/company/notes/status |
| DELETE | `/jobs/{id}` | Hard delete (cascades to applications) |
| POST | `/jobs/{id}/parse-jd` | Trigger AI JD parse → fills fields on the job |
| POST | `/jobs/{id}/score-fit` | AI-score how this job matches the user's profile |
| POST | `/jobs/{id}/extract-claims` | AI suggests claim candidates from JD context |

**Job shape:** id, title, company, location, jdText, jdUrl, parsedJd (jsonb: requirements/responsibilities/keywords), status (`saved` | `applied` | `interviewing` | `closed`), salaryMin/Max, fitScore, createdAt, updatedAt.

---

## 3. Claims ledger (truth-lock source)

Every factual claim about the user lives here. AI outputs are forced to cite ids from this table.

| Method | Path | Purpose |
|---|---|---|
| GET | `/claims` | List claims |
| POST | `/claims` | Create claim |
| GET | `/claims/{id}` | Claim detail |
| PATCH | `/claims/{id}` | Edit text/category/verification |
| DELETE | `/claims/{id}` | Hard delete (dangerous — cascade-affects past versions) |
| POST | `/claims/{id}/verify` | Mark as verified (audit-logged) |
| POST | `/claims/import` | Bulk import from resume |

**Claim shape:** id, text, category (`achievement` | `skill` | `experience` | `education` | `cert`), evidence (string), evidenceType (`metric` | `narrative` | `link` | `none`), verified (bool), tags (string[]), createdAt.

---

## 4. Base resume (versioned)

The user's source-of-truth resume. Every save creates a new immutable version.

| Method | Path | Purpose |
|---|---|---|
| GET | `/base-resume` | Current active version (204 if none) |
| POST | `/base-resume` | Save new version (becomes current) |
| POST | `/base-resume/import` | Upload DOCX/PDF → parse to text |
| GET | `/base-resume/history` | All versions, newest first |
| POST | `/base-resume/restore/{versionId}` | Clone an old version as the new current |
| DELETE | `/base-resume/versions/{versionId}` | Delete a single version |
| POST | `/base-resume/to-profile` | AI-extract role-profile signals from current resume |
| POST | `/base-resume/score` | Generic ATS-style score |

**Base resume shape:** id, contentText (markdown), label, isCurrent (bool), createdAt.

---

## 5. Role profiles

Reusable targeting templates: "Senior PM at SaaS", "Staff Eng remote", etc. Drive resume tailoring + JD scoring.

| Method | Path | Purpose |
|---|---|---|
| GET | `/role-profiles` | List |
| POST | `/role-profiles` | Create |
| GET | `/role-profiles/{id}` | Detail |
| PATCH | `/role-profiles/{id}` | Edit |
| DELETE | `/role-profiles/{id}` | Delete |

**Role profile shape:** id, name, description, targetTitles[], targetIndustries[], targetCompanySize, targetRemoteType, targetSalaryMin/Max, priorityClaimIds[], isActive.

---

## 6. Resume versions (tailored, gated)

Per-job AI-tailored resumes. State machine: `pending_approval → approved | rejected` (re-approving returns 409).

| Method | Path | Purpose |
|---|---|---|
| GET | `/resume-versions` | List (filter `?jobId=…`) |
| POST | `/resume-versions` | Trigger AI tailoring for a job |
| GET | `/resume-versions/{id}` | Detail (includes citations, fit-score) |
| POST | `/resume-versions/{id}/approve` | Move to `approved` |
| POST | `/resume-versions/{id}/reject` | Move to `rejected` |
| DELETE | `/resume-versions/{id}` | Delete |
| GET | `/resume-versions/{id}/export.docx` | Download DOCX |
| GET | `/resume-versions/{id}/export.pdf` | Download PDF |
| GET | `/resume-templates` | Available built-in templates |

**Resume version shape:** id, jobId, baseResumeVersionId, contentMarkdown, citationMap (jsonb), state (`pending_approval` | `approved` | `rejected`), fitScore, templateId, runId, eventLogId, createdAt.

---

## 7. Cover-letter versions (tailored, gated)

Same state-machine semantics as resume versions.

| Method | Path | Purpose |
|---|---|---|
| GET | `/cover-letter-versions` | List (filter `?jobId=…`) |
| POST | `/cover-letter-versions` | AI-draft a cover letter |
| GET | `/cover-letter-versions/{id}` | Detail |
| POST | `/cover-letter-versions/{id}/approve` | Approve |
| POST | `/cover-letter-versions/{id}/reject` | Reject |
| DELETE | `/cover-letter-versions/{id}` | Delete |

**Cover letter shape:** id, jobId, contentMarkdown, tone, state, runId, eventLogId, createdAt.

---

## 8. Applications

Tracks each submitted application from `to-do` to outcome.

| Method | Path | Purpose |
|---|---|---|
| GET | `/applications` | List (filter `?jobId=…&status=…`) |
| POST | `/applications` | Create from a job + approved versions |
| GET | `/applications/{id}` | Detail (includes form fields, actions, outcomes) |
| PATCH | `/applications/{id}` | Update status / notes |
| DELETE | `/applications/{id}` | Delete |
| GET | `/applications/stats` | Aggregate funnel: drafts → submitted → interviews → offers |
| POST | `/applications/{id}/log-action` | Record a step (sent email, follow-up, etc.) |

**Application shape:** id, jobId, resumeVersionId, coverLetterVersionId, status (`to_do` | `submitted` | `interview` | `offer` | `rejected` | `withdrawn`), appliedAt, lastActionAt, notes.

---

## 9. Assisted apply

Single-page "fill this form" copilot. Stores per-form field assignments so re-applies are fast.

| Method | Path | Purpose |
|---|---|---|
| POST | `/assisted-apply/sessions` | Start an apply session for a job |
| GET | `/assisted-apply/sessions/{id}` | Session state + suggestions |
| PATCH | `/assisted-apply/sessions/{id}` | Save field values |
| POST | `/assisted-apply/sessions/{id}/suggest` | AI-fill a single field |
| POST | `/assisted-apply/sessions/{id}/complete` | Mark as submitted |

---

## 10. Apply wizard sessions

A multi-step guided flow (gated behind `VITE_ENABLE_APPLY_WIZARD`).

| Method | Path | Purpose |
|---|---|---|
| GET | `/wizard-sessions` | List user's sessions |
| POST | `/wizard-sessions` | Start new |
| GET | `/wizard-sessions/{id}` | Detail + current step |
| PATCH | `/wizard-sessions/{id}` | Update step / fields |
| DELETE | `/wizard-sessions/{id}` | Delete |

---

## 11. Chat (Conversational UI — MVP surface)

The new chat page. Three vendored skills are loaded into the system prompt (resume-ATS-optimizer, cover-letter-generator, tailored-resume-generator). Read-only attachments let the user pull base resume / job / claims into context.

| Method | Path | Purpose |
|---|---|---|
| GET | `/chat/threads` | List user's threads (newest updated first). `?include_archived=1` to include archived. |
| POST | `/chat/threads` | Create empty thread |
| PATCH | `/chat/threads/{id}` | Rename or archive |
| DELETE | `/chat/threads/{id}` | Hard delete (cascades to messages) |
| GET | `/chat/threads/{id}/messages` | Chronological messages |
| POST | `/chat/threads/{id}/messages` | **SSE** — append user turn, stream assistant reply |
| POST | `/chat/messages/{id}/feedback` | Thumbs up/down on an assistant turn |

**Streaming SSE frames:**
- default `message`: `data: {"token": "…"}`
- `event: user-message`: `data: {"id": <n>, "role": "user"}` (once at start)
- `event: error`: `data: {"message": "…"}`
- `event: done`: `data: {"messageId": <n>, "runId": "chat_…", "promptVersionId": <n>|null, "eventLogId": <n>|null, "primarySkill": "<slug>"}`

**ChatThread shape:** id, userId, title, modelScope (`chat` default), archivedAt, createdAt, updatedAt.

**ChatMessage shape:** id, conversationId, role (`user` | `assistant` | `system` | `tool`), content, attachments[], runId, promptVersionId, modelName, promptTokens, completionTokens, createdAt.

**Attachment** is a discriminated union:
- `{ kind: "base_resume", refId?, snapshot: { contentText, version?, capturedAt? } }`
- `{ kind: "job", refId?, snapshot: { title, company?, location?, jdText } }`
- `{ kind: "claims", refId?, snapshot: { claims: [{ text, verified }] } }`

---

## 12. AI infrastructure (configurable runtime)

Power-user pages that let the operator tune the AI behind the app.

### AI model configs
| Method | Path | Purpose |
|---|---|---|
| GET | `/ai-model-configs` | List per-taskScope model assignments + fallbacks |
| POST | `/ai-model-configs` | Add a new model config |
| PATCH | `/ai-model-configs/{id}` | Re-prioritize / change model / toggle active |
| DELETE | `/ai-model-configs/{id}` | Delete |

Task scopes seeded: `jd_parsing`, `resume_tailoring`, `cover_letter`, `default`, **`chat`** (new).

### Prompt versions
| Method | Path | Purpose |
|---|---|---|
| GET | `/ai-prompt-versions` | List (filter `?taskScope=…`) |
| POST | `/ai-prompt-versions` | Create a new version for a task scope |
| PATCH | `/ai-prompt-versions/{id}` | Edit + role fields (roleLabel/personality/goals/skillTags) |
| POST | `/ai-prompt-versions/{id}/activate` | Set as the active prompt for its scope |

### Learning loop
| Method | Path | Purpose |
|---|---|---|
| POST | `/ai-run-evaluations` | Human/system rating of an AI output (canonical lineage required) |
| GET | `/ai-run-evaluations` | List evaluations (filter `?taskScope=…`) |
| GET | `/ai-training-examples` | Few-shot training examples |
| POST | `/ai-training-examples` | Add a training example |
| GET | `/ai-learning/leaderboard` | Variant comparison output (Bayesian win prob, sample count) |
| POST | `/ai-learning/recompute` | Trigger stats re-aggregation |
| GET | `/ai-learning/config` | Read auto-recompute / auto-evaluate flags |
| PATCH | `/ai-learning/config` | Update flags |

### AI Review / Metrics
| Method | Path | Purpose |
|---|---|---|
| GET | `/ai-review` | Inbox of pending_approval items (resumes + cover letters) |
| GET | `/ai-metrics` | Per-task token usage, error rate, fallback rate |
| GET | `/ai-metrics-snapshot` | Time-bucketed snapshots for charts |
| GET | `/ai-pipeline` | Pipeline visualization data |

### Event logs (audit)
| Method | Path | Purpose |
|---|---|---|
| GET | `/event-logs` | Read-only audit feed (filter `?entityType=…&entityId=…&runId=…`) |

---

## 13. Freelance copilot

A side surface for freelance proposals, mirroring the job → resume → cover letter pipeline but for client projects.

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/freelance/profiles` | Freelance "role profile" for proposal tone |
| GET / POST | `/freelance/projects` | Tracked freelance projects |
| GET / POST | `/freelance/projects/{id}/proposals` | Versioned AI-drafted proposals (same gated state machine) |
| POST | `/freelance/proposals/{id}/approve` | Approve |
| POST | `/freelance/proposals/{id}/reject` | Reject |
| GET | `/freelance/project-sources` | Where leads came from (Upwork, referrals, etc.) |
| GET / POST | `/freelance/client-message-templates` | Reusable client messages |

---

## 14. Market intelligence

| Method | Path | Purpose |
|---|---|---|
| GET | `/trends` | Aggregated job-market trends (titles, salaries, locations) |
| GET | `/trends/cache` | Pre-computed snapshots |
| GET | `/job-board` | Aggregated external listings |
| GET | `/job-board/sources` | Configured job board source list |

---

## 15. Gamification

XP, streaks, achievements, quests. Drives the dashboard's right rail.

| Method | Path | Purpose |
|---|---|---|
| GET | `/gamification/stats` | XP, level, streak, today's activity |
| GET | `/gamification/quests` | Active/available quests |
| POST | `/gamification/quests/{id}/start` | Start a quest |
| GET | `/gamification/achievements` | Unlocked + locked achievements |
| POST | `/gamification/xp` | (Admin) award XP for an action |

---

## 16. Onboarding & best practices

| Method | Path | Purpose |
|---|---|---|
| GET / PATCH | `/onboarding/state` | Per-user setup checklist progress |
| GET / POST | `/best-practices` | Curated/AI-suggested practices (domain-scoped) |
| POST | `/best-practices/refresh` | Regenerate the AI suggestions |
| GET / POST | `/feedback` | Open-ended user feedback |

---

## 17. Admin & pilot

Visible only to `role: 'admin'` users.

| Method | Path | Purpose |
|---|---|---|
| GET / POST / PATCH | `/admin/users` | User management |
| GET / POST | `/admin/invite-codes` | Invite code lifecycle |
| GET / PATCH | `/admin/usage-limits` | Per-user rate limits |
| GET / POST | `/admin/best-practices` | Curate the corpus |
| POST | `/admin/reset` | Test-data reset (non-prod only) |
| GET | `/admin/health` | Model-config health checks |

---

## 18. UI shell config (theme / layout)

Used by [ui-shell config service](../artifacts/dashboard/src/ui-shell/use-ui-shell-config.tsx) to render featured sidebar cards.

| Method | Path | Purpose |
|---|---|---|
| GET | `/ui-shell-configs/{appKey}` | Resolved theme + nav slot layout |
| PATCH | `/ui-shell-configs/{appKey}` | Update layout (admin) |

---

## State machine semantics (re-stated for designers)

- `resume_versions`, `cover_letter_versions`, `proposal_versions` all use the same gated machine:
  - **Created** → `pending_approval`
  - User explicitly **Approves** → `approved` (then exportable, attachable to an application)
  - User explicitly **Rejects** → `rejected` (kept for the audit trail, not usable)
  - Re-approving / re-rejecting → **409 Conflict** (UI should disable the action, not retry)
- Approval is a 1-click action but **always explicit** — no auto-approve, no auto-submit.

## Cross-cutting design hooks

- **Toast on error:** every mutation returns `{ error: string }` on non-2xx — surface as toast (the dashboard already centralizes this in `App.tsx` `QueryCache.onError`).
- **204 means "no current resource":** `/base-resume` returns 204 (not 404) when no current version exists — empty-state UI.
- **Streaming:** only `/chat/threads/{id}/messages` is SSE; everything else is request/response JSON.
- **Lineage runId:** every AI-rooted artifact (resume_versions, cover_letter_versions, chat messages, ai_run_evaluations) shares a `runId`. This is the join key for traceability views; useful for a "show me everything that came from this AI call" debugger surface.
