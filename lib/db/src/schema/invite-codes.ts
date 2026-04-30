import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { adminUsersTable } from "./admin-users";

export const inviteCodesTable = pgTable(
  "invite_codes",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    maxUses: integer("max_uses").notNull().default(1),
    usedCount: integer("used_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdByAdminId: integer("created_by_admin_id").references(
      () => adminUsersTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("invite_codes_code_idx").on(table.code),
    index("invite_codes_active_idx").on(table.isActive),
  ],
);

export type InviteCode = typeof inviteCodesTable.$inferSelect;
