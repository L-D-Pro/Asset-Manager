import { pgTable, integer, boolean, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { adminUsersTable } from "./admin-users";

/**
 * User onboarding state — tracks progress through the getting-started flow.
 *
 * Each user has exactly one onboarding state row. Steps are stored as an array
 * of completed step IDs. Hints dismissed by the user are tracked per page path.
 */
export const userOnboardingStateTable = pgTable("user_onboarding_state", {
  /** FK to admin_users — one-to-one relationship. */
  userId: integer("user_id")
    .primaryKey()
    .references(() => adminUsersTable.id, { onDelete: "cascade" }),

  /** Whether the user has seen the welcome modal. */
  hasSeenWelcome: boolean("has_seen_welcome").notNull().default(false),

  /** Array of completed step IDs: ["resume", "role_profile", "first_job", "wizard", "application"] */
  completedSteps: text("completed_steps").array().notNull().default([]),

  /** Array of page paths where hints have been dismissed. */
  dismissedHints: text("dismissed_hints").array().notNull().default([]),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUserOnboardingStateSchema = createInsertSchema(
  userOnboardingStateTable,
).omit({
  createdAt: true,
  updatedAt: true,
});

export type UserOnboardingState = typeof userOnboardingStateTable.$inferSelect;
export type InsertUserOnboardingState = z.infer<
  typeof insertUserOnboardingStateSchema
>;
