import {
  pgTable,
  text,
  serial,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleProfilesTable = pgTable("role_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),

  hardFilters: jsonb("hard_filters").notNull().default({}),

  softWeights: jsonb("soft_weights").notNull().default({}),

  companyAllowList: text("company_allow_list").array().notNull().default([]),
  companyDenyList: text("company_deny_list").array().notNull().default([]),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertRoleProfileSchema = createInsertSchema(
  roleProfilesTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRoleProfile = z.infer<typeof insertRoleProfileSchema>;
export type RoleProfile = typeof roleProfilesTable.$inferSelect;
