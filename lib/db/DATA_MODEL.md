# Data Model Reference

All tables are defined with Drizzle ORM in `lib/db/src/schema/`. The DB client is exported from `lib/db/src/client.ts`. Every table has `createdAt` and `updatedAt` timestamps (UTC with timezone) unless noted otherwise.

**11 tables in total** (exported from `lib/db/src/schema/index.ts`):
`role_profiles`, `jobs`, `claims`, `resume_versions`, `cover_letter_versions`,
`applications`, `event_logs`, `feedback_signals`, `ai_model_configs`,
`conversations`, `messages`

## Entity-Relationship Summary

```
role_profiles ──────────────── jobs (many jobs per profile, FK nullable)
                                 │
                    ┌────────────┼────────────────┐
                    │            │                │
            resume_versions  cover_letter_versions  applications
                    │                              │
                    └─────── feedback_signals ─────┘
                                 │
                          event_logs (polymorphic — references any entity via entityType + entityId)
                          ai_model_configs (self-referential fallback chain)
                          claims (standalone — no FK to jobs; matched at pipeline runtime)
```

---

## `role_profiles`

Named target-role configurations. The user creates one per type of role they are searching for (e.g. "Senior Frontend", "Staff AI Engineer"). Jobs are scored per profile, not globally.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment |
| `name` | text | NOT NULL | Human-readable profile name |
| `description` | text | nullable | Optional longer description |
| `hard_filters` | jsonb | NOT NULL, default `{}` | Structured as `{ requiredKeywords: string[], blockedKeywords: string[], minSalary: number }`. A job that fails any hard filter gets `passesHardFilters: false` regardless of soft score. |
| `soft_weights` | jsonb | NOT NULL, default `{}` | Structured as `{ [keyword: string]: number }` (keyword → weight 0–10). Used to compute a 0–100 normalised job score. |
| `company_allow_list` | text[] | NOT NULL, default `[]` | Companies the user prefers (informational — not yet enforced in scoring). |
| `company_deny_list` | text[] | NOT NULL, default `[]` | Companies to exclude (informational — not yet enforced in scoring). |
| `is_active` | boolean | NOT NULL, default `true` | Inactive profiles are excluded from scoring. |

**Indexes**: none beyond PK.

---

## `jobs`

One row per ingested job posting. Deduplication is done via `deduplication_hash`. Parsed fields are populated by the JD parse pipeline.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment |
| `role_profile_id` | integer | FK → `role_profiles.id` ON DELETE SET NULL, nullable | The profile this job was ingested against. Used as the default scoring profile. |
| `title` | text | NOT NULL | Job title |
| `company` | text | NOT NULL | Company name |
| `location` | text | nullable | City/country string |
| `remote_type` | text | nullable | `remote`, `hybrid`, `onsite`, or null |
| `salary_min` | integer | nullable | Minimum salary (in `salary_currency`) |
| `salary_max` | integer | nullable | Maximum salary |
| `salary_currency` | text | nullable | `USD`, `GBP`, `EUR`, etc. |
| `visa_sponsorship` | text | nullable | `yes`, `no`, `unknown` |
| `source_url` | text | nullable | Original job posting URL |
| `source_platform` | text | nullable | `linkedin`, `greenhouse`, `lever`, etc. |
| `raw_jd_text` | text | nullable | Full raw text of the job description (pre-parse) |
| `parsed_responsibilities` | text[] | nullable | Extracted from JD by AI |
| `parsed_required_skills` | text[] | nullable | Required skills extracted by AI |
| `parsed_nice_to_have_skills` | text[] | nullable | Nice-to-have skills extracted by AI |
| `parsed_keywords` | text[] | nullable | General keywords extracted by AI |
| `parsed_seniority_signal` | text | nullable | `junior`, `mid`, `senior`, `staff`, `principal`, etc. |
| `parsed_structured_data` | jsonb | nullable | Full structured JSON from the AI parse response |
| `status` | text | NOT NULL, default `new` | `new` → `scored` → `applied` / `parse_failed` |
| `deduplication_hash` | text | nullable | Hash of (title + company + sourceUrl) for dedup |

**Indexes**: `(role_profile_id, status)`, `(deduplication_hash)`, `(status)`.

---

## `claims`

