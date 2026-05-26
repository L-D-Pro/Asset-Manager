-- Phase 2: user-owned private business data.
--
-- Required invocation pattern:
--   BEGIN;
--   SET LOCAL jobops.legacy_owner_user_id = '123';
--   \i lib/db/migrations/user-ownership.sql
--   COMMIT;
--
-- The chosen legacy owner must be reviewed before execution. This migration
-- aborts when existing user-scoped wizard data contradicts that assignment.

DO $$
DECLARE
  legacy_owner_id integer := NULLIF(current_setting('jobops.legacy_owner_user_id', true), '')::integer;
BEGIN
  IF legacy_owner_id IS NULL THEN
    RAISE EXCEPTION 'Set jobops.legacy_owner_user_id before applying user ownership migration';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE id = legacy_owner_id) THEN
    RAISE EXCEPTION 'Configured legacy owner % does not exist in admin_users', legacy_owner_id;
  END IF;
END $$;

ALTER TABLE role_profiles ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE base_resume_versions ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE cover_letter_versions ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE feedback_signals ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE application_sessions ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE freelance_profiles ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE project_sources ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE proposal_versions ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE proposal_outcomes ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE client_message_templates ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE ai_training_examples ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;
ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS user_id integer REFERENCES admin_users(id) ON DELETE CASCADE;

