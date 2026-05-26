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
import { adminUsersTable } from "./admin-users";

/**
 * Jobs — ingested job postings.
 *
 * A job is created by the user (manually or via future ingestion integrations).
 * After creation, the JD parse pipeline can be triggered to extract structured
 * data from the raw job description text (skills, responsibilities, salary, etc.).
 *
 * Jobs are scored against role profiles on demand via `GET /api/jobs/:id/score`.
 * Deduplication is done via `deduplicationHash` (hash of title + company + sourceUrl).
 *
 * Status lifecycle: `new` → `scored` (after JD parse) → `applied` / `parse_failed`
 */
export const jobsTable = pgTable(
  "jobs",
  {
    /** Auto-incrementing primary key. */
    id: serial("id").primaryKey(),

    userId: integer("user_id")
      .notNull()
      .references(() => adminUsersTable.id, { onDelete: "cascade" }),

    /**
     * The role profile this job was ingested against. Used as the default scoring profile
     * when `roleProfileId` is not overridden in the score request. Nullable (set null on profile delete).
     */
    roleProfileId: integer("role_profile_id").references(
      () => roleProfilesTable.id,
      { onDelete: "set null" },
    ),

    /** Job title as listed in the posting. */
    title: text("title").notNull(),

    /** Company name. */
    company: text("company").notNull(),

    /** City/country string (e.g. "San Francisco, CA" or "Remote"). */
    location: text("location"),

    /** Work arrangement. Values: `remote`, `hybrid`, `onsite`. */
    remoteType: text("remote_type"),

    /** Minimum salary in `salaryCurrency`. */
    salaryMin: integer("salary_min"),

    /** Maximum salary in `salaryCurrency`. */
    salaryMax: integer("salary_max"),

    /** ISO currency code (e.g. `USD`, `GBP`, `EUR`). */
    salaryCurrency: text("salary_currency"),

    /** Visa sponsorship availability. Values: `yes`, `no`, `unknown`. */
    visaSponsorship: text("visa_sponsorship"),

    /** Original job posting URL. */
    sourceUrl: text("source_url"),

    /** Originating platform (e.g. `linkedin`, `greenhouse`, `lever`). */
    sourcePlatform: text("source_platform"),

    /** Full raw text of the job description, used as input to the JD parse pipeline. */
    rawJdText: text("raw_jd_text"),

    /** Extracted by the JD parse AI pipeline. Null until parse is run. */
    parsedResponsibilities: text("parsed_responsibilities").array(),

    /** Required skills extracted by the JD parse pipeline. */
    parsedRequiredSkills: text("parsed_required_skills").array(),

    /** Nice-to-have skills extracted by the JD parse pipeline. */
    parsedNiceToHaveSkills: text("parsed_nice_to_have_skills").array(),

    /** General keywords from the JD (technologies, methodologies, etc.). */
    parsedKeywords: text("parsed_keywords").array(),

    /** Seniority level extracted from the JD (e.g. `junior`, `senior`, `staff`). */
    parsedSenioritySignal: text("parsed_seniority_signal"),

    /** Full structured JSON response from the JD parse AI call. Stored for debugging. */
    parsedStructuredData: jsonb("parsed_structured_data"),

    /** Data extracted via the AI Job Research pipeline. */
    researchData: jsonb("research_data"),

    /**
     * Current status. Lifecycle: `new` → `scored` (after JD parse) → `applied`.
     * Special states: `parse_failed` (AI returned unparseable output).
     */
    status: text("status").notNull().default("new"),

    /**
     * Hash used for deduplication across ingestion sources.
     * Computed from title + company + sourceUrl. Jobs with the same hash are considered duplicates.
     */
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
    index("jobs_user_created_at_idx").on(table.userId, table.createdAt),
    index("jobs_user_status_idx").on(table.userId, table.status),
    index("jobs_role_profile_status_idx").on(table.roleProfileId, table.status),
    index("jobs_dedup_hash_idx").on(table.deduplicationHash),
    index("jobs_status_idx").on(table.status),
  ],
);

/** Zod schema for inserting a job (omits server-managed fields). */
export const insertJobSchema = createInsertSchema(jobsTable).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

/** Type for a new job insert payload. */
export type InsertJob = z.infer<typeof insertJobSchema>;

/** Type for a full job row as returned from the database. */
export type Job = typeof jobsTable.$inferSelect;
