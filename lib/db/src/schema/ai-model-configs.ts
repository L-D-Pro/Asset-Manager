import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiModelConfigsTable = pgTable(
  "ai_model_configs",
  {
    id: serial("id").primaryKey(),

    taskScope: text("task_scope").notNull(),

    provider: text("provider").notNull().default("openrouter"),

    modelName: text("model_name").notNull(),

    isActive: boolean("is_active").notNull().default(true),

    priority: integer("priority").notNull().default(1),

    // Self-referential FK: references the id column of this same table.
    // Uses AnyPgColumn to satisfy the Drizzle type constraint in the lazy callback,
    // which is the documented pattern for self-referential foreign keys in Drizzle ORM.
    fallbackModelId: integer("fallback_model_id").references(
      (): AnyPgColumn => aiModelConfigsTable.id,
      { onDelete: "set null" },
    ),

    costPerInputToken: text("cost_per_input_token"),
    costPerOutputToken: text("cost_per_output_token"),

    maxTokens: integer("max_tokens"),

    extraConfig: jsonb("extra_config").notNull().default({}),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ai_model_configs_task_scope_active_idx").on(
      table.taskScope,
      table.isActive,
    ),
    index("ai_model_configs_task_scope_idx").on(table.taskScope),
  ],
);

export const insertAiModelConfigSchema = createInsertSchema(
  aiModelConfigsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiModelConfig = z.infer<typeof insertAiModelConfigSchema>;
export type AiModelConfig = typeof aiModelConfigsTable.$inferSelect;
