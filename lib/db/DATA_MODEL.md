# Data Model

Last updated: May 16, 2026

Job Ops uses PostgreSQL with Drizzle ORM. Most primary keys are serial integers. The schema is grouped by operational domain.

## Canonical AI Run Lineage Contract (M002)

M002 introduces a canonical `run_id` lineage contract for in-scope job-side AI flows. The AI run is the root of lineage.

### In-scope lineage tables

The following tables are in scope for the canonical contract in M002:

- `event_logs`
- `resume_versions`
- `cover_letter_versions`
- `ai_run_evaluations`
- `feedback_signals`

### Canonical rules

- `event_logs.run_id` is the root lineage key for AI-originated flows.
- The root row is the originating `event_logs` row for the AI run (`entity_type = "ai_call"`).
- Downstream generated artifacts, evaluations, approvals, and feedback signals must carry the same `run_id` when they belong to that run.
- Supporting joins may use both `run_id` and `event_log_id`, but `run_id` is the canonical cross-table lineage key.
- `run_id` is indexed on every in-scope table to keep future lineage validation and reporting queries performant.

### Lineage validation (fail-closed)

The system validates lineage before sensitive operations. Validation can return these statuses:

| Status | Meaning | HTTP Response |
|--------|---------|---------------|
| `valid` | Lineage chain is complete and correct | 200/201 |
| `legacy_missing_run_id` | Row has no `run_id` (pre-M002 data) | 422 |
| `invalid_run_id_format` | `run_id` doesn't match canonical format | 422 |
| `missing_root_run` | No root `event_logs` row found for `run_id` | 422 |
| `missing_root_ai_event` | Root event is not an AI call | 422 |
| `missing_child_linkage` | Child record lacks `event_log_id` | 422 |
| `mismatched_run_id` | Linked records have different `run_id` | 422 |
| `mismatched_event_linkage` | `event_log_id` points to wrong event | 422 |

Operations that validate lineage:
- Resume version approve/reject
- Cover letter version approve/reject
- AI run evaluation creation
- Feedback signal creation

### API usage

**Mint a run ID (typically done by `callAI`):**
```typescript
import { mintRunId } from "@workspace/api-server/lib/lineage";
const runId = mintRunId(); // "run_20260417t230145123z_a1b2c3d4e5f6"
```

**Validate lineage before write:**
```typescript
import { validateLineage } from "@workspace/api-server/lib/lineage";
const result = await validateLineage({
  table: "resume_versions",
  id: versionId,
  runId: version.runId,
  eventLogId: version.eventLogId,
  jobId: version.jobId,
});
if (!result.ok) {
  // Return 422 with diagnostics
}
```

**Inspect any record's lineage:**
```typescript
import { inspectLineage } from "@workspace/api-server/lib/lineage";
const diagnostics = await inspectLineage("resume_versions", 42);
```

### Example lineage chain

A complete AI resume tailoring flow:

```sql
-- 1. AI call creates root event
INSERT INTO event_logs (entity_type, entity_id, run_id, event_type, metadata)
VALUES ('ai_call', 1, 'run_20260417t230145123z_abc123', 'ai_call', '{"taskType": "resume_tailoring"}');
-- Returns: id = 1001

-- 2. Generated artifact carries same run_id
INSERT INTO resume_versions (job_id, run_id, event_log_id, status, tailored_document_text)
VALUES (5, 'run_20260417t230145123z_abc123', 1001, 'pending_approval', '...');
-- Returns: id = 2001

-- 3. Approval event logs with same run_id
INSERT INTO event_logs (entity_type, entity_id, run_id, event_type, previous_state, next_state)
VALUES ('resume_version', 2001, 'run_20260417t230145123z_abc123', 'approval', 'pending_approval', 'approved');

-- 4. Evaluation links to same run
INSERT INTO ai_run_evaluations (run_id, event_log_id, task_scope, approval_outcome, edit_distance)
VALUES ('run_20260417t230145123z_abc123', 1001, 'resume_review', 'approved', 15);
```

