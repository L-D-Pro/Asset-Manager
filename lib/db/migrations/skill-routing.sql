-- Skill routing refactor — additive schema changes for progressive-disclosure
-- skill injection (registry metadata + router + observability).
--
-- Why this is hand-curated (not `drizzle-kit push`):
--   `pnpm --filter @workspace/db run push` still stalls on this DB's pre-existing
--   interactive drift prompt (user_stats_user_id_unique), the same blocker noted
--   in chat-mvp.sql. This file captures ONLY the skill-routing changes so they
--   apply cleanly and independently.
--
-- Apply with (from lib/db):
--   node --env-file=../../.env apply-skill-routing.mjs
--
-- Safety: all changes are additive (ADD COLUMN IF NOT EXISTS, CREATE TABLE
-- IF NOT EXISTS) and idempotent. The skill_routing_mode value remap
-- (classified→auto, all→debug_all) is also re-applied at server startup by
-- seedChatRuntime().migrateRoutingModes(), which additionally migrates preset
-- snapshots.

BEGIN;

-- ── ai_chat_lever_config: token budget + max skills + new mode default ─────
ALTER TABLE "ai_chat_lever_config"
  ADD COLUMN IF NOT EXISTS "skill_token_budget" integer NOT NULL DEFAULT 1500;
ALTER TABLE "ai_chat_lever_config"
  ADD COLUMN IF NOT EXISTS "max_selected_skills" integer NOT NULL DEFAULT 1;

ALTER TABLE "ai_chat_lever_config"
  ALTER COLUMN "skill_routing_mode" SET DEFAULT 'auto';

-- Remap legacy mode values on the singleton config row.
UPDATE "ai_chat_lever_config" SET "skill_routing_mode" = 'auto'      WHERE "skill_routing_mode" = 'classified';
UPDATE "ai_chat_lever_config" SET "skill_routing_mode" = 'debug_all' WHERE "skill_routing_mode" = 'all';

-- ── chat_routing_decisions: per-turn routing observability ─────────────────
CREATE TABLE IF NOT EXISTS "chat_routing_decisions" (
  "id" serial PRIMARY KEY,
  "run_id" text,
  "conversation_id" integer NOT NULL,
  "message_id" integer,
  "routing_mode" text NOT NULL,
  "candidates" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "selected_skills" text[] NOT NULL DEFAULT '{}',
  "classifier_type" text NOT NULL,
  "confidence" numeric(3,2),
  "llm_used" boolean NOT NULL DEFAULT false,
  "rationale" text,
  "skill_prompt_tokens" integer NOT NULL DEFAULT 0,
  "budget_trimmed" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "chat_routing_decisions"
  DROP CONSTRAINT IF EXISTS "chat_routing_decisions_conversation_id_conversations_id_fk";
ALTER TABLE "chat_routing_decisions"
  ADD CONSTRAINT "chat_routing_decisions_conversation_id_conversations_id_fk"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "chat_routing_decisions_run_idx"
  ON "chat_routing_decisions" ("run_id");
CREATE INDEX IF NOT EXISTS "chat_routing_decisions_conversation_idx"
  ON "chat_routing_decisions" ("conversation_id");
CREATE INDEX IF NOT EXISTS "chat_routing_decisions_created_idx"
  ON "chat_routing_decisions" ("created_at");

COMMIT;
