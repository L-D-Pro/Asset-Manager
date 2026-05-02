import {
  pgTable,
  text,
  serial,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bestPracticesTable = pgTable("best_practices", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().default("general"),
  title: text("title").notNull().default("Resume Best Practices"),
  items: jsonb("items").notNull().default("[]"),
  hardcodedGuards: jsonb("hardcoded_guards").notNull().default("{}"),
  lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertBestPracticesSchema = createInsertSchema(
  bestPracticesTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertBestPractices = z.infer<typeof insertBestPracticesSchema>;
export type BestPractices = typeof bestPracticesTable.$inferSelect;