Query to verify end-to-end joinability:
```sql
SELECT 
  el.run_id,
  rv.id as resume_version_id,
  el2.event_type as approval_event,
  are.edit_distance
FROM event_logs el
LEFT JOIN resume_versions rv ON rv.run_id = el.run_id
LEFT JOIN event_logs el2 ON el2.run_id = el.run_id AND el2.event_type = 'approval'
LEFT JOIN ai_run_evaluations are ON are.run_id = el.run_id
WHERE el.entity_type = 'ai_call'
  AND el.run_id = 'run_20260417t230145123z_abc123';
```

### Legacy and malformed rows

This rollout is nullable-first. Historical rows may not have trustworthy lineage.

- Rows with null `run_id` remain readable and diagnosable.
- Rows with null or malformed `run_id` are **not** considered valid lineage.
- Helpers must fail closed for lineage-sensitive behavior instead of inventing or inferring lineage for old rows.
- Broken lineage should remain inspectable through helper diagnostics such as missing root run, missing child linkage, invalid `run_id` format, or mismatched joins.
- Legacy rows are excluded from metrics that require trusted lineage.

## Job Search Core

### `role_profiles`

Named target profiles for scoring jobs.

Key fields:

- `name`
- `description`
- `soft_weights`
- `hard_filters`
- `is_active`

### `jobs`

Ingested job descriptions and parsed JD data.

Key fields:

- `title`
- `company`
- `source_url`
- `source_platform`
- `raw_jd_text`
- parsed skills/responsibilities/keywords/salary fields
- `status`

### `claims`

The truth-lock ledger. Each row is an atomic factual statement the AI may use.

Key fields:

- `summary`
- `evidence`
- `evidence_type`
- `phrasing_variants`
- `disallowed_implications`
- `domain`
- `applicable_tags`
- `is_active`

### `base_resume_versions`

Immutable global base resume history.

Key fields:

- `content_text`
- `label`
- `is_current`
- timestamps

Behavior:

- Saving creates a new row.
- Restoring clones an older row into a new current row.
- Resume tailoring requires exactly one current base resume.

### `resume_versions`

Tailored resume drafts.

Key fields:

- `job_id`
- `base_resume_version_id`
- `run_id`
- `event_log_id`
- `status`
- `tailored_document_text`
- `tailored_bullets`
- `diff_data`
- `claim_ids`
- `raw_content`
- `notes`

Lineage notes:

- `run_id` is the canonical AI lineage key for the generated resume draft.
- `event_log_id` anchors the draft to the originating AI/event log row.
- Null lineage fields indicate legacy or non-joinable rows and must not be treated as trusted lineage.

Every generated resume is traceable to the exact base resume version used.

### `cover_letter_versions`

Cover letter drafts.

Key fields:

- `job_id`
- `run_id`
- `event_log_id`
- `status`
- `draft_content`
- `annotated_paragraphs`
- `claim_ids`
- `notes`

Lineage notes:

- `run_id` is the canonical AI lineage key for the generated cover letter.
- `event_log_id` anchors the draft to the originating AI/event log row.
- Legacy rows may lack one or both lineage fields and should fail closed in lineage-sensitive joins.

### `applications`

Lifecycle tracker for submitted or planned applications.

Key fields:

- `job_id`
- `resume_version_id`
- `cover_letter_version_id`
- `status`
- `apply_mode`
- `platform`
- `applied_at`
- `confirmation_ref`
- `notes`
- `action_log`

## Audit, AI Routing, and Learning

### `event_logs`

Append-only audit log for AI calls, state changes, and important system actions.

Key fields:

- `entity_type`
- `entity_id`
- `application_id`
- `job_id`
- `run_id`
- `event_type`
- `previous_state`
- `next_state`
- `metadata`
- `actor_type`

Lineage notes:

