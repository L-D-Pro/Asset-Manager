-- Phase 12: Indexes for ai-metrics-snapshot window queries.
-- All are idempotent (CREATE INDEX IF NOT EXISTS) — safe to re-run.

-- Evaluation window query: user + taskScope + createdAt range
CREATE INDEX IF NOT EXISTS ai_run_evaluations_user_task_created_idx
ON ai_run_evaluations(user_id, task_scope, created_at DESC);

-- Evaluation window query without taskScope filter
CREATE INDEX IF NOT EXISTS ai_run_evaluations_user_created_idx
ON ai_run_evaluations(user_id, created_at DESC);

-- Event log lookup by runId for lineage validation
CREATE INDEX IF NOT EXISTS event_logs_user_entity_run_idx
ON event_logs(user_id, entity_type, run_id);
