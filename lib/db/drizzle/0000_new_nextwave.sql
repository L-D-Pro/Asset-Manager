-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"totp_recovery_codes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"resume_version_id" integer,
	"cover_letter_version_id" integer,
	"status" text DEFAULT 'applied' NOT NULL,
	"apply_mode" text DEFAULT 'assisted' NOT NULL,
	"platform" text,
	"applied_at" timestamp with time zone,
	"confirmation_ref" text,
	"notes" text,
	"action_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cover_letter_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer,
	"label" text,
	"status" text DEFAULT 'pending_approval' NOT NULL,
	"draft_content" text,
	"annotated_paragraphs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"claim_ids" integer[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"summary" text NOT NULL,
	"evidence" text,
	"evidence_type" text DEFAULT 'self_attestation' NOT NULL,
	"phrasing_variants" text[] DEFAULT '{""}' NOT NULL,
	"disallowed_implications" text[] DEFAULT '{""}' NOT NULL,
	"domain" text,
	"applicable_tags" text[] DEFAULT '{""}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"application_id" integer,
	"job_id" integer,
	"event_type" text NOT NULL,
	"previous_state" text,
	"next_state" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "base_resume_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text,
	"content_text" text NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_model_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_scope" text NOT NULL,
	"provider" text DEFAULT 'openrouter' NOT NULL,
	"model_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"fallback_model_id" integer,
	"cost_per_input_token" text,
	"cost_per_output_token" text,
	"max_tokens" integer,
	"extra_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"hard_filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"soft_weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"company_allow_list" text[] DEFAULT '{""}' NOT NULL,
	"company_deny_list" text[] DEFAULT '{""}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"resume_version_id" integer,
	"outcome" text NOT NULL,
	"signal_type" text NOT NULL,
	"notes" text,
	"attribution_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_profile_id" integer,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"location" text,
	"remote_type" text,
	"salary_min" integer,
	"salary_max" integer,
	"salary_currency" text,
	"visa_sponsorship" text,
	"source_url" text,
	"source_platform" text,
	"raw_jd_text" text,
	"parsed_responsibilities" text[],
	"parsed_required_skills" text[],
	"parsed_nice_to_have_skills" text[],
	"parsed_keywords" text[],
	"parsed_seniority_signal" text,
	"parsed_structured_data" jsonb,
	"status" text DEFAULT 'new' NOT NULL,
	"deduplication_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer,
	"base_resume_version_id" integer,
	"label" text,
	"status" text DEFAULT 'pending_approval' NOT NULL,
	"tailored_document_text" text,
	"tailored_bullets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"diff_data" jsonb,
	"claim_ids" integer[] DEFAULT '{}' NOT NULL,
	"file_url" text,
	"raw_content" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp(6) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_resume_version_id_resume_versions_id_fk" FOREIGN KEY ("resume_version_id") REFERENCES "public"."resume_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_cover_letter_version_id_cover_letter_versions_id_f" FOREIGN KEY ("cover_letter_version_id") REFERENCES "public"."cover_letter_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_letter_versions" ADD CONSTRAINT "cover_letter_versions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model_configs" ADD CONSTRAINT "ai_model_configs_fallback_model_id_ai_model_configs_id_fk" FOREIGN KEY ("fallback_model_id") REFERENCES "public"."ai_model_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_signals" ADD CONSTRAINT "feedback_signals_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_signals" ADD CONSTRAINT "feedback_signals_resume_version_id_resume_versions_id_fk" FOREIGN KEY ("resume_version_id") REFERENCES "public"."resume_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_role_profile_id_role_profiles_id_fk" FOREIGN KEY ("role_profile_id") REFERENCES "public"."role_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_base_resume_version_id_base_resume_versions_id_" FOREIGN KEY ("base_resume_version_id") REFERENCES "public"."base_resume_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_job_id_idx" ON "applications" USING btree ("job_id" int4_ops);--> statement-breakpoint
CREATE INDEX "applications_job_status_idx" ON "applications" USING btree ("job_id" int4_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "cover_letter_versions_job_id_idx" ON "cover_letter_versions" USING btree ("job_id" int4_ops);--> statement-breakpoint
CREATE INDEX "cover_letter_versions_status_idx" ON "cover_letter_versions" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "claims_active_idx" ON "claims" USING btree ("is_active" bool_ops);--> statement-breakpoint
CREATE INDEX "claims_domain_active_idx" ON "claims" USING btree ("domain" text_ops,"is_active" text_ops);--> statement-breakpoint
CREATE INDEX "event_logs_application_id_idx" ON "event_logs" USING btree ("application_id" int4_ops);--> statement-breakpoint
CREATE INDEX "event_logs_entity_idx" ON "event_logs" USING btree ("entity_type" int4_ops,"entity_id" int4_ops);--> statement-breakpoint
CREATE INDEX "event_logs_event_type_idx" ON "event_logs" USING btree ("event_type" text_ops);--> statement-breakpoint
CREATE INDEX "event_logs_job_id_idx" ON "event_logs" USING btree ("job_id" int4_ops);--> statement-breakpoint
CREATE INDEX "base_resume_versions_created_at_idx" ON "base_resume_versions" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "base_resume_versions_current_unique_idx" ON "base_resume_versions" USING btree ("is_current" bool_ops) WHERE (is_current = true);--> statement-breakpoint
CREATE INDEX "base_resume_versions_is_current_idx" ON "base_resume_versions" USING btree ("is_current" bool_ops);--> statement-breakpoint
CREATE INDEX "ai_model_configs_task_scope_active_idx" ON "ai_model_configs" USING btree ("task_scope" text_ops,"is_active" text_ops);--> statement-breakpoint
CREATE INDEX "ai_model_configs_task_scope_idx" ON "ai_model_configs" USING btree ("task_scope" text_ops);--> statement-breakpoint
CREATE INDEX "feedback_signals_application_id_idx" ON "feedback_signals" USING btree ("application_id" int4_ops);--> statement-breakpoint
CREATE INDEX "feedback_signals_outcome_idx" ON "feedback_signals" USING btree ("outcome" text_ops);--> statement-breakpoint
CREATE INDEX "feedback_signals_signal_type_idx" ON "feedback_signals" USING btree ("signal_type" text_ops);--> statement-breakpoint
CREATE INDEX "jobs_dedup_hash_idx" ON "jobs" USING btree ("deduplication_hash" text_ops);--> statement-breakpoint
CREATE INDEX "jobs_role_profile_status_idx" ON "jobs" USING btree ("role_profile_id" int4_ops,"status" int4_ops);--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "resume_versions_base_resume_version_id_idx" ON "resume_versions" USING btree ("base_resume_version_id" int4_ops);--> statement-breakpoint
CREATE INDEX "resume_versions_job_id_idx" ON "resume_versions" USING btree ("job_id" int4_ops);--> statement-breakpoint
CREATE INDEX "resume_versions_status_idx" ON "resume_versions" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" USING btree ("expire" timestamp_ops);
*/