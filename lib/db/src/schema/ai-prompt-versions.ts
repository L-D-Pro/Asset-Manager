import { sql } from "drizzle-orm";
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

/**
 * Versioned AI prompt templates.
 *
 * These rows let us improve AI behavior through supervised prompt iteration
 * before considering fine-tuning. Active prompts can override or wrap the
 * pipeline-provided prompts at runtime.
 */
export const aiPromptVersionsTable = pgTable(
  "ai_prompt_versions",
  {
    id: serial("id").primaryKey(),
    taskScope: text("task_scope").notNull(),
    version: integer("version").notNull().default(1),
    label: text("label").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    userPromptTemplate: text("user_prompt_template"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(false),
    metadata: jsonb("metadata").notNull().default({}),
    personality: text("personality"),
    goals: text("goals"),
    skillTags: text("skill_tags").array().default(sql`'{}'`),
    roleLabel: text("role_label"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ai_prompt_versions_task_scope_idx").on(table.taskScope),
    index("ai_prompt_versions_active_idx").on(table.taskScope, table.isActive),
  ],
);

export const insertAiPromptVersionSchema = createInsertSchema(
  aiPromptVersionsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiPromptVersion = z.infer<typeof insertAiPromptVersionSchema>;
export type AiPromptVersion = typeof aiPromptVersionsTable.$inferSelect;
