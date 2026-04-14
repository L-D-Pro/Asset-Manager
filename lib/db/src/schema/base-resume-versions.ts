import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Immutable history of the user's canonical base resume.
 *
 * Only one row may be marked `isCurrent = true` at a time. Saving or restoring
 * a resume always creates a new row, preserving full history.
 */
export const baseResumeVersionsTable = pgTable(
  "base_resume_versions",
  {
    id: serial("id").primaryKey(),
    label: text("label"),
    contentText: text("content_text").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("base_resume_versions_created_at_idx").on(table.createdAt),
    index("base_resume_versions_is_current_idx").on(table.isCurrent),
    uniqueIndex("base_resume_versions_current_unique_idx")
      .on(table.isCurrent)
      .where(sql`${table.isCurrent} = true`),
  ],
);

export const insertBaseResumeVersionSchema = createInsertSchema(
  baseResumeVersionsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBaseResumeVersion = z.infer<
  typeof insertBaseResumeVersionSchema
>;

export type BaseResumeVersion = typeof baseResumeVersionsTable.$inferSelect;
