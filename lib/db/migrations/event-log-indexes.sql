-- Phase 10: Compound indexes for event_logs pagination and filtering.
-- All are scoped to user_id for efficient per-user queries.
-- Idempotent: safe to run multiple times.

-- Primary pagination index: user + time-based cursor
CREATE INDEX IF NOT EXISTS event_logs_user_created_idx
ON event_logs(user_id, created_at DESC, id DESC);

-- Entity filter + pagination
CREATE INDEX IF NOT EXISTS event_logs_user_entity_created_idx
ON event_logs(user_id, entity_type, entity_id, created_at DESC, id DESC);

-- Run ID lookup
CREATE INDEX IF NOT EXISTS event_logs_user_run_idx
ON event_logs(user_id, run_id);

-- Event type filter + pagination
CREATE INDEX IF NOT EXISTS event_logs_user_event_type_created_idx
ON event_logs(user_id, event_type, created_at DESC, id DESC);
