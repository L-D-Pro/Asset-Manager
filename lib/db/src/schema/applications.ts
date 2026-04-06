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

export const applicationsTable = pgTable(
  "applications",
  {
    id: serial("id").primaryKey(),

    jobId: integer("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "cascade" }),

    resumeVersionId: integer("resume_version_id").references(
      () => resumeVersionsTable.id,
      { onDelete: "set null" },
    ),

    coverLetterVersionId: integer("cover_letter_version_id").references(
      () => coverLetterVersionsTable.id,
      { onDelete: "set null" },
    ),

    status: text("status").notNull().default("applied"),

    applyMode: text("apply_mode").notNull().default("assisted"),

    platform: text("platform"),

    appliedAt: timestamp("applied_at", { withTimezone: true }),

    confirmationRef: text("confirmation_ref"),

    notes: text("notes"),

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

export const insertApplicationSchema = createInsertSchema(
  applicationsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applicationsTable.$inferSelect;
