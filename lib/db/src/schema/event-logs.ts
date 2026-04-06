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

export const eventLogsTable = pgTable(
  "event_logs",
  {
    id: serial("id").primaryKey(),

    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),

    applicationId: integer("application_id").references(
      () => applicationsTable.id,
      { onDelete: "cascade" },
    ),

    jobId: integer("job_id").references(() => jobsTable.id, {
      onDelete: "cascade",
    }),

    eventType: text("event_type").notNull(),

    previousState: text("previous_state"),
    nextState: text("next_state"),

    metadata: jsonb("metadata").notNull().default({}),

    actorType: text("actor_type").notNull().default("user"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("event_logs_entity_idx").on(table.entityType, table.entityId),
    index("event_logs_application_id_idx").on(table.applicationId),
    index("event_logs_job_id_idx").on(table.jobId),
    index("event_logs_event_type_idx").on(table.eventType),
  ],
);

export const insertEventLogSchema = createInsertSchema(eventLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertEventLog = z.infer<typeof insertEventLogSchema>;
export type EventLog = typeof eventLogsTable.$inferSelect;
