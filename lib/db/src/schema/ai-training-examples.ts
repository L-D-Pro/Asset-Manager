import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiRunEvaluationsTable } from "./ai-run-evaluations";
import { adminUsersTable } from "./admin-users";

/**
 * Curated examples for future few-shot prompts, eval fixtures, or fine-tuning.
 *
 * Only human-approved or human-edited content should be promoted here.
 */
export const aiTrainingExamplesTable = pgTable(
  "ai_training_examples",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => adminUsersTable.id, { onDelete: "cascade" }),
    taskScope: text("task_scope").notNull(),
    sourceEntityType: text("source_entity_type"),
    sourceEntityId: integer("source_entity_id"),
    evaluationId: integer("evaluation_id").references(
      () => aiRunEvaluationsTable.id,
      { onDelete: "set null" },
    ),
    inputSnapshot: jsonb("input_snapshot").notNull().default({}),
    approvedOutput: text("approved_output").notNull(),
    rejectedOutput: text("rejected_output"),
    notes: text("notes"),
    qualityScore: integer("quality_score"),
    isActive: boolean("is_active").notNull().default(true),
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
    index("ai_training_examples_user_created_at_idx").on(table.userId, table.createdAt),
    index("ai_training_examples_task_scope_idx").on(table.taskScope),
    index("ai_training_examples_source_idx").on(
      table.sourceEntityType,
      table.sourceEntityId,
    ),
    index("ai_training_examples_active_idx").on(table.taskScope, table.isActive),
  ],
);

export const insertAiTrainingExampleSchema = createInsertSchema(
  aiTrainingExamplesTable,
).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiTrainingExample = z.infer<typeof insertAiTrainingExampleSchema>;
export type AiTrainingExample = typeof aiTrainingExamplesTable.$inferSelect;