The Claims Ledger — the single source of truth for all factual statements the user can make about themselves. Resume bullets can only be generated from approved claims.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment |
| `summary` | text | NOT NULL | The canonical statement of the claim (e.g. "Led migration of monolith to microservices, reducing P99 latency by 40%") |
| `evidence` | text | nullable | Source of truth: link, document reference, or self-attestation text |
| `evidence_type` | text | NOT NULL, default `self_attestation` | `self_attestation`, `document`, `url`, etc. |
| `phrasing_variants` | text[] | NOT NULL, default `[]` | Alternative phrasings the AI may use for this claim |
| `disallowed_implications` | text[] | NOT NULL, default `[]` | Things this claim must NEVER imply (e.g. "sole contributor") |
| `domain` | text | nullable | Professional domain (e.g. `backend`, `ml`, `leadership`) — used for filtering |
| `applicable_tags` | text[] | NOT NULL, default `[]` | Tags for matching (e.g. `["typescript", "react", "team-lead"]`) |
| `is_active` | boolean | NOT NULL, default `true` | Inactive claims are excluded from pipeline matching |

**Indexes**: `(domain, is_active)`, `(is_active)`.

---

## `resume_versions`

One row per AI-tailored resume version. Always starts in `pending_approval`. Approved versions can be linked to applications.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment |
| `job_id` | integer | FK → `jobs.id` ON DELETE CASCADE, nullable | The job this resume was tailored for |
| `label` | text | nullable | Human-readable label (auto-set by pipeline e.g. "AI tailored — Jun 15, 2025") |
| `status` | text | NOT NULL, default `pending_approval` | State machine: `pending_approval` → `approved` or `rejected` |
| `tailored_bullets` | jsonb | NOT NULL, default `[]` | Array of `{ text, claimIds, section, isAggregated, originalText }` |
| `diff_data` | jsonb | nullable | `{ addedBullets, removedBullets, reorderedSections, summary, generatedAt, modelName, bulletsTotal, bulletsPassedValidation, bulletsDiscarded }` |
| `claim_ids` | integer[] | NOT NULL, default `[]` | Flat list of all claim IDs referenced by this version |
| `file_url` | text | nullable | URL to the rendered PDF/DOCX if exported |
| `raw_content` | text | nullable | Raw AI output stored when parsing fails (for debugging) |
| `notes` | text | nullable | User or system notes; also used to store per-change review decisions |

**Indexes**: `(job_id)`, `(status)`.

---

## `cover_letter_versions`

One row per AI-drafted cover letter. Same approval state machine as resume versions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment |
| `job_id` | integer | FK → `jobs.id` ON DELETE CASCADE, nullable | The job this cover letter was drafted for |
| `label` | text | nullable | Human-readable label |
| `status` | text | NOT NULL, default `pending_approval` | `pending_approval` → `approved` or `rejected` |
| `draft_content` | text | nullable | Full plain-text cover letter draft |
| `annotated_paragraphs` | jsonb | NOT NULL, default `[]` | Array of `{ text, claimIds, role }` where role is `opening`, `hook`, `body`, or `closing` |
| `claim_ids` | integer[] | NOT NULL, default `[]` | Flat list of all claim IDs referenced |
| `notes` | text | nullable | Revision notes stored here when user requests revision via the dashboard |

**Indexes**: `(job_id)`, `(status)`.

---

## `applications`

Tracks the lifecycle of a submitted job application. Links a job to the specific resume/cover letter versions used.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment |
| `job_id` | integer | FK → `jobs.id` ON DELETE CASCADE, NOT NULL | The job applied to |
| `resume_version_id` | integer | FK → `resume_versions.id` ON DELETE SET NULL, nullable | Resume used for this application |
| `cover_letter_version_id` | integer | FK → `cover_letter_versions.id` ON DELETE SET NULL, nullable | Cover letter used |
| `status` | text | NOT NULL, default `applied` | `applied` → `screen` → `interview` → `offer` / `rejected` / `no_response` |
| `apply_mode` | text | NOT NULL, default `assisted` | `assisted` (user submits manually) or `auto` (future: selective auto-apply) |
| `platform` | text | nullable | ATS platform (greenhouse, lever, workday, etc.) |
| `applied_at` | timestamptz | nullable | When the application was submitted |
| `confirmation_ref` | text | nullable | ATS confirmation number or email subject |
| `notes` | text | nullable | Free-text notes |
| `action_log` | jsonb | NOT NULL, default `[]` | Append-only log of actions taken during assisted/auto apply |

**Indexes**: `(job_id)`, `(status)`, `(job_id, status)`.

---

## `event_logs`

