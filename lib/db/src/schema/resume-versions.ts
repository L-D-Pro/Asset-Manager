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

export const resumeVersionsTable = pgTable(
  "resume_versions",
  {
    id: serial("id").primaryKey(),

    jobId: integer("job_id").references(() => jobsTable.id, {
      onDelete: "cascade",
    }),

    label: text("label"),

    status: text("status").notNull().default("pending_approval"),

    tailoredBullets: jsonb("tailored_bullets").notNull().default([]),

    diffData: jsonb("diff_data"),

    claimIds: integer("claim_ids").array().notNull().default([]),

    fileUrl: text("file_url"),
    rawContent: text("raw_content"),

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("resume_versions_job_id_idx").on(table.jobId),
    index("resume_versions_status_idx").on(table.status),
  ],
);

export const insertResumeVersionSchema = createInsertSchema(
  resumeVersionsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertResumeVersion = z.infer<typeof insertResumeVersionSchema>;
export type ResumeVersion = typeof resumeVersionsTable.$inferSelect;
