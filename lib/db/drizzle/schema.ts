import { pgTable, unique, serial, text, boolean, timestamp, index, foreignKey, integer, jsonb, uniqueIndex, varchar, json } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const adminUsers = pgTable("admin_users", {
	id: serial().primaryKey().notNull(),
	username: text().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	totpSecret: text("totp_secret"),
	totpEnabled: boolean("totp_enabled").default(false).notNull(),
	totpRecoveryCodes: text("totp_recovery_codes"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("admin_users_username_unique").on(table.username),
]);

export const applications = pgTable("applications", {
	id: serial().primaryKey().notNull(),
	jobId: integer("job_id").notNull(),
	resumeVersionId: integer("resume_version_id"),
	coverLetterVersionId: integer("cover_letter_version_id"),
	status: text().default('applied').notNull(),
	applyMode: text("apply_mode").default('assisted').notNull(),
	platform: text(),
	appliedAt: timestamp("applied_at", { withTimezone: true, mode: 'string' }),
	confirmationRef: text("confirmation_ref"),
	notes: text(),
	actionLog: jsonb("action_log").default([]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("applications_job_id_idx").using("btree", table.jobId.asc().nullsLast().op("int4_ops")),
	index("applications_job_status_idx").using("btree", table.jobId.asc().nullsLast().op("int4_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("applications_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "applications_job_id_jobs_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.resumeVersionId],
			foreignColumns: [resumeVersions.id],
			name: "applications_resume_version_id_resume_versions_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.coverLetterVersionId],
			foreignColumns: [coverLetterVersions.id],
			name: "applications_cover_letter_version_id_cover_letter_versions_id_f"
		}).onDelete("set null"),
]);

export const coverLetterVersions = pgTable("cover_letter_versions", {
	id: serial().primaryKey().notNull(),
	jobId: integer("job_id"),
	label: text(),
	status: text().default('pending_approval').notNull(),
	draftContent: text("draft_content"),
	annotatedParagraphs: jsonb("annotated_paragraphs").default([]).notNull(),
	claimIds: integer("claim_ids").array().default([]).notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("cover_letter_versions_job_id_idx").using("btree", table.jobId.asc().nullsLast().op("int4_ops")),
	index("cover_letter_versions_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "cover_letter_versions_job_id_jobs_id_fk"
		}).onDelete("cascade"),
]);

export const conversations = pgTable("conversations", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const claims = pgTable("claims", {
	id: serial().primaryKey().notNull(),
	summary: text().notNull(),
	evidence: text(),
	evidenceType: text("evidence_type").default('self_attestation').notNull(),
	phrasingVariants: text("phrasing_variants").array().default([""]).notNull(),
	disallowedImplications: text("disallowed_implications").array().default([""]).notNull(),
	domain: text(),
	applicableTags: text("applicable_tags").array().default([""]).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("claims_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("claims_domain_active_idx").using("btree", table.domain.asc().nullsLast().op("text_ops"), table.isActive.asc().nullsLast().op("text_ops")),
]);

export const eventLogs = pgTable("event_logs", {
	id: serial().primaryKey().notNull(),
	entityType: text("entity_type").notNull(),
	entityId: integer("entity_id").notNull(),
	applicationId: integer("application_id"),
	jobId: integer("job_id"),
	eventType: text("event_type").notNull(),
	previousState: text("previous_state"),
	nextState: text("next_state"),
	metadata: jsonb().default({}).notNull(),
	actorType: text("actor_type").default('user').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("event_logs_application_id_idx").using("btree", table.applicationId.asc().nullsLast().op("int4_ops")),
	index("event_logs_entity_idx").using("btree", table.entityType.asc().nullsLast().op("int4_ops"), table.entityId.asc().nullsLast().op("int4_ops")),
	index("event_logs_event_type_idx").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	index("event_logs_job_id_idx").using("btree", table.jobId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.applicationId],
			foreignColumns: [applications.id],
			name: "event_logs_application_id_applications_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "event_logs_job_id_jobs_id_fk"
		}).onDelete("cascade"),
]);

export const baseResumeVersions = pgTable("base_resume_versions", {
	id: serial().primaryKey().notNull(),
	label: text(),
	contentText: text("content_text").notNull(),
	isCurrent: boolean("is_current").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("base_resume_versions_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	uniqueIndex("base_resume_versions_current_unique_idx").using("btree", table.isCurrent.asc().nullsLast().op("bool_ops")).where(sql`(is_current = true)`),
	index("base_resume_versions_is_current_idx").using("btree", table.isCurrent.asc().nullsLast().op("bool_ops")),
]);

export const aiModelConfigs = pgTable("ai_model_configs", {
	id: serial().primaryKey().notNull(),
	taskScope: text("task_scope").notNull(),
	provider: text().default('openrouter').notNull(),
	modelName: text("model_name").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	priority: integer().default(1).notNull(),
	fallbackModelId: integer("fallback_model_id"),
	costPerInputToken: text("cost_per_input_token"),
	costPerOutputToken: text("cost_per_output_token"),
	maxTokens: integer("max_tokens"),
	extraConfig: jsonb("extra_config").default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ai_model_configs_task_scope_active_idx").using("btree", table.taskScope.asc().nullsLast().op("text_ops"), table.isActive.asc().nullsLast().op("text_ops")),
	index("ai_model_configs_task_scope_idx").using("btree", table.taskScope.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.fallbackModelId],
			foreignColumns: [table.id],
			name: "ai_model_configs_fallback_model_id_ai_model_configs_id_fk"
		}).onDelete("set null"),
]);

export const roleProfiles = pgTable("role_profiles", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	hardFilters: jsonb("hard_filters").default({}).notNull(),
	softWeights: jsonb("soft_weights").default({}).notNull(),
	companyAllowList: text("company_allow_list").array().default([""]).notNull(),
	companyDenyList: text("company_deny_list").array().default([""]).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const feedbackSignals = pgTable("feedback_signals", {
	id: serial().primaryKey().notNull(),
	applicationId: integer("application_id").notNull(),
	resumeVersionId: integer("resume_version_id"),
	outcome: text().notNull(),
	signalType: text("signal_type").notNull(),
	notes: text(),
	attributionData: jsonb("attribution_data").default({}).notNull(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("feedback_signals_application_id_idx").using("btree", table.applicationId.asc().nullsLast().op("int4_ops")),
	index("feedback_signals_outcome_idx").using("btree", table.outcome.asc().nullsLast().op("text_ops")),
	index("feedback_signals_signal_type_idx").using("btree", table.signalType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.applicationId],
			foreignColumns: [applications.id],
			name: "feedback_signals_application_id_applications_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.resumeVersionId],
			foreignColumns: [resumeVersions.id],
			name: "feedback_signals_resume_version_id_resume_versions_id_fk"
		}).onDelete("set null"),
]);

export const jobs = pgTable("jobs", {
	id: serial().primaryKey().notNull(),
	roleProfileId: integer("role_profile_id"),
	title: text().notNull(),
	company: text().notNull(),
	location: text(),
	remoteType: text("remote_type"),
	salaryMin: integer("salary_min"),
	salaryMax: integer("salary_max"),
	salaryCurrency: text("salary_currency"),
	visaSponsorship: text("visa_sponsorship"),
	sourceUrl: text("source_url"),
	sourcePlatform: text("source_platform"),
	rawJdText: text("raw_jd_text"),
	parsedResponsibilities: text("parsed_responsibilities").array(),
	parsedRequiredSkills: text("parsed_required_skills").array(),
	parsedNiceToHaveSkills: text("parsed_nice_to_have_skills").array(),
	parsedKeywords: text("parsed_keywords").array(),
	parsedSenioritySignal: text("parsed_seniority_signal"),
	parsedStructuredData: jsonb("parsed_structured_data"),
	status: text().default('new').notNull(),
	deduplicationHash: text("deduplication_hash"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("jobs_dedup_hash_idx").using("btree", table.deduplicationHash.asc().nullsLast().op("text_ops")),
	index("jobs_role_profile_status_idx").using("btree", table.roleProfileId.asc().nullsLast().op("int4_ops"), table.status.asc().nullsLast().op("int4_ops")),
	index("jobs_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.roleProfileId],
			foreignColumns: [roleProfiles.id],
			name: "jobs_role_profile_id_role_profiles_id_fk"
		}).onDelete("set null"),
]);

export const resumeVersions = pgTable("resume_versions", {
	id: serial().primaryKey().notNull(),
	jobId: integer("job_id"),
	baseResumeVersionId: integer("base_resume_version_id"),
	label: text(),
	status: text().default('pending_approval').notNull(),
	tailoredDocumentText: text("tailored_document_text"),
	tailoredBullets: jsonb("tailored_bullets").default([]).notNull(),
	diffData: jsonb("diff_data"),
	claimIds: integer("claim_ids").array().default([]).notNull(),
	fileUrl: text("file_url"),
	rawContent: text("raw_content"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("resume_versions_base_resume_version_id_idx").using("btree", table.baseResumeVersionId.asc().nullsLast().op("int4_ops")),
	index("resume_versions_job_id_idx").using("btree", table.jobId.asc().nullsLast().op("int4_ops")),
	index("resume_versions_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "resume_versions_job_id_jobs_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.baseResumeVersionId],
			foreignColumns: [baseResumeVersions.id],
			name: "resume_versions_base_resume_version_id_base_resume_versions_id_"
		}).onDelete("set null"),
]);

export const messages = pgTable("messages", {
	id: serial().primaryKey().notNull(),
	conversationId: integer("conversation_id").notNull(),
	role: text().notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_conversations_id_fk"
		}).onDelete("cascade"),
]);

export const session = pgTable("session", {
	sid: varchar().primaryKey().notNull(),
	sess: json().notNull(),
	expire: timestamp({ precision: 6, mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);