DO $$
DECLARE
  legacy_owner_id integer := current_setting('jobops.legacy_owner_user_id')::integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM wizard_sessions ws
    JOIN jobs j ON j.id = ws.job_id
    WHERE j.user_id IS NULL
      AND ws.user_id <> legacy_owner_id
  ) THEN
    RAISE EXCEPTION 'Legacy job ownership conflicts with an existing wizard session owner';
  END IF;

  UPDATE role_profiles SET user_id = legacy_owner_id WHERE user_id IS NULL;
  UPDATE jobs SET user_id = legacy_owner_id WHERE user_id IS NULL;
  UPDATE claims SET user_id = legacy_owner_id WHERE user_id IS NULL;
  UPDATE base_resume_versions SET user_id = legacy_owner_id WHERE user_id IS NULL;
  UPDATE resume_versions SET user_id = legacy_owner_id WHERE user_id IS NULL;
  UPDATE cover_letter_versions SET user_id = legacy_owner_id WHERE user_id IS NULL;
  UPDATE applications SET user_id = legacy_owner_id WHERE user_id IS NULL;
  UPDATE feedback_signals SET user_id = legacy_owner_id WHERE user_id IS NULL;
  UPDATE application_sessions SET user_id = legacy_owner_id WHERE user_id IS NULL;
  UPDATE freelance_profiles SET user_id = legacy_owner_id WHERE user_id IS NULL;
  UPDATE project_sources SET user_id = legacy_owner_id WHERE user_id IS NULL;
  UPDATE freelance_projects SET user_id = legacy_owner_id WHERE user_id IS NULL;
  UPDATE proposal_versions SET user_id = legacy_owner_id WHERE user_id IS NULL;
  UPDATE proposal_outcomes SET user_id = legacy_owner_id WHERE user_id IS NULL;
  UPDATE client_message_templates SET user_id = legacy_owner_id WHERE user_id IS NULL;

  UPDATE event_logs el
  SET user_id = j.user_id
  FROM jobs j
  WHERE el.user_id IS NULL AND el.job_id = j.id;

  UPDATE event_logs el
  SET user_id = a.user_id
  FROM applications a
  WHERE el.user_id IS NULL AND el.application_id = a.id;

  UPDATE event_logs el
  SET user_id = c.user_id
  FROM conversations c
  WHERE el.user_id IS NULL
    AND el.entity_type = 'conversation'
    AND el.entity_id = c.id;

  UPDATE event_logs el
  SET user_id = c.user_id
  FROM messages m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE el.user_id IS NULL
    AND el.entity_type = 'ai_call'
    AND el.entity_id = m.id
    AND el.metadata->>'chatMessageEntityType' = 'chat_message';

  UPDATE event_logs
  SET user_id = legacy_owner_id
  WHERE user_id IS NULL
    AND entity_type IN (
      'ai_call',
      'job',
      'application',
      'application_session',
      'resume_version',
      'cover_letter_version',
      'proposal_version'
    );

  UPDATE ai_run_evaluations e
  SET user_id = el.user_id
  FROM event_logs el
  WHERE e.user_id IS NULL
    AND e.event_log_id = el.id
    AND el.user_id IS NOT NULL;

  UPDATE ai_run_evaluations SET user_id = legacy_owner_id WHERE user_id IS NULL;

  UPDATE ai_training_examples t
  SET user_id = e.user_id
  FROM ai_run_evaluations e
  WHERE t.user_id IS NULL
    AND t.evaluation_id = e.id;

  UPDATE ai_training_examples SET user_id = legacy_owner_id WHERE user_id IS NULL;

  IF EXISTS (
    SELECT 1
    FROM jobs j
    JOIN role_profiles rp ON rp.id = j.role_profile_id
    WHERE j.user_id <> rp.user_id
  ) OR EXISTS (
    SELECT 1
    FROM applications a
    JOIN jobs j ON j.id = a.job_id
    WHERE a.user_id <> j.user_id
  ) OR EXISTS (
    SELECT 1
    FROM resume_versions rv
    JOIN jobs j ON j.id = rv.job_id
    WHERE rv.user_id <> j.user_id
  ) OR EXISTS (
    SELECT 1
    FROM resume_versions rv
    JOIN base_resume_versions br ON br.id = rv.base_resume_version_id
    WHERE rv.user_id <> br.user_id
  ) OR EXISTS (
    SELECT 1
    FROM cover_letter_versions cv
    JOIN jobs j ON j.id = cv.job_id
    WHERE cv.user_id <> j.user_id
  ) OR EXISTS (
    SELECT 1
    FROM applications a
    JOIN resume_versions rv ON rv.id = a.resume_version_id
    WHERE a.user_id <> rv.user_id
  ) OR EXISTS (
    SELECT 1
    FROM applications a
    JOIN cover_letter_versions cv ON cv.id = a.cover_letter_version_id
    WHERE a.user_id <> cv.user_id
  ) OR EXISTS (
    SELECT 1
    FROM feedback_signals f
    JOIN applications a ON a.id = f.application_id
    WHERE f.user_id <> a.user_id
  ) OR EXISTS (
    SELECT 1
    FROM feedback_signals f
    LEFT JOIN jobs j ON j.id = f.job_id
    LEFT JOIN resume_versions rv ON rv.id = f.resume_version_id
    LEFT JOIN cover_letter_versions cv ON cv.id = f.cover_letter_version_id
    LEFT JOIN role_profiles rp ON rp.id = f.role_profile_id
    LEFT JOIN base_resume_versions br ON br.id = f.base_resume_version_id
    LEFT JOIN event_logs el ON el.id = f.event_log_id
    WHERE (j.id IS NOT NULL AND f.user_id <> j.user_id)
       OR (rv.id IS NOT NULL AND f.user_id <> rv.user_id)
       OR (cv.id IS NOT NULL AND f.user_id <> cv.user_id)
       OR (rp.id IS NOT NULL AND f.user_id <> rp.user_id)
       OR (br.id IS NOT NULL AND f.user_id <> br.user_id)
       OR (el.id IS NOT NULL AND el.user_id IS DISTINCT FROM f.user_id)
  ) OR EXISTS (
    SELECT 1
    FROM application_sessions s
    LEFT JOIN applications a ON a.id = s.application_id
    LEFT JOIN jobs j ON j.id = s.job_id
    WHERE (a.id IS NOT NULL AND s.user_id <> a.user_id)
       OR (j.id IS NOT NULL AND s.user_id <> j.user_id)
  ) OR EXISTS (
    SELECT 1
    FROM proposal_versions pv
    JOIN freelance_projects fp ON fp.id = pv.project_id
    WHERE pv.user_id <> fp.user_id
  ) OR EXISTS (
    SELECT 1
    FROM freelance_projects fp
    LEFT JOIN freelance_profiles p ON p.id = fp.profile_id
    LEFT JOIN project_sources ps ON ps.id = fp.source_id
    WHERE (p.id IS NOT NULL AND fp.user_id <> p.user_id)
       OR (ps.id IS NOT NULL AND fp.user_id <> ps.user_id)
  ) OR EXISTS (
    SELECT 1
    FROM proposal_versions pv
    JOIN freelance_profiles p ON p.id = pv.profile_id
    WHERE pv.user_id <> p.user_id
  ) OR EXISTS (
    SELECT 1
    FROM proposal_outcomes po
    LEFT JOIN freelance_projects fp ON fp.id = po.project_id
    LEFT JOIN proposal_versions pv ON pv.id = po.proposal_version_id
    WHERE (fp.id IS NOT NULL AND po.user_id <> fp.user_id)
       OR (pv.id IS NOT NULL AND po.user_id <> pv.user_id)
  ) OR EXISTS (
    SELECT 1
    FROM ai_run_evaluations e
    JOIN event_logs el ON el.id = e.event_log_id
    WHERE el.user_id IS DISTINCT FROM e.user_id
  ) OR EXISTS (
    SELECT 1
    FROM ai_training_examples t
    JOIN ai_run_evaluations e ON e.id = t.evaluation_id
    WHERE t.user_id <> e.user_id
  ) OR EXISTS (
    SELECT 1
    FROM ai_training_examples t
    LEFT JOIN resume_versions rv
      ON t.source_entity_type = 'resume_version' AND rv.id = t.source_entity_id
    LEFT JOIN cover_letter_versions cv
      ON t.source_entity_type = 'cover_letter_version' AND cv.id = t.source_entity_id
    LEFT JOIN proposal_versions pv
      ON t.source_entity_type = 'proposal_version' AND pv.id = t.source_entity_id
    WHERE (rv.id IS NOT NULL AND t.user_id <> rv.user_id)
       OR (cv.id IS NOT NULL AND t.user_id <> cv.user_id)
       OR (pv.id IS NOT NULL AND t.user_id <> pv.user_id)
  ) OR EXISTS (
    SELECT 1
    FROM event_logs el
    LEFT JOIN jobs j ON j.id = el.job_id
    LEFT JOIN applications a ON a.id = el.application_id
    WHERE (j.id IS NOT NULL AND el.user_id IS DISTINCT FROM j.user_id)
       OR (a.id IS NOT NULL AND el.user_id IS DISTINCT FROM a.user_id)
  ) OR EXISTS (
    SELECT 1
    FROM wizard_sessions ws
    JOIN jobs j ON j.id = ws.job_id
    WHERE ws.user_id <> j.user_id
  ) THEN
    RAISE EXCEPTION 'Ownership mismatch found in linked private records';
  END IF;

  IF EXISTS (
    SELECT user_id
    FROM base_resume_versions
    WHERE is_current = true
    GROUP BY user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'More than one current base resume exists for a user';
  END IF;
END $$;

ALTER TABLE role_profiles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE claims ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE base_resume_versions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE resume_versions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE cover_letter_versions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE applications ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE feedback_signals ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE application_sessions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE freelance_profiles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE project_sources ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE freelance_projects ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE proposal_versions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE proposal_outcomes ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE client_message_templates ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE ai_run_evaluations ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE ai_training_examples ALTER COLUMN user_id SET NOT NULL;

DROP INDEX IF EXISTS base_resume_versions_current_unique_idx;
CREATE UNIQUE INDEX base_resume_versions_current_unique_idx
  ON base_resume_versions (user_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS role_profiles_user_created_at_idx ON role_profiles (user_id, created_at);
CREATE INDEX IF NOT EXISTS role_profiles_user_active_idx ON role_profiles (user_id, is_active);
CREATE INDEX IF NOT EXISTS jobs_user_created_at_idx ON jobs (user_id, created_at);
CREATE INDEX IF NOT EXISTS jobs_user_status_idx ON jobs (user_id, status);
CREATE INDEX IF NOT EXISTS claims_user_created_at_idx ON claims (user_id, created_at);
CREATE INDEX IF NOT EXISTS claims_user_active_idx ON claims (user_id, is_active);
CREATE INDEX IF NOT EXISTS base_resume_versions_user_created_at_idx ON base_resume_versions (user_id, created_at);
CREATE INDEX IF NOT EXISTS base_resume_versions_user_current_idx ON base_resume_versions (user_id, is_current);
CREATE INDEX IF NOT EXISTS resume_versions_user_created_at_idx ON resume_versions (user_id, created_at);
CREATE INDEX IF NOT EXISTS resume_versions_user_status_idx ON resume_versions (user_id, status);
CREATE INDEX IF NOT EXISTS cover_letter_versions_user_created_at_idx ON cover_letter_versions (user_id, created_at);
CREATE INDEX IF NOT EXISTS cover_letter_versions_user_status_idx ON cover_letter_versions (user_id, status);
CREATE INDEX IF NOT EXISTS applications_user_created_at_idx ON applications (user_id, created_at);
CREATE INDEX IF NOT EXISTS applications_user_status_idx ON applications (user_id, status);
CREATE INDEX IF NOT EXISTS feedback_signals_user_created_at_idx ON feedback_signals (user_id, created_at);
CREATE INDEX IF NOT EXISTS application_sessions_user_created_at_idx ON application_sessions (user_id, created_at);
CREATE INDEX IF NOT EXISTS application_sessions_user_status_idx ON application_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS freelance_profiles_user_created_at_idx ON freelance_profiles (user_id, created_at);
CREATE INDEX IF NOT EXISTS freelance_profiles_user_active_idx ON freelance_profiles (user_id, is_active);
CREATE INDEX IF NOT EXISTS project_sources_user_created_at_idx ON project_sources (user_id, created_at);
CREATE INDEX IF NOT EXISTS freelance_projects_user_created_at_idx ON freelance_projects (user_id, created_at);
CREATE INDEX IF NOT EXISTS freelance_projects_user_status_idx ON freelance_projects (user_id, status);
CREATE INDEX IF NOT EXISTS proposal_versions_user_created_at_idx ON proposal_versions (user_id, created_at);
CREATE INDEX IF NOT EXISTS proposal_versions_user_status_idx ON proposal_versions (user_id, status);
CREATE INDEX IF NOT EXISTS proposal_outcomes_user_created_at_idx ON proposal_outcomes (user_id, created_at);
CREATE INDEX IF NOT EXISTS client_message_templates_user_created_at_idx ON client_message_templates (user_id, created_at);
CREATE INDEX IF NOT EXISTS client_message_templates_user_active_idx ON client_message_templates (user_id, is_active);
CREATE INDEX IF NOT EXISTS ai_run_evaluations_user_created_at_idx ON ai_run_evaluations (user_id, created_at);
CREATE INDEX IF NOT EXISTS ai_training_examples_user_created_at_idx ON ai_training_examples (user_id, created_at);
CREATE INDEX IF NOT EXISTS event_logs_user_created_at_idx ON event_logs (user_id, created_at);
