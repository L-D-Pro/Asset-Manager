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
import { jobsTable } from "./jobs";

/**
 * Event logs — immutable audit trail for all state changes and AI calls.
 *
 * Every significant operation in the system writes a row here:
 * - AI call attempts (success and failure), with token counts and estimated cost
 * - State machine transitions (e.g. resume version approved, application status changed)
 * - Any other key system events
 *
 * The API exposes this table as read-only (GET only — no create/update/delete endpoints).
 * Rows should be treated as append-only; do not update or delete them programmatically.
 *
 * The `entityType` + `entityId` pair forms a polymorphic reference to any entity in the system
 * (e.g. `entityType: "job", entityId: 42` refers to `jobs.id = 42`).
 *
 * For AI calls: `eventType` is `"ai_call"` (success) or `"ai_call_failed"` (terminal failure).
 * The `metadata` jsonb contains `promptTokens`, `completionTokens`, `estimatedCostUsd`,
 * `modelName`, `taskType`, `priorFailures` (list of failed models before the successful one).
 */
export const eventLogsTable = pgTable(
  "event_logs",
  {
    /** Auto-incrementing primary key. */
    id: serial("id").primaryKey(),

    /**
     * The type of entity this event belongs to.
     * Examples: `"job"`, `"resume_version"`, `"cover_letter_version"`, `"ai_call"`, `"application"`
     */
    entityType: text("entity_type").notNull(),

    /** The ID of the entity in its respective table. */
    entityId: integer("entity_id").notNull(),

    /** Optional: the application context this event belongs to (for cascading deletes). */
    applicationId: integer("application_id").references(
      () => applicationsTable.id,
      { onDelete: "cascade" },
    ),

    /** Optional: the job context this event belongs to (for cascading deletes). */
    jobId: integer("job_id").references(() => jobsTable.id, {
      onDelete: "cascade",
    }),

    /**
     * The specific event that occurred.
     * Examples: `"ai_call"`, `"ai_call_failed"`, `"status_changed"`, `"approved"`, `"rejected"`
     */
    eventType: text("event_type").notNull(),

    /** State of the entity before this event (e.g. `"pending_approval"`). */
    previousState: text("previous_state"),

    /** State of the entity after this event (e.g. `"approved"`). */
    nextState: text("next_state"),

    /**
     * Arbitrary structured data for this event.
     * For AI calls: `{ taskType, modelName, provider, promptTokens, completionTokens, estimatedCostUsd, succeeded, attemptNumber, priorFailures }`
     * For state changes: `{ reason }` or other context
     */
    metadata: jsonb("metadata").notNull().default({}),

    /**
     * Who triggered this event.
     * Values: `"user"` (user action via dashboard) or `"system"` (automated pipeline/AI call).
     */
    actorType: text("actor_type").notNull().default("user"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("event_logs_entity_idx").on(table.entityType, table.entityId),
    index("event_logs_application_id_idx").on(table.applicationId),
    index("event_logs_job_id_idx").on(table.jobId),
    index("event_logs_event_type_idx").on(table.eventType),
  ],
);

/** Zod schema for inserting an event log entry (omits server-managed fields). */
export const insertEventLogSchema = createInsertSchema(eventLogsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/** Type for a new event log insert payload. */
export type InsertEventLog = z.infer<typeof insertEventLogSchema>;

/** Type for a full event log row as returned from the database. */
export type EventLog = typeof eventLogsTable.$inferSelect;
