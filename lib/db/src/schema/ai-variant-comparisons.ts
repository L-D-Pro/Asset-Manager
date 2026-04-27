import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiVariantComparisonsTable = pgTable(
  "ai_variant_comparisons",
  {
    id: serial("id").primaryKey(),
    taskScope: text("task_scope").notNull(),
    variantAId: integer("variant_a_id").notNull(),
    variantAType: text("variant_a_type").notNull(),
    variantBId: integer("variant_b_id").notNull(),
    variantBType: text("variant_b_type").notNull(),
    probabilityA: text("probability_a").notNull(),
    confidence: text("confidence").notNull(),
    successRateA: text("success_rate_a").notNull().default("0"),
    successRateB: text("success_rate_b").notNull().default("0"),
    sampleSizeA: integer("sample_size_a").notNull().default(0),
    sampleSizeB: integer("sample_size_b").notNull().default(0),
    status: text("status").notNull().default("pending"),
    promotedAt: timestamp("promoted_at", { withTimezone: true }),
    revertedAt: timestamp("reverted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ai_variant_comparisons_task_scope_idx").on(table.taskScope),
    index("ai_variant_comparisons_status_idx").on(table.status),
  ],
);

export const insertAiVariantComparisonSchema = createInsertSchema(
  aiVariantComparisonsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertAiVariantComparison = z.infer<
  typeof insertAiVariantComparisonSchema
>;
export type AiVariantComparison = typeof aiVariantComparisonsTable.$inferSelect;