- `run_id` is the canonical root lineage key for M002 in-scope job-side AI flows.
- The originating AI run row in this table is the authoritative root for downstream lineage validation.
- Event rows without `run_id` remain valid audit history but not valid lineage roots.

AI call metadata stores model, provider, prompt version, token counts, estimated cost, fallback attempts, and failures.

### `feedback_signals`

Outcome and review signals used for future learning.

Key fields:

- `application_id`
- `resume_version_id`
- `job_id`
- `role_profile_id`
- `base_resume_version_id`
- `cover_letter_version_id`
- `prompt_version_id`
- `model_name`
- `selected_claim_ids`
- `final_result`
- `run_id`
- `event_log_id`
- `outcome`
- `signal_type`
- `notes`
- `attribution_data`
- `processed_at`

Lineage notes:

- `run_id` keeps downstream feedback joinable to the originating AI run.
- `event_log_id` provides the supporting event anchor for validation and diagnostics.
- Feedback without trustworthy lineage remains queryable but should be excluded from trusted lineage metrics and enforcement.

### `ai_model_configs`

Per-task model routing and fallback config.

Key fields:

- `task_scope`
- `provider`
- `model_name`
- `is_active`
- `priority`
- `fallback_model_id`
- `cost_per_input_token`
- `cost_per_output_token`
- `max_tokens`
- `extra_config`

### `ai_prompt_versions`

Versioned prompt templates for supervised AI improvement.

Key fields:

- `task_scope`
- `version`
- `label`
- `system_prompt`
- `user_prompt_template`
- `is_active`
- `metadata`

Active prompt versions override built-in pipeline prompts for a task.

### `ai_run_evaluations`

Evaluation records for AI outputs.

Key fields:

- `event_log_id`
- `run_id`
- `prompt_version_id`
- `task_scope`
- `entity_type`
- `entity_id`
- truth/relevance/formatting/attribution scores
- `approval_outcome`
- `edit_distance`
- `downstream_outcome`
- `evaluator_type`
- `notes`
- `metadata`

Lineage notes:

- Evaluations are in-scope for the canonical lineage contract.
- `run_id` is the canonical join key back to the originating AI run.
- `event_log_id` preserves a direct event anchor for validation and debugging.
- Evaluations with null lineage remain readable but are not valid for trusted lineage reporting.

### `ai_training_examples`

Curated examples for few-shot prompting, offline evals, or future fine-tuning.

Key fields:

- `task_scope`
- `source_entity_type`
- `source_entity_id`
- `evaluation_id`
- `input_snapshot`
- `approved_output`
- `rejected_output`
- `quality_score`
- `is_active`
- `metadata`

Only human-approved or human-edited examples should be promoted here.

## Assisted Apply

### `site_adapters`

Policy/config record for supported platforms.

Key fields:

- `platform`
- `label`
- `adapter_type`
- `allowed_automation_level`
- `is_active`
- `requires_human_final_submit`
- `notes`
- `metadata`

### `application_sessions`

Human-approved assisted-apply session records.

Key fields:

- `application_id`
- `job_id`
- `site_adapter_id`
- `platform`
- `target_url`
- `status`
- `human_checkpoint`
- `current_step`
- `metadata`

### `application_form_fields`

Detected/suggested/approved fields for assisted-apply sessions.

Key fields:

- `session_id`
- `field_key`
- `label`
- `field_type`
- `detected_value`
- `suggested_value`
- `approved_value`
- `status`
- `is_sensitive`
- `metadata`

### `application_actions`

Audit log for assisted-apply actions.

Key fields:

- `session_id`
- `action_type`
- `status`
- `requires_human_approval`
- `summary`
- `metadata`

## Freelance Copilot

### `freelance_profiles`

Contractor source-of-truth profile.

Key fields:

