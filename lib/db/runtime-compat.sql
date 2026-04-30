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

-- Job board tables (runtime compat)
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
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trends_cache_job_title_idx ON trends_cache(job_title);
CREATE INDEX IF NOT EXISTS trends_cache_expires_idx ON trends_cache(expires_at);
