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

export const feedbackSignalsTable = pgTable(
  "feedback_signals",
  {
    id: serial("id").primaryKey(),

    applicationId: integer("application_id")
      .notNull()
      .references(() => applicationsTable.id, { onDelete: "cascade" }),

    resumeVersionId: integer("resume_version_id").references(
      () => resumeVersionsTable.id,
      { onDelete: "set null" },
    ),

    outcome: text("outcome").notNull(),

    signalType: text("signal_type").notNull(),

    notes: text("notes"),

    attributionData: jsonb("attribution_data").notNull().default({}),

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

export const insertFeedbackSignalSchema = createInsertSchema(
  feedbackSignalsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFeedbackSignal = z.infer<typeof insertFeedbackSignalSchema>;
export type FeedbackSignal = typeof feedbackSignalsTable.$inferSelect;
