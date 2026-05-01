CREATE TABLE IF NOT EXISTS ai_prompt_versions (
    id SERIAL PRIMARY KEY,
    task_scope TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    label TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    user_prompt_template TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_prompt_versions_task_scope_idx ON ai_prompt_versions(task_scope);
CREATE INDEX IF NOT EXISTS ai_prompt_versions_active_idx ON ai_prompt_versions(task_scope, is_active);

CREATE TABLE IF NOT EXISTS ai_run_evaluations (
    id SERIAL PRIMARY KEY,
    event_log_id INTEGER REFERENCES event_logs(id) ON DELETE SET NULL,
    run_id TEXT,
    prompt_version_id INTEGER REFERENCES ai_prompt_versions(id) ON DELETE SET NULL,
    task_scope TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    truthfulness_score INTEGER,
    relevance_score INTEGER,
    formatting_score INTEGER,
    attribution_score INTEGER,
    approval_outcome TEXT,
    edit_distance INTEGER,
    downstream_outcome TEXT,
    evaluator_type TEXT NOT NULL DEFAULT 'user',
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS event_log_id INTEGER;
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS run_id TEXT;
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS prompt_version_id INTEGER;
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS task_scope TEXT;
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS entity_id INTEGER;
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS truthfulness_score INTEGER;
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS relevance_score INTEGER;
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS formatting_score INTEGER;
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS attribution_score INTEGER;
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS approval_outcome TEXT;
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS edit_distance INTEGER;
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS downstream_outcome TEXT;
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS evaluator_type TEXT NOT NULL DEFAULT 'user';
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE ai_run_evaluations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS ai_run_evaluations_task_scope_idx ON ai_run_evaluations(task_scope);
CREATE INDEX IF NOT EXISTS ai_run_evaluations_event_log_id_idx ON ai_run_evaluations(event_log_id);
CREATE INDEX IF NOT EXISTS ai_run_evaluations_run_id_idx ON ai_run_evaluations(run_id);
CREATE INDEX IF NOT EXISTS ai_run_evaluations_entity_idx ON ai_run_evaluations(entity_type, entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS ai_run_evaluations_run_scope_entity_uidx ON ai_run_evaluations(run_id, task_scope, entity_type, entity_id);

ALTER TABLE event_logs ADD COLUMN IF NOT EXISTS run_id TEXT;
CREATE INDEX IF NOT EXISTS event_logs_run_id_idx ON event_logs(run_id);

ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS run_id TEXT;
ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS event_log_id INTEGER;
CREATE INDEX IF NOT EXISTS resume_versions_run_id_idx ON resume_versions(run_id);
CREATE INDEX IF NOT EXISTS resume_versions_event_log_id_idx ON resume_versions(event_log_id);

ALTER TABLE cover_letter_versions ADD COLUMN IF NOT EXISTS run_id TEXT;
ALTER TABLE cover_letter_versions ADD COLUMN IF NOT EXISTS event_log_id INTEGER;
CREATE INDEX IF NOT EXISTS cover_letter_versions_run_id_idx ON cover_letter_versions(run_id);
CREATE INDEX IF NOT EXISTS cover_letter_versions_event_log_id_idx ON cover_letter_versions(event_log_id);

ALTER TABLE feedback_signals ADD COLUMN IF NOT EXISTS job_id INTEGER;
ALTER TABLE feedback_signals ADD COLUMN IF NOT EXISTS role_profile_id INTEGER;
ALTER TABLE feedback_signals ADD COLUMN IF NOT EXISTS base_resume_version_id INTEGER;
ALTER TABLE feedback_signals ADD COLUMN IF NOT EXISTS cover_letter_version_id INTEGER;
ALTER TABLE feedback_signals ADD COLUMN IF NOT EXISTS prompt_version_id INTEGER;
ALTER TABLE feedback_signals ADD COLUMN IF NOT EXISTS model_name TEXT;
ALTER TABLE feedback_signals ADD COLUMN IF NOT EXISTS selected_claim_ids INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE feedback_signals ADD COLUMN IF NOT EXISTS final_result TEXT;
ALTER TABLE feedback_signals ADD COLUMN IF NOT EXISTS run_id TEXT;
ALTER TABLE feedback_signals ADD COLUMN IF NOT EXISTS event_log_id INTEGER;
CREATE INDEX IF NOT EXISTS feedback_signals_job_id_idx ON feedback_signals(job_id);
CREATE INDEX IF NOT EXISTS feedback_signals_event_log_id_idx ON feedback_signals(event_log_id);
CREATE INDEX IF NOT EXISTS feedback_signals_run_id_idx ON feedback_signals(run_id);

CREATE TABLE IF NOT EXISTS site_adapters (
    id SERIAL PRIMARY KEY,
    platform TEXT NOT NULL,
    label TEXT NOT NULL,
    adapter_type TEXT NOT NULL DEFAULT 'assist_only',
    allowed_automation_level TEXT NOT NULL DEFAULT 'assist_only',
    is_active BOOLEAN NOT NULL DEFAULT true,
    requires_human_final_submit BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE site_adapters ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE site_adapters ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE site_adapters ADD COLUMN IF NOT EXISTS adapter_type TEXT NOT NULL DEFAULT 'assist_only';
ALTER TABLE site_adapters ADD COLUMN IF NOT EXISTS allowed_automation_level TEXT NOT NULL DEFAULT 'assist_only';
ALTER TABLE site_adapters ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE site_adapters ADD COLUMN IF NOT EXISTS requires_human_final_submit BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE site_adapters ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE site_adapters ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE site_adapters ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE site_adapters ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS site_adapters_platform_idx ON site_adapters(platform);
CREATE INDEX IF NOT EXISTS site_adapters_active_idx ON site_adapters(is_active);

CREATE TABLE IF NOT EXISTS application_sessions (
    id SERIAL PRIMARY KEY,
    application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    site_adapter_id INTEGER REFERENCES site_adapters(id) ON DELETE SET NULL,
    platform TEXT NOT NULL,
    target_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    human_checkpoint TEXT,
    current_step TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE application_sessions ADD COLUMN IF NOT EXISTS application_id INTEGER;
ALTER TABLE application_sessions ADD COLUMN IF NOT EXISTS job_id INTEGER;
ALTER TABLE application_sessions ADD COLUMN IF NOT EXISTS site_adapter_id INTEGER;
ALTER TABLE application_sessions ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE application_sessions ADD COLUMN IF NOT EXISTS target_url TEXT;
ALTER TABLE application_sessions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE application_sessions ADD COLUMN IF NOT EXISTS human_checkpoint TEXT;
ALTER TABLE application_sessions ADD COLUMN IF NOT EXISTS current_step TEXT;
ALTER TABLE application_sessions ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE application_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE application_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS application_sessions_application_id_idx ON application_sessions(application_id);
CREATE INDEX IF NOT EXISTS application_sessions_job_id_idx ON application_sessions(job_id);
CREATE INDEX IF NOT EXISTS application_sessions_platform_idx ON application_sessions(platform);
CREATE INDEX IF NOT EXISTS application_sessions_status_idx ON application_sessions(status);

CREATE TABLE IF NOT EXISTS application_form_fields (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES application_sessions(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    label TEXT,
    field_type TEXT NOT NULL DEFAULT 'text',
    detected_value TEXT,
    suggested_value TEXT,
    approved_value TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    is_sensitive BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE application_form_fields ADD COLUMN IF NOT EXISTS session_id INTEGER;
ALTER TABLE application_form_fields ADD COLUMN IF NOT EXISTS field_key TEXT;
ALTER TABLE application_form_fields ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE application_form_fields ADD COLUMN IF NOT EXISTS field_type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE application_form_fields ADD COLUMN IF NOT EXISTS detected_value TEXT;
ALTER TABLE application_form_fields ADD COLUMN IF NOT EXISTS suggested_value TEXT;
ALTER TABLE application_form_fields ADD COLUMN IF NOT EXISTS approved_value TEXT;
ALTER TABLE application_form_fields ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE application_form_fields ADD COLUMN IF NOT EXISTS is_sensitive BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE application_form_fields ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE application_form_fields ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE application_form_fields ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS application_form_fields_session_id_idx ON application_form_fields(session_id);
CREATE INDEX IF NOT EXISTS application_form_fields_status_idx ON application_form_fields(status);

CREATE TABLE IF NOT EXISTS application_actions (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES application_sessions(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'logged',
    requires_human_approval BOOLEAN NOT NULL DEFAULT true,
    summary TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE application_actions ADD COLUMN IF NOT EXISTS session_id INTEGER;
ALTER TABLE application_actions ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE application_actions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'logged';
ALTER TABLE application_actions ADD COLUMN IF NOT EXISTS requires_human_approval BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE application_actions ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE application_actions ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE application_actions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE application_actions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS application_actions_session_id_idx ON application_actions(session_id);
CREATE INDEX IF NOT EXISTS application_actions_status_idx ON application_actions(status);

CREATE TABLE IF NOT EXISTS freelance_profiles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contractor_resume_text TEXT NOT NULL DEFAULT '',
    portfolio_projects JSONB NOT NULL DEFAULT '[]'::jsonb,
    skills TEXT[] NOT NULL DEFAULT '{}',
    case_studies JSONB NOT NULL DEFAULT '[]'::jsonb,
    hourly_rate_min NUMERIC(10,2),
    hourly_rate_target NUMERIC(10,2),
    availability TEXT,
    preferred_project_types TEXT[] NOT NULL DEFAULT '{}',
    disallowed_claims TEXT[] NOT NULL DEFAULT '{}',
    proof_links JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE freelance_profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE freelance_profiles ADD COLUMN IF NOT EXISTS contractor_resume_text TEXT NOT NULL DEFAULT '';
ALTER TABLE freelance_profiles ADD COLUMN IF NOT EXISTS portfolio_projects JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE freelance_profiles ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE freelance_profiles ADD COLUMN IF NOT EXISTS case_studies JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE freelance_profiles ADD COLUMN IF NOT EXISTS hourly_rate_min NUMERIC(10,2);
ALTER TABLE freelance_profiles ADD COLUMN IF NOT EXISTS hourly_rate_target NUMERIC(10,2);
ALTER TABLE freelance_profiles ADD COLUMN IF NOT EXISTS availability TEXT;
ALTER TABLE freelance_profiles ADD COLUMN IF NOT EXISTS preferred_project_types TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE freelance_profiles ADD COLUMN IF NOT EXISTS disallowed_claims TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE freelance_profiles ADD COLUMN IF NOT EXISTS proof_links JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE freelance_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE freelance_profiles ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE freelance_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE freelance_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS freelance_profiles_active_idx ON freelance_profiles(is_active);
CREATE INDEX IF NOT EXISTS freelance_profiles_name_idx ON freelance_profiles(name);

CREATE TABLE IF NOT EXISTS project_sources (
    id SERIAL PRIMARY KEY,
    platform TEXT NOT NULL DEFAULT 'upwork',
    source_type TEXT NOT NULL DEFAULT 'manual',
    source_url TEXT,
    title TEXT,
    raw_text TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE project_sources ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'upwork';
ALTER TABLE project_sources ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE project_sources ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE project_sources ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE project_sources ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE project_sources ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE project_sources ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE project_sources ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS project_sources_platform_idx ON project_sources(platform);
CREATE INDEX IF NOT EXISTS project_sources_source_type_idx ON project_sources(source_type);

CREATE TABLE IF NOT EXISTS freelance_projects (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES freelance_profiles(id) ON DELETE SET NULL,
    source_id INTEGER REFERENCES project_sources(id) ON DELETE SET NULL,
    platform TEXT NOT NULL DEFAULT 'upwork',
    title TEXT NOT NULL,
    client_name TEXT,
    project_url TEXT,
    description_text TEXT NOT NULL,
    budget_type TEXT,
    budget_min NUMERIC(10,2),
    budget_max NUMERIC(10,2),
    hourly_min NUMERIC(10,2),
    hourly_max NUMERIC(10,2),
    required_skills TEXT[] NOT NULL DEFAULT '{}',
    client_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    fit_score INTEGER,
    risk_flags TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'new',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS profile_id INTEGER;
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS source_id INTEGER;
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'upwork';
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS project_url TEXT;
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS description_text TEXT;
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS budget_type TEXT;
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS budget_min NUMERIC(10,2);
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS budget_max NUMERIC(10,2);
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS hourly_min NUMERIC(10,2);
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS hourly_max NUMERIC(10,2);
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS required_skills TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS client_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS fit_score INTEGER;
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS risk_flags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE freelance_projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS freelance_projects_profile_id_idx ON freelance_projects(profile_id);
CREATE INDEX IF NOT EXISTS freelance_projects_platform_idx ON freelance_projects(platform);
CREATE INDEX IF NOT EXISTS freelance_projects_status_idx ON freelance_projects(status);
CREATE INDEX IF NOT EXISTS freelance_projects_fit_score_idx ON freelance_projects(fit_score);

CREATE TABLE IF NOT EXISTS proposal_versions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES freelance_projects(id) ON DELETE CASCADE,
    profile_id INTEGER REFERENCES freelance_profiles(id) ON DELETE SET NULL,
    label TEXT,
    status TEXT NOT NULL DEFAULT 'pending_approval',
    proposal_text TEXT NOT NULL DEFAULT '',
    client_message_text TEXT,
    bid_amount NUMERIC(10,2),
    bid_type TEXT,
    milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
    cited_proof JSONB NOT NULL DEFAULT '[]'::jsonb,
    risk_notes TEXT,
    raw_content TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE proposal_versions ADD COLUMN IF NOT EXISTS project_id INTEGER;
ALTER TABLE proposal_versions ADD COLUMN IF NOT EXISTS profile_id INTEGER;
ALTER TABLE proposal_versions ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE proposal_versions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_approval';
ALTER TABLE proposal_versions ADD COLUMN IF NOT EXISTS proposal_text TEXT NOT NULL DEFAULT '';
ALTER TABLE proposal_versions ADD COLUMN IF NOT EXISTS client_message_text TEXT;
ALTER TABLE proposal_versions ADD COLUMN IF NOT EXISTS bid_amount NUMERIC(10,2);
ALTER TABLE proposal_versions ADD COLUMN IF NOT EXISTS bid_type TEXT;
ALTER TABLE proposal_versions ADD COLUMN IF NOT EXISTS milestones JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE proposal_versions ADD COLUMN IF NOT EXISTS cited_proof JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE proposal_versions ADD COLUMN IF NOT EXISTS risk_notes TEXT;
ALTER TABLE proposal_versions ADD COLUMN IF NOT EXISTS raw_content TEXT;
ALTER TABLE proposal_versions ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE proposal_versions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE proposal_versions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS proposal_versions_project_id_idx ON proposal_versions(project_id);
CREATE INDEX IF NOT EXISTS proposal_versions_profile_id_idx ON proposal_versions(profile_id);
CREATE INDEX IF NOT EXISTS proposal_versions_status_idx ON proposal_versions(status);

CREATE TABLE IF NOT EXISTS proposal_outcomes (
    id SERIAL PRIMARY KEY,
    proposal_version_id INTEGER REFERENCES proposal_versions(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES freelance_projects(id) ON DELETE CASCADE,
    outcome TEXT NOT NULL,
    actual_earnings NUMERIC(10,2),
    client_quality INTEGER,
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE proposal_outcomes ADD COLUMN IF NOT EXISTS proposal_version_id INTEGER;
ALTER TABLE proposal_outcomes ADD COLUMN IF NOT EXISTS project_id INTEGER;
ALTER TABLE proposal_outcomes ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE proposal_outcomes ADD COLUMN IF NOT EXISTS actual_earnings NUMERIC(10,2);
ALTER TABLE proposal_outcomes ADD COLUMN IF NOT EXISTS client_quality INTEGER;
ALTER TABLE proposal_outcomes ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE proposal_outcomes ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE proposal_outcomes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE proposal_outcomes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS research_data JSONB;

CREATE INDEX IF NOT EXISTS proposal_outcomes_project_id_idx ON proposal_outcomes(project_id);
CREATE INDEX IF NOT EXISTS proposal_outcomes_outcome_idx ON proposal_outcomes(outcome);

CREATE TABLE IF NOT EXISTS client_message_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    template_text TEXT NOT NULL,
    use_case TEXT NOT NULL DEFAULT 'proposal',
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE client_message_templates ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE client_message_templates ADD COLUMN IF NOT EXISTS template_text TEXT;
ALTER TABLE client_message_templates ADD COLUMN IF NOT EXISTS use_case TEXT NOT NULL DEFAULT 'proposal';
ALTER TABLE client_message_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE client_message_templates ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE client_message_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE client_message_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS client_message_templates_use_case_idx ON client_message_templates(use_case);
CREATE INDEX IF NOT EXISTS client_message_templates_active_idx ON client_message_templates(is_active);

-- AI Training Examples table (needed for AI Review page)
CREATE TABLE IF NOT EXISTS ai_training_examples (
    id SERIAL PRIMARY KEY,
    task_scope TEXT NOT NULL,
    source_entity_type TEXT,
    source_entity_id INTEGER,
    evaluation_id INTEGER,
    input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    approved_output TEXT NOT NULL,
    rejected_output TEXT,
    notes TEXT,
    quality_score INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_training_examples_task_scope_idx ON ai_training_examples(task_scope);
CREATE INDEX IF NOT EXISTS ai_training_examples_source_idx ON ai_training_examples(source_entity_type, source_entity_id);
CREATE INDEX IF NOT EXISTS ai_training_examples_active_idx ON ai_training_examples(task_scope, is_active);

-- Wizard Sessions (Apply Wizard save/resume)
CREATE TABLE IF NOT EXISTS wizard_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
    current_step TEXT NOT NULL DEFAULT 'intake',
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wizard_sessions_user_id_idx ON wizard_sessions(user_id);
CREATE INDEX IF NOT EXISTS wizard_sessions_job_id_idx ON wizard_sessions(job_id);

-- Phase 1: Auth & Registration Upgrade
-- Extend admin_users with email verification, password reset, pilot, and UTM fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'email_verified') THEN
    ALTER TABLE admin_users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'email_confirmation_token') THEN
    ALTER TABLE admin_users ADD COLUMN email_confirmation_token TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'email_confirmation_expires') THEN
    ALTER TABLE admin_users ADD COLUMN email_confirmation_expires TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'password_reset_token') THEN
    ALTER TABLE admin_users ADD COLUMN password_reset_token TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'password_reset_expires') THEN
    ALTER TABLE admin_users ADD COLUMN password_reset_expires TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'is_pilot_participant') THEN
    ALTER TABLE admin_users ADD COLUMN is_pilot_participant BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'pilot_enrollment_type') THEN
    ALTER TABLE admin_users ADD COLUMN pilot_enrollment_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'pilot_terms_accepted_at') THEN
    ALTER TABLE admin_users ADD COLUMN pilot_terms_accepted_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'utm_source') THEN
    ALTER TABLE admin_users ADD COLUMN utm_source TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'utm_medium') THEN
    ALTER TABLE admin_users ADD COLUMN utm_medium TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'utm_campaign') THEN
    ALTER TABLE admin_users ADD COLUMN utm_campaign TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'is_active') THEN
    ALTER TABLE admin_users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- Invite Codes table
CREATE TABLE IF NOT EXISTS invite_codes (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    max_uses INTEGER NOT NULL DEFAULT 1,
    used_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by_admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invite_codes_code_idx ON invite_codes(code);
CREATE INDEX IF NOT EXISTS invite_codes_active_idx ON invite_codes(is_active);

-- User Usage Limits table (weekly quota)
CREATE TABLE IF NOT EXISTS user_usage_limits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES admin_users(id) ON DELETE CASCADE,
    weekly_limit INTEGER NOT NULL DEFAULT 5,
    weekly_used INTEGER NOT NULL DEFAULT 0,
    total_used INTEGER NOT NULL DEFAULT 0,
    period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_usage_limits_user_id_idx ON user_usage_limits(user_id);

-- Waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    linkedin_url TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Job Board tables (trends & market research)
CREATE TABLE IF NOT EXISTS job_sources (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    feed_url TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'rss',
    category TEXT DEFAULT 'general',
    keywords TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_fetched_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_sources_category_idx ON job_sources(category);
CREATE INDEX IF NOT EXISTS job_sources_active_idx ON job_sources(is_active);

CREATE TABLE IF NOT EXISTS job_listings (
    id SERIAL PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES job_sources(id) ON DELETE CASCADE,
    source_key TEXT NOT NULL,
    source_item_id TEXT NOT NULL,
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT,
    summary TEXT,
    tags TEXT[] DEFAULT '{}',
    job_type TEXT,
    workplace_type TEXT,
    published_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_key, source_item_id)
);

CREATE INDEX IF NOT EXISTS job_listings_source_id_idx ON job_listings(source_id);
CREATE INDEX IF NOT EXISTS job_listings_active_idx ON job_listings(is_active);
CREATE INDEX IF NOT EXISTS job_listings_published_idx ON job_listings(published_at);

CREATE TABLE IF NOT EXISTS trends_cache (
    id SERIAL PRIMARY KEY,
    query_hash TEXT NOT NULL UNIQUE,
    job_title TEXT NOT NULL,
    location TEXT,
    experience_level TEXT,
    salary_target INTEGER,
    analysis_json JSONB NOT NULL,
    job_matches_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS trends_cache_job_title_idx ON trends_cache(job_title);
CREATE INDEX IF NOT EXISTS trends_cache_expires_idx ON trends_cache(expires_at);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    page_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- UI shell orchestration config (theme + layout metadata)
CREATE TABLE IF NOT EXISTS ui_shell_configs (
    id SERIAL PRIMARY KEY,
    app_key TEXT NOT NULL UNIQUE,
    theme_id TEXT NOT NULL,
    theme_definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
    ui_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by_admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ui_shell_configs_app_key_unique
    ON ui_shell_configs(app_key);

ALTER TABLE ui_shell_configs ADD COLUMN IF NOT EXISTS theme_id TEXT;
ALTER TABLE ui_shell_configs ADD COLUMN IF NOT EXISTS theme_definitions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE ui_shell_configs ADD COLUMN IF NOT EXISTS ui_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE ui_shell_configs ADD COLUMN IF NOT EXISTS updated_by_admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL;

-- Gamification: user_stats
CREATE TABLE IF NOT EXISTS user_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES admin_users(id) ON DELETE CASCADE,
    total_xp INTEGER NOT NULL DEFAULT 0,
    current_level INTEGER NOT NULL DEFAULT 1,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_activity_date DATE,
    quests_completed INTEGER NOT NULL DEFAULT 0,
    achievements_unlocked INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gamification: xp_log
CREATE TABLE IF NOT EXISTS xp_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    xp_amount INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS xp_log_user_idx ON xp_log(user_id);
CREATE INDEX IF NOT EXISTS xp_log_action_idx ON xp_log(action_type);

-- Gamification: achievements
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_name TEXT NOT NULL DEFAULT 'trophy',
    xp_reward INTEGER NOT NULL DEFAULT 0,
    criteria_type TEXT NOT NULL,
    criteria_value INTEGER NOT NULL,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gamification: user_achievements
CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    seen BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS user_achievement_uidx ON user_achievements(user_id, achievement_id);

-- Gamification: quests
CREATE TABLE IF NOT EXISTS quests (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    xp_reward INTEGER NOT NULL DEFAULT 25,
    frequency TEXT NOT NULL DEFAULT 'one_time',
    criteria_type TEXT NOT NULL,
    criteria_value INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gamification: user_quests
CREATE TABLE IF NOT EXISTS user_quests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    progress INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Gamification: streak_log
CREATE TABLE IF NOT EXISTS streak_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    xp_earned_today INTEGER NOT NULL DEFAULT 0,
    actions_count INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS streak_log_user_date_uidx ON streak_log(user_id, date);
