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

export const coverLetterVersionsTable = pgTable(
  "cover_letter_versions",
  {
    id: serial("id").primaryKey(),

    jobId: integer("job_id").references(() => jobsTable.id, {
      onDelete: "cascade",
    }),

    label: text("label"),

    status: text("status").notNull().default("pending_approval"),

    draftContent: text("draft_content"),

    annotatedParagraphs: jsonb("annotated_paragraphs").notNull().default([]),

    claimIds: integer("claim_ids").array().notNull().default([]),

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
    index("cover_letter_versions_job_id_idx").on(table.jobId),
    index("cover_letter_versions_status_idx").on(table.status),
  ],
);

export const insertCoverLetterVersionSchema = createInsertSchema(
  coverLetterVersionsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCoverLetterVersion = z.infer<
  typeof insertCoverLetterVersionSchema
>;
export type CoverLetterVersion = typeof coverLetterVersionsTable.$inferSelect;
