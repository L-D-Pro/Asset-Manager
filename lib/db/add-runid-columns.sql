-- Add run_id columns for M002 lineage enforcement
-- Run this in your database if drizzle-kit push fails

-- Check if columns exist before adding
DO $$
BEGIN
    -- event_logs.run_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'event_logs' AND column_name = 'run_id') THEN
        ALTER TABLE event_logs ADD COLUMN run_id text;
        CREATE INDEX IF NOT EXISTS event_logs_run_id_idx ON event_logs(run_id);
    END IF;

    -- resume_versions.run_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'resume_versions' AND column_name = 'run_id') THEN
        ALTER TABLE resume_versions ADD COLUMN run_id text;
        CREATE INDEX IF NOT EXISTS resume_versions_run_id_idx ON resume_versions(run_id);
    END IF;

    -- resume_versions.event_log_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'resume_versions' AND column_name = 'event_log_id') THEN
        ALTER TABLE resume_versions ADD COLUMN event_log_id integer;
        CREATE INDEX IF NOT EXISTS resume_versions_event_log_id_idx ON resume_versions(event_log_id);
    END IF;

    -- cover_letter_versions.run_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cover_letter_versions' AND column_name = 'run_id') THEN
        ALTER TABLE cover_letter_versions ADD COLUMN run_id text;
        CREATE INDEX IF NOT EXISTS cover_letter_versions_run_id_idx ON cover_letter_versions(run_id);
    END IF;

    -- cover_letter_versions.event_log_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cover_letter_versions' AND column_name = 'event_log_id') THEN
        ALTER TABLE cover_letter_versions ADD COLUMN event_log_id integer;
        CREATE INDEX IF NOT EXISTS cover_letter_versions_event_log_id_idx ON cover_letter_versions(event_log_id);
    END IF;

    -- ai_run_evaluations.run_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ai_run_evaluations' AND column_name = 'run_id') THEN
        ALTER TABLE ai_run_evaluations ADD COLUMN run_id text;
        CREATE INDEX IF NOT EXISTS ai_run_evaluations_run_id_idx ON ai_run_evaluations(run_id);
    END IF;

    -- feedback_signals.run_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'feedback_signals' AND column_name = 'run_id') THEN
        ALTER TABLE feedback_signals ADD COLUMN run_id text;
        CREATE INDEX IF NOT EXISTS feedback_signals_run_id_idx ON feedback_signals(run_id);
    END IF;

    -- feedback_signals.event_log_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'feedback_signals' AND column_name = 'event_log_id') THEN
        ALTER TABLE feedback_signals ADD COLUMN event_log_id integer;
        CREATE INDEX IF NOT EXISTS feedback_signals_event_log_id_idx ON feedback_signals(event_log_id);
    END IF;

END $$;
