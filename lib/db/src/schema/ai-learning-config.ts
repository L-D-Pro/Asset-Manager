import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiLearningConfigTable = pgTable("ai_learning_config", {
  id: serial("id").primaryKey(),
  autoPromoteEnabled: boolean("auto_promote_enabled").notNull().default(false),
  autoRecomputeEnabled: boolean("auto_recompute_enabled").notNull().default(true),
  autoEvaluateEnabled: boolean("auto_evaluate_enabled").notNull().default(true),
  autoTrainSuggestEnabled: boolean("auto_train_suggest_enabled").notNull().default(true),
  confidenceThreshold: text("confidence_threshold").notNull().default("0.95"),
  minSampleSize: integer("min_sample_size").notNull().default(10),
  minImprovementMargin: text("min_improvement_margin").notNull().default("0.05"),
  recomputeScheduleCron: text("recompute_schedule_cron")
    .notNull()
    .default("0 2 * * *"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAiLearningConfigSchema = createInsertSchema(
  aiLearningConfigTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export const updateAiLearningConfigSchema = insertAiLearningConfigSchema
  .partial();

export type InsertAiLearningConfig = z.infer<
  typeof insertAiLearningConfigSchema
>;
export type UpdateAiLearningConfig = z.infer<
  typeof updateAiLearningConfigSchema
>;
export type AiLearningConfig = typeof aiLearningConfigTable.$inferSelect;