Immutable audit log. Every state change, AI call, and key operation writes a row here. No update or delete endpoints are exposed via the API.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment |
| `entity_type` | text | NOT NULL | What entity this event belongs to (e.g. `job`, `resume_version`, `ai_call`) |
| `entity_id` | integer | NOT NULL | The ID of that entity |
| `application_id` | integer | FK → `applications.id` ON DELETE CASCADE, nullable | Optional application context |
| `job_id` | integer | FK → `jobs.id` ON DELETE CASCADE, nullable | Optional job context |
| `event_type` | text | NOT NULL | The specific event (e.g. `ai_call`, `ai_call_failed`, `status_changed`) |
| `previous_state` | text | nullable | State before the event |
| `next_state` | text | nullable | State after the event |
| `metadata` | jsonb | NOT NULL, default `{}` | Arbitrary structured data — for AI calls includes `modelName`, `promptTokens`, `completionTokens`, `estimatedCostUsd` |
| `actor_type` | text | NOT NULL, default `user` | `user` or `system` |

**Indexes**: `(entity_type, entity_id)`, `(application_id)`, `(job_id)`, `(event_type)`.

---

## `feedback_signals`

Outcome signals from the application lifecycle. Used to correlate outcomes with resume versions and role profiles for future self-learning.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment |
| `application_id` | integer | FK → `applications.id` ON DELETE CASCADE, NOT NULL | The application this signal belongs to |
| `resume_version_id` | integer | FK → `resume_versions.id` ON DELETE SET NULL, nullable | The resume version involved (if relevant) |
| `outcome` | text | NOT NULL | Outcome label (e.g. `interview`, `rejected`, `offer`, `no_response`, `completed`) |
| `signal_type` | text | NOT NULL | Signal category (e.g. `ats_screen`, `phone_screen`, `final_round`, `resume_review`, `cover_letter_revision_request`) |
| `notes` | text | nullable | Free-text notes from the user or system |
| `attribution_data` | jsonb | NOT NULL, default `{}` | Structured attribution (role profile, keywords, etc.) for future ML/optimization |
| `processed_at` | timestamptz | nullable | When this signal was incorporated into optimization (future use) |

**Indexes**: `(application_id)`, `(outcome)`, `(signal_type)`.

---

## `ai_model_configs`

Per-task AI model routing configuration. Supports multiple active models per task scope with priority ordering and fallback chains.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment |
| `task_scope` | text | NOT NULL | Task identifier: `jd_parsing`, `resume_tailoring`, `cover_letter`, `default`, or any custom string |
| `provider` | text | NOT NULL, default `openrouter` | Provider identifier (currently always `openrouter`) |
| `model_name` | text | NOT NULL | Model identifier as used by OpenRouter (e.g. `anthropic/claude-3.5-haiku`) |
| `is_active` | boolean | NOT NULL, default `true` | Inactive configs are skipped during model selection |
| `priority` | integer | NOT NULL, default `1` | Lower value = tried first within the same task scope |
| `fallback_model_id` | integer | FK → `ai_model_configs.id` (self-ref) ON DELETE SET NULL, nullable | Next model to try if this one fails or is inactive |
| `cost_per_input_token` | text | nullable | Cost in USD per input token (stored as string for precision) |
| `cost_per_output_token` | text | nullable | Cost in USD per output token |
| `max_tokens` | integer | nullable | Maximum tokens for completions from this model |
| `extra_config` | jsonb | NOT NULL, default `{}` | Future: temperature, top_p, stop sequences, etc. |

**Indexes**: `(task_scope, is_active)`, `(task_scope)`.

**Self-referential fallback chain**: the `fallback_model_id` column creates a linked list of models. The model router follows this chain, detecting cycles via a visited set to prevent infinite loops.

---

## `conversations`

Persistent chat threads for in-app AI assistance. Groups a sequence of `messages` exchanged between the user and the AI assistant.

Intended for future in-dashboard AI chat features (e.g. "Explain why this claim matches this job", "Suggest a stronger phrasing").

Note: this table has only a `createdAt` timestamp (no `updatedAt`).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment |
| `title` | text | NOT NULL | Human-readable conversation title (e.g. auto-generated from first message) |

**Indexes**: none beyond PK.

---

## `messages`

Individual turns within a `conversations` thread. Records a single exchange between the user and the AI.

`role` values follow the OpenAI/OpenRouter convention: `"user"` (human), `"assistant"` (AI), `"system"` (injected context). Messages are cascade-deleted when their parent conversation is deleted.

Note: this table has only a `createdAt` timestamp (no `updatedAt`).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | serial | PK | Auto-increment |
| `conversation_id` | integer | FK → `conversations.id` ON DELETE CASCADE, NOT NULL | The conversation this message belongs to |
| `role` | text | NOT NULL | Message role: `"user"`, `"assistant"`, or `"system"` |
| `content` | text | NOT NULL | Full text content of the message |

**Indexes**: none beyond PK.
