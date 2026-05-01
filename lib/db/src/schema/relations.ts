import { relations } from "drizzle-orm";
import { roleProfilesTable } from "./role-profiles";
import { baseResumeVersionsTable } from "./base-resume-versions";
import { jobsTable } from "./jobs";
import { claimsTable } from "./claims";
import { resumeVersionsTable } from "./resume-versions";
import { coverLetterVersionsTable } from "./cover-letter-versions";
import { applicationsTable } from "./applications";
import { eventLogsTable } from "./event-logs";
import { feedbackSignalsTable } from "./feedback-signals";
import { aiModelConfigsTable } from "./ai-model-configs";
import { aiRunEvaluationsTable } from "./ai-run-evaluations";
import { aiPromptVersionsTable } from "./ai-prompt-versions";

export const roleProfilesRelations = relations(
  roleProfilesTable,
  ({ many }) => ({
    jobs: many(jobsTable),
  }),
);

export const baseResumeVersionsRelations = relations(
  baseResumeVersionsTable,
  ({ many }) => ({
    resumeVersions: many(resumeVersionsTable),
  }),
);

export const jobsRelations = relations(jobsTable, ({ one, many }) => ({
  roleProfile: one(roleProfilesTable, {
    fields: [jobsTable.roleProfileId],
    references: [roleProfilesTable.id],
  }),
  resumeVersions: many(resumeVersionsTable),
  coverLetterVersions: many(coverLetterVersionsTable),
  applications: many(applicationsTable),
  eventLogs: many(eventLogsTable),
}));

export const claimsRelations = relations(claimsTable, () => ({}));

export const resumeVersionsRelations = relations(
  resumeVersionsTable,
  ({ one, many }) => ({
    job: one(jobsTable, {
      fields: [resumeVersionsTable.jobId],
      references: [jobsTable.id],
    }),
    baseResumeVersion: one(baseResumeVersionsTable, {
      fields: [resumeVersionsTable.baseResumeVersionId],
      references: [baseResumeVersionsTable.id],
    }),
    lineageEventLog: one(eventLogsTable, {
      fields: [resumeVersionsTable.eventLogId],
      references: [eventLogsTable.id],
      relationName: "resume_version_lineage_event",
    }),
    applications: many(applicationsTable),
    feedbackSignals: many(feedbackSignalsTable),
  }),
);

export const coverLetterVersionsRelations = relations(
  coverLetterVersionsTable,
  ({ one, many }) => ({
    job: one(jobsTable, {
      fields: [coverLetterVersionsTable.jobId],
      references: [jobsTable.id],
    }),
    lineageEventLog: one(eventLogsTable, {
      fields: [coverLetterVersionsTable.eventLogId],
      references: [eventLogsTable.id],
      relationName: "cover_letter_version_lineage_event",
    }),
    applications: many(applicationsTable),
  }),
);

export const applicationsRelations = relations(
  applicationsTable,
  ({ one, many }) => ({
    job: one(jobsTable, {
      fields: [applicationsTable.jobId],
      references: [jobsTable.id],
    }),
    resumeVersion: one(resumeVersionsTable, {
      fields: [applicationsTable.resumeVersionId],
      references: [resumeVersionsTable.id],
    }),
    coverLetterVersion: one(coverLetterVersionsTable, {
      fields: [applicationsTable.coverLetterVersionId],
      references: [coverLetterVersionsTable.id],
    }),
    eventLogs: many(eventLogsTable),
    feedbackSignals: many(feedbackSignalsTable),
  }),
);

export const eventLogsRelations = relations(eventLogsTable, ({ one, many }) => ({
  application: one(applicationsTable, {
    fields: [eventLogsTable.applicationId],
    references: [applicationsTable.id],
  }),
  job: one(jobsTable, {
    fields: [eventLogsTable.jobId],
    references: [jobsTable.id],
  }),
  resumeVersions: many(resumeVersionsTable, {
    relationName: "resume_version_lineage_event",
  }),
  coverLetterVersions: many(coverLetterVersionsTable, {
    relationName: "cover_letter_version_lineage_event",
  }),
  aiRunEvaluations: many(aiRunEvaluationsTable),
  feedbackSignals: many(feedbackSignalsTable),
}));

export const feedbackSignalsRelations = relations(
  feedbackSignalsTable,
  ({ one }) => ({
    application: one(applicationsTable, {
      fields: [feedbackSignalsTable.applicationId],
      references: [applicationsTable.id],
    }),
    resumeVersion: one(resumeVersionsTable, {
      fields: [feedbackSignalsTable.resumeVersionId],
      references: [resumeVersionsTable.id],
    }),
    lineageEventLog: one(eventLogsTable, {
      fields: [feedbackSignalsTable.eventLogId],
      references: [eventLogsTable.id],
    }),
  }),
);

export const aiRunEvaluationsRelations = relations(
  aiRunEvaluationsTable,
  ({ one }) => ({
    lineageEventLog: one(eventLogsTable, {
      fields: [aiRunEvaluationsTable.eventLogId],
      references: [eventLogsTable.id],
    }),
    promptVersion: one(aiPromptVersionsTable, {
      fields: [aiRunEvaluationsTable.promptVersionId],
      references: [aiPromptVersionsTable.id],
    }),
  }),
);

import { wizardSessionsTable } from "./wizard-sessions";

export const wizardSessionsRelations = relations(
  wizardSessionsTable,
  ({ one }) => ({
    job: one(jobsTable, {
      fields: [wizardSessionsTable.jobId],
      references: [jobsTable.id],
    }),
  }),
);

import { adminUsersTable } from "./admin-users";
import { userOnboardingStateTable } from "./user-onboarding";
import { userStatsTable } from "./gamification";
import { xpLogTable } from "./gamification";

export const userStatsRelations = relations(userStatsTable, ({ one }) => ({
  user: one(adminUsersTable, { fields: [userStatsTable.userId], references: [adminUsersTable.id] }),
}));

export const xpLogRelations = relations(xpLogTable, ({ one }) => ({
  user: one(adminUsersTable, { fields: [xpLogTable.userId], references: [adminUsersTable.id] }),
}));

export const adminUsersRelations = relations(adminUsersTable, ({ one }) => ({
  onboardingState: one(userOnboardingStateTable, {
    fields: [adminUsersTable.id],
    references: [userOnboardingStateTable.userId],
  }),
}));

export const aiModelConfigsRelations = relations(
  aiModelConfigsTable,
  ({ one, many }) => ({
    fallbackModel: one(aiModelConfigsTable, {
      fields: [aiModelConfigsTable.fallbackModelId],
      references: [aiModelConfigsTable.id],
      relationName: "fallback",
    }),
    fallbackDependents: many(aiModelConfigsTable, {
      relationName: "fallback",
    }),
  }),
);
