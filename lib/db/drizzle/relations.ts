import { relations } from "drizzle-orm/relations";
import { jobs, applications, resumeVersions, coverLetterVersions, eventLogs, aiModelConfigs, feedbackSignals, roleProfiles, baseResumeVersions, conversations, messages } from "./schema";

export const applicationsRelations = relations(applications, ({one, many}) => ({
	job: one(jobs, {
		fields: [applications.jobId],
		references: [jobs.id]
	}),
	resumeVersion: one(resumeVersions, {
		fields: [applications.resumeVersionId],
		references: [resumeVersions.id]
	}),
	coverLetterVersion: one(coverLetterVersions, {
		fields: [applications.coverLetterVersionId],
		references: [coverLetterVersions.id]
	}),
	eventLogs: many(eventLogs),
	feedbackSignals: many(feedbackSignals),
}));

export const jobsRelations = relations(jobs, ({one, many}) => ({
	applications: many(applications),
	coverLetterVersions: many(coverLetterVersions),
	eventLogs: many(eventLogs),
	roleProfile: one(roleProfiles, {
		fields: [jobs.roleProfileId],
		references: [roleProfiles.id]
	}),
	resumeVersions: many(resumeVersions),
}));

export const resumeVersionsRelations = relations(resumeVersions, ({one, many}) => ({
	applications: many(applications),
	feedbackSignals: many(feedbackSignals),
	job: one(jobs, {
		fields: [resumeVersions.jobId],
		references: [jobs.id]
	}),
	baseResumeVersion: one(baseResumeVersions, {
		fields: [resumeVersions.baseResumeVersionId],
		references: [baseResumeVersions.id]
	}),
}));

export const coverLetterVersionsRelations = relations(coverLetterVersions, ({one, many}) => ({
	applications: many(applications),
	job: one(jobs, {
		fields: [coverLetterVersions.jobId],
		references: [jobs.id]
	}),
}));

export const eventLogsRelations = relations(eventLogs, ({one}) => ({
	application: one(applications, {
		fields: [eventLogs.applicationId],
		references: [applications.id]
	}),
	job: one(jobs, {
		fields: [eventLogs.jobId],
		references: [jobs.id]
	}),
}));

export const aiModelConfigsRelations = relations(aiModelConfigs, ({one, many}) => ({
	aiModelConfig: one(aiModelConfigs, {
		fields: [aiModelConfigs.fallbackModelId],
		references: [aiModelConfigs.id],
		relationName: "aiModelConfigs_fallbackModelId_aiModelConfigs_id"
	}),
	aiModelConfigs: many(aiModelConfigs, {
		relationName: "aiModelConfigs_fallbackModelId_aiModelConfigs_id"
	}),
}));

export const feedbackSignalsRelations = relations(feedbackSignals, ({one}) => ({
	application: one(applications, {
		fields: [feedbackSignals.applicationId],
		references: [applications.id]
	}),
	resumeVersion: one(resumeVersions, {
		fields: [feedbackSignals.resumeVersionId],
		references: [resumeVersions.id]
	}),
}));

export const roleProfilesRelations = relations(roleProfiles, ({many}) => ({
	jobs: many(jobs),
}));

export const baseResumeVersionsRelations = relations(baseResumeVersions, ({many}) => ({
	resumeVersions: many(resumeVersions),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
}));

export const conversationsRelations = relations(conversations, ({many}) => ({
	messages: many(messages),
}));