import {
  pgTable,
  text,
  serial,
  timestamp,
  jsonb,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { roleProfilesTable } from "./role-profiles";

export const jobsTable = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),

    roleProfileId: integer("role_profile_id").references(
      () => roleProfilesTable.id,
      { onDelete: "set null" },
    ),

    title: text("title").notNull(),
    company: text("company").notNull(),
    location: text("location"),
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

    status: text("status").notNull().default("new"),

    deduplicationHash: text("deduplication_hash"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("jobs_role_profile_status_idx").on(table.roleProfileId, table.status),
    index("jobs_dedup_hash_idx").on(table.deduplicationHash),
    index("jobs_status_idx").on(table.status),
  ],
);

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
