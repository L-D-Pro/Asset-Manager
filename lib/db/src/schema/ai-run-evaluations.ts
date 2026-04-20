import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventLogsTable } from "./event-logs";
import { aiPromptVersionsTable } from "./ai-prompt-versions";

/**
 * Human/system evaluations of AI outputs.
 *
 * These records become the feedback spine for prompt/model selection and future
 * eval harnesses. Scores are nullable because some reviews are qualitative only.
 */
export const aiRunEvaluationsTable = pgTable(
  "ai_run_evaluations",
  {
    id: serial("id").primaryKey(),
    eventLogId: integer("event_log_id").references(() => eventLogsTable.id, {
      onDelete: "set null",
    }),
    /**
     * Canonical AI lineage key for the evaluated run.
     * Nullable-first so legacy evaluations remain queryable but are excluded from trusted joins.
     */
    runId: text("run_id"),
    promptVersionId: integer("prompt_version_id").references(
      () => aiPromptVersionsTable.id,
      { onDelete: "set null" },
    ),
    taskScope: text("task_scope").notNull(),
    entityType: text("entity_type"),
    entityId: integer("entity_id"),
    truthfulnessScore: integer("truthfulness_score"),
    relevanceScore: integer("relevance_score"),
    formattingScore: integer("formatting_score"),
    attributionScore: integer("attribution_score"),
    approvalOutcome: text("approval_outcome"),
    editDistance: integer("edit_distance"),
    downstreamOutcome: text("downstream_outcome"),
    evaluatorType: text("evaluator_type").notNull().default("user"),
    notes: text("notes"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ai_run_evaluations_task_scope_idx").on(table.taskScope),
    index("ai_run_evaluations_event_log_id_idx").on(table.eventLogId),
    index("ai_run_evaluations_run_id_idx").on(table.runId),
    uniqueIndex("ai_run_evaluations_run_scope_entity_uidx").on(
      table.runId,
      table.taskScope,
      table.entityType,
      table.entityId,
    ),
    index("ai_run_evaluations_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const insertAiRunEvaluationSchema = createInsertSchema(
  aiRunEvaluationsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiRunEvaluation = z.infer<typeof insertAiRunEvaluationSchema>;
export type AiRunEvaluation = typeof aiRunEvaluationsTable.$inferSelect;
