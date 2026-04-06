import { relations } from "drizzle-orm";
import { roleProfilesTable } from "./role-profiles";
import { jobsTable } from "./jobs";
import { claimsTable } from "./claims";
import { resumeVersionsTable } from "./resume-versions";
import { coverLetterVersionsTable } from "./cover-letter-versions";
import { applicationsTable } from "./applications";
import { eventLogsTable } from "./event-logs";
import { feedbackSignalsTable } from "./feedback-signals";
import { aiModelConfigsTable } from "./ai-model-configs";

export const roleProfilesRelations = relations(
  roleProfilesTable,
  ({ many }) => ({
    jobs: many(jobsTable),
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

export const eventLogsRelations = relations(eventLogsTable, ({ one }) => ({
  application: one(applicationsTable, {
    fields: [eventLogsTable.applicationId],
    references: [applicationsTable.id],
  }),
  job: one(jobsTable, {
    fields: [eventLogsTable.jobId],
    references: [jobsTable.id],
  }),
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
  }),
);

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
