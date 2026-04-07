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

/**
 * AI model configurations — per-task model routing table.
 *
 * Each row defines a model configuration for a specific task scope. The model router
 * (`lib/model-router.ts`) selects the active configuration with the lowest `priority`
 * value for the requested task scope, then follows the `fallbackModelId` chain if
 * that model fails at the API level.
 *
 * Multiple configs may exist for the same `taskScope`:
 * - The lowest `priority` value is tried first (0 = highest priority).
 * - Inactive configs (`isActive = false`) are skipped during selection but may appear
 *   in the fallback chain.
 *
 * Task scopes seeded on startup: `jd_parsing`, `resume_tailoring`, `cover_letter`, `default`.
 * Custom task scopes can be added via the dashboard (e.g. `scoring`, `feedback_analysis`).
 *
 * The `fallbackModelId` creates a self-referential linked list. The model router uses
 * a visited set to detect and break circular references.
 */
export const aiModelConfigsTable = pgTable(
  "ai_model_configs",
  {
    /** Auto-incrementing primary key. */
    id: serial("id").primaryKey(),

    /**
     * Task identifier this config applies to.
     * Built-in values: `jd_parsing`, `resume_tailoring`, `cover_letter`, `default`.
     * Custom values are supported — the router falls back to `default` if no config
     * is found for the requested scope.
     */
    taskScope: text("task_scope").notNull(),

    /** AI provider identifier. Currently always `openrouter`. */
    provider: text("provider").notNull().default("openrouter"),

    /** Model identifier as passed to the OpenRouter API (e.g. `anthropic/claude-3.5-haiku`). */
    modelName: text("model_name").notNull(),

    /** Whether this config is considered during model selection. */
    isActive: boolean("is_active").notNull().default(true),

    /**
     * Selection priority within the same task scope. Lower value = tried first.
     * Used to order multiple active configs for the same scope.
     */
    priority: integer("priority").notNull().default(1),

    /**
     * Points to another config to try if this model fails or is inactive.
     * Creates a linked-list fallback chain. The model router detects cycles.
     */
    fallbackModelId: integer("fallback_model_id").references(
      (): AnyPgColumn => aiModelConfigsTable.id,
      { onDelete: "set null" },
    ),

    /** Cost in USD per input (prompt) token. Stored as string for decimal precision. Used for cost logging. */
    costPerInputToken: text("cost_per_input_token"),

    /** Cost in USD per output (completion) token. Used for cost logging. */
    costPerOutputToken: text("cost_per_output_token"),

    /** Maximum number of completion tokens for this model. Passed directly to the API. */
    maxTokens: integer("max_tokens"),

    /** Reserved for future per-model settings (temperature, top_p, stop sequences, etc.). */
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

/** Zod schema for inserting an AI model config (omits server-managed fields). */
export const insertAiModelConfigSchema = createInsertSchema(
  aiModelConfigsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/** Type for a new AI model config insert payload. */
export type InsertAiModelConfig = z.infer<typeof insertAiModelConfigSchema>;

/** Type for a full AI model config row as returned from the database. */
export type AiModelConfig = typeof aiModelConfigsTable.$inferSelect;
