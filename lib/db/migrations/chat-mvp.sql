-- Chat MVP — additive schema changes for the conversational UI feature.
--
-- This script ONLY extends the existing `conversations` and `messages` tables
-- (both previously empty stubs intended for future in-dashboard AI chat) so the
-- chat feature can persist threads, attachments, and AI lineage.
--
-- Why this is hand-curated:
--   `pnpm --filter @workspace/db run push` is the canonical migration tool for
--   this repo, but on 2026-05-14 the live DB had pre-existing drift unrelated
--   to chat (a pending `user_stats_user_id_unique` constraint) that blocked
--   interactive push. This file captures ONLY the chat changes so it can be
--   applied independently via psql while the drift is resolved separately.
--
-- Apply with:
--   psql "$DATABASE_URL" -f lib/db/migrations/chat-mvp.sql
--
-- Safety: all ALTERs are additive. The `user_id NOT NULL` on conversations
-- assumes the table is empty (it was an unused stub). The post-bootstrap
-- chat seed script (`artifacts/api-server/src/lib/chat/seed.ts`) populates
-- `ai_prompt_versions` and `ai_model_configs` for the new `chat` task scope.

BEGIN;

-- ── conversations ────────────────────────────────────────────────────────
ALTER TABLE "conversations" ALTER COLUMN "title" SET DEFAULT 'New chat';

ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "user_id" integer NOT NULL;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "model_scope" text NOT NULL DEFAULT 'chat';
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "archived_at" timestamptz;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();

ALTER TABLE "conversations"
  DROP CONSTRAINT IF EXISTS "conversations_user_id_admin_users_id_fk";
ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_user_id_admin_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "conversations_user_idx"
  ON "conversations" ("user_id", "archived_at", "updated_at");

-- ── messages ─────────────────────────────────────────────────────────────
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "run_id" text;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "prompt_version_id" integer;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "model_name" text;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "prompt_tokens" integer;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "completion_tokens" integer;

ALTER TABLE "messages"
  DROP CONSTRAINT IF EXISTS "messages_prompt_version_id_ai_prompt_versions_id_fk";
ALTER TABLE "messages"
  ADD CONSTRAINT "messages_prompt_version_id_ai_prompt_versions_id_fk"
  FOREIGN KEY ("prompt_version_id") REFERENCES "ai_prompt_versions"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "messages_conversation_idx"
  ON "messages" ("conversation_id", "created_at");
CREATE INDEX IF NOT EXISTS "messages_run_id_idx"
  ON "messages" ("run_id");

COMMIT;
