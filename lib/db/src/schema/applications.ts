import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jobsTable } from "./jobs";
import { resumeVersionsTable } from "./resume-versions";
import { coverLetterVersionsTable } from "./cover-letter-versions";

/**
 * Applications — tracks the full lifecycle of a submitted job application.
 *
 * An application links a job to the specific resume version and cover letter version
 * that were used when submitting. Status tracks progression through the hiring funnel.
 * The `actionLog` field records every action taken during assisted or auto-apply modes
 * (fields filled, attachments uploaded, confirmation receipts).
 *
 * Status lifecycle: `applied` → `screen` → `interview` → `offer` / `rejected` / `no_response`
 *
 * Apply modes:
 * - `assisted` (default): the system pre-fills fields but the user manually submits.
 * - `auto` (future Phase 2/3): selective auto-apply on whitelisted ATS flows.
 */
export const applicationsTable = pgTable(
  "applications",
  {
    /** Auto-incrementing primary key. */
    id: serial("id").primaryKey(),

    /** The job this application is for. Cascade-deletes the application if the job is deleted. */
    jobId: integer("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "cascade" }),

    /** The resume version used for this application. Set null if the version is deleted. */
    resumeVersionId: integer("resume_version_id").references(
      () => resumeVersionsTable.id,
      { onDelete: "set null" },
    ),

    /** The cover letter version used for this application. Set null if the version is deleted. */
    coverLetterVersionId: integer("cover_letter_version_id").references(
      () => coverLetterVersionsTable.id,
      { onDelete: "set null" },
    ),

    /**
     * Current pipeline status.
     * Values: `applied`, `screen`, `interview`, `offer`, `rejected`, `no_response`
     */
    status: text("status").notNull().default("applied"),

    /**
     * How the application was submitted.
     * Values: `assisted` (user submits manually), `auto` (future selective auto-apply).
     */
    applyMode: text("apply_mode").notNull().default("assisted"),

    /** ATS platform used (e.g. `greenhouse`, `lever`, `workday`). */
    platform: text("platform"),

    /** Timestamp when the application was submitted. */
    appliedAt: timestamp("applied_at", { withTimezone: true }),

    /** Confirmation reference from the ATS (e.g. application number, email subject). */
    confirmationRef: text("confirmation_ref"),

    /** Free-text notes from the user. */
    notes: text("notes"),

    /**
     * Append-only action log for assisted/auto-apply flows.
     * Each entry records what action was taken (field filled, attachment uploaded, etc.).
     */
    actionLog: jsonb("action_log").notNull().default([]),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("applications_job_id_idx").on(table.jobId),
    index("applications_status_idx").on(table.status),
    index("applications_job_status_idx").on(table.jobId, table.status),
  ],
);

/** Zod schema for inserting an application (omits server-managed fields). */
export const insertApplicationSchema = createInsertSchema(
  applicationsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/** Type for a new application insert payload. */
export type InsertApplication = z.infer<typeof insertApplicationSchema>;

/** Type for a full application row as returned from the database. */
export type Application = typeof applicationsTable.$inferSelect;
