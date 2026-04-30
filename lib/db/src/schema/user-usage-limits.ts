import {
  pgTable,
  serial,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { adminUsersTable } from "./admin-users";

export const userUsageLimitsTable = pgTable(
  "user_usage_limits",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => adminUsersTable.id, { onDelete: "cascade" })
      .unique(),
    weeklyLimit: integer("weekly_limit").notNull().default(5),
    weeklyUsed: integer("weekly_used").notNull().default(0),
    totalUsed: integer("total_used").notNull().default(0),
    periodStart: timestamp("period_start", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("user_usage_limits_user_id_idx").on(table.userId),
  ],
);

export type UserUsageLimit = typeof userUsageLimitsTable.$inferSelect;
