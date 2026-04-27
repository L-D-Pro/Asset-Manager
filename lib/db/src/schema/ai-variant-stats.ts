import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiVariantStatsTable = pgTable(
  "ai_variant_stats",
  {
    id: serial("id").primaryKey(),
    variantType: text("variant_type").notNull(),
    variantId: integer("variant_id").notNull(),
    taskScope: text("task_scope").notNull(),
    successes: integer("successes").notNull().default(0),
    failures: integer("failures").notNull().default(0),
    pending: integer("pending").notNull().default(0),
    totalCostUsd: text("total_cost_usd").notNull().default("0"),
    avgCostPerApp: text("avg_cost_per_app").notNull().default("0"),
    lastComputedAt: timestamp("last_computed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("ai_variant_stats_unique_idx").on(
      table.variantType,
      table.variantId,
      table.taskScope,
    ),
  ],
);

export const insertAiVariantStatSchema = createInsertSchema(
  aiVariantStatsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertAiVariantStat = z.infer<typeof insertAiVariantStatSchema>;
export type AiVariantStat = typeof aiVariantStatsTable.$inferSelect;
