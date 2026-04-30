import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { adminUsersTable } from "./admin-users";

export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => adminUsersTable.id, { onDelete: "set null" }),
  type: text("type").notNull(), // "bug" | "feature" | "general"
  message: text("message").notNull(),
  pageUrl: text("page_url"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FeedbackEntry = typeof feedbackTable.$inferSelect;
