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
import { applicationsTable } from "./applications";
import { resumeVersionsTable } from "./resume-versions";

/**
 * Feedback signals — outcome data from the application lifecycle.
 *
 * Each signal records a meaningful event in the hiring funnel tied to a specific
 * application: an ATS screen pass, a phone screen, an interview invite, an offer,
 * or a rejection. Signals can also record internal review events (e.g. resume change
 * decisions, cover letter revision requests).
 *
 * `attributionData` is structured to support future Phase 3 self-learning:
 * correlating outcomes with specific resume versions, role profiles, keyword choices,
 * and tailoring decisions to suggest improvements to future generations.
 *
 * `processedAt` marks when a signal has been incorporated into optimization logic
 * (future use — Phase 3).
 *
 * Built-in `signalType` values (convention, not enforced):
 * - `ats_screen`, `phone_screen`, `technical_screen`, `final_round`
 * - `offer`, `rejection`, `no_response`
 * - `resume_review` (per-change review decisions from dashboard)
 * - `cover_letter_revision_request` (revision note from dashboard)
 */
export const feedbackSignalsTable = pgTable(
  "feedback_signals",
  {
    /** Auto-incrementing primary key. */
    id: serial("id").primaryKey(),

    /** The application this signal is associated with. Cascade-deletes if the application is deleted. */
    applicationId: integer("application_id")
      .notNull()
      .references(() => applicationsTable.id, { onDelete: "cascade" }),

    /** The specific resume version involved (if the signal relates to a resume). */
    resumeVersionId: integer("resume_version_id").references(
      () => resumeVersionsTable.id,
      { onDelete: "set null" },
    ),

    /**
     * The outcome of the signal.
     * Examples: `"interview"`, `"rejected"`, `"offer"`, `"no_response"`, `"completed"`, `"revision_requested"`
     */
    outcome: text("outcome").notNull(),

    /**
     * The category of feedback signal.
     * Examples: `"ats_screen"`, `"phone_screen"`, `"final_round"`, `"resume_review"`, `"cover_letter_revision_request"`
     */
    signalType: text("signal_type").notNull(),

    /** Free-text notes from the user or system. For revision requests, contains the user's revision rationale. */
    notes: text("notes"),

    /**
     * Structured attribution data for future self-learning (Phase 3).
     * Intended to capture: which role profile was used, which keywords were matched,
     * which tailoring decisions were made, etc.
     */
    attributionData: jsonb("attribution_data").notNull().default({}),

    /** When this signal was incorporated into optimization logic. Null until Phase 3. */
    processedAt: timestamp("processed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("feedback_signals_application_id_idx").on(table.applicationId),
    index("feedback_signals_outcome_idx").on(table.outcome),
    index("feedback_signals_signal_type_idx").on(table.signalType),
  ],
);

/** Zod schema for inserting a feedback signal (omits server-managed fields). */
export const insertFeedbackSignalSchema = createInsertSchema(
  feedbackSignalsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/** Type for a new feedback signal insert payload. */
export type InsertFeedbackSignal = z.infer<typeof insertFeedbackSignalSchema>;

/** Type for a full feedback signal row as returned from the database. */
export type FeedbackSignal = typeof feedbackSignalsTable.$inferSelect;
