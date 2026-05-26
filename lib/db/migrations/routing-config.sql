BEGIN;

-- ── ai_chat_lever_config: tunable routing weight columns ─────────────────
ALTER TABLE "ai_chat_lever_config"
  ADD COLUMN IF NOT EXISTS "auto_threshold"            real    NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS "trigger_weight"            real    NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS "negative_trigger_weight"   real    NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS "ambiguous_gap"             real    NOT NULL DEFAULT 0.15,
  ADD COLUMN IF NOT EXISTS "llm_confidence_threshold"  real    NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS "cover_boost"               real    NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS "boost_tailor_plus_job"     real    NOT NULL DEFAULT 0.4,
  ADD COLUMN IF NOT EXISTS "boost_resume_plus_job"     real    NOT NULL DEFAULT 0.2,
  ADD COLUMN IF NOT EXISTS "boost_audit_tailored_job"  real    NOT NULL DEFAULT 0.4,
  ADD COLUMN IF NOT EXISTS "boost_audit_tailored_only" real    NOT NULL DEFAULT 0.2,
  ADD COLUMN IF NOT EXISTS "history_turn_limit"        integer NOT NULL DEFAULT 20;

COMMIT;
