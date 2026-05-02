import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { adminUsersTable } from "./admin-users";

export const uiShellConfigsTable = pgTable(
  "ui_shell_configs",
  {
    id: serial("id").primaryKey(),
    appKey: text("app_key").notNull(),
    themeID: text("theme_id").notNull(),
    themeDefinitions: jsonb("theme_definitions").notNull().default([]),
    uiConfig: jsonb("ui_config").notNull().default({}),
    updatedByAdminId: integer("updated_by_admin_id").references(
      () => adminUsersTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    appKeyUnique: uniqueIndex("ui_shell_configs_app_key_unique").on(table.appKey),
  }),
);

export const insertUiShellConfigSchema = createInsertSchema(uiShellConfigsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUiShellConfigSchema = insertUiShellConfigSchema.partial();

export type InsertUiShellConfig = z.infer<typeof insertUiShellConfigSchema>;
export type UpdateUiShellConfig = z.infer<typeof updateUiShellConfigSchema>;
export type UiShellConfigRecord = typeof uiShellConfigsTable.$inferSelect;