- `name`
- `contractor_resume_text`
- `portfolio_projects`
- `skills`
- `case_studies`
- `hourly_rate_min`
- `hourly_rate_target`
- `availability`
- `preferred_project_types`
- `disallowed_claims`
- `proof_links`
- `is_active`

### `project_sources`

Raw/manual project capture sources.

Key fields:

- `platform`
- `source_type`
- `source_url`
- `title`
- `raw_text`
- `metadata`

### `freelance_projects`

Captured Upwork-style projects.

Key fields:

- `profile_id`
- `source_id`
- `platform`
- `title`
- `client_name`
- `project_url`
- `description_text`
- budget/rate fields
- `required_skills`
- `client_metadata`
- `fit_score`
- `risk_flags`
- `status`

### `proposal_versions`

AI or manual proposal drafts.

Key fields:

- `project_id`
- `profile_id`
- `status`
- `proposal_text`
- `client_message_text`
- `bid_amount`
- `bid_type`
- `milestones`
- `cited_proof`
- `risk_notes`
- `raw_content`
- `metadata`

Proposal drafts stay pending until approved/rejected by the user.

### `proposal_outcomes`

Outcome tracking for freelance proposals.

Key fields:

- `proposal_version_id`
- `project_id`
- `outcome`
- `actual_earnings`
- `client_quality`
- `notes`
- `metadata`

### `client_message_templates`

Reusable proposal/client message templates.

Key fields:

- `name`
- `template_text`
- `use_case`
- `is_active`
- `metadata`

## Auth and User Management

### `admin_users`

Single-user admin auth, password hash, email, TOTP, recovery codes.

### `session`

`connect-pg-simple` session store table.

### `invite_codes`

Admin-generated invite codes for gating registration. Includes usage tracking, expiry, and code validation. Admin-only CRUD; public validate endpoint.

### `user_usage_limits`

Per-user soft limits on AI operations (e.g. resumes tailored per day). Admin-managed.

### `waitlist`

Email capture for pre-launch signups. Not tied to auth flow.

## Chat

### `conversations`

Thread-per-conversation model. Fields: `title`, `userId`, `metadata`, timestamps.

### `messages`

Individual messages within a conversation. Fields: `conversationId`, `role` (user/assistant/system), `content`, `attachments` (JSONB), `metadata`, timestamps. Supports per-message feedback.

## Gamification

### `user_stats`

Per-user aggregate: `totalXp`, `currentLevel`, `currentStreak`, `longestStreak`, `questsCompleted`, `achievementsUnlocked`.

### `xp_log`

Append-only XP event log. Fields: `userId`, `actionType`, `xpAmount`, `metadata`.

### `achievements`

Achievement definitions. Fields: `slug`, `name`, `description`, `iconName`, `xpReward`, `criteriaType`, `criteriaValue`, `isHidden`.

### `user_achievements`

Join table recording which achievements each user has unlocked and when.

### `quests`

Quest definitions with step sequences and XP rewards.

### `user_quests`

Per-user quest progress: acceptance, step completion, completion timestamps.

## Job Board

### `job_sources`

RSS/Atom feed configurations for job aggregation. Fields: `key`, `name`, `feedUrl`, `sourceType`, `category`, `keywords`, `isActive`, `lastFetchedAt`.

### `job_listings`

Aggregated job listings from configured sources. Fields: `sourceId`, `externalId`, `title`, `company`, `location`, `description`, `url`, `postedAt`, `isActive`, `metadata`.

## Platform / UX

### `wizard_sessions`

Multi-step guided flow state. Fields: `userId`, `jobId`, `currentStep`, `state` (JSONB). Used by the Apply Wizard.

### `user_onboarding`

Per-user onboarding progress. Tracks which steps are complete, hints dismissed, and welcome-seen state.

### `best_practices`

Admin-curated tips and best-practice entries surfaced in the dashboard guide.

### `feedback`

User-submitted in-app feedback (rating, comment, category). Not to be confused with `feedback_signals` (AI learning) or per-message chat feedback.
