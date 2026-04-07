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

/**
 * Role profiles define what the user is looking for in a target role.
 *
 * The user creates one profile per type of role they are searching for
 * (e.g. "Senior Frontend", "Staff AI Engineer"). Jobs are scored per profile —
 * not globally — so the same job may pass filters for one profile and fail for another.
 *
 * Hard filters eliminate jobs outright if they contain blocked keywords, are missing
 * required keywords, or fall below the minimum salary. Soft weights compute a 0–100
 * relevance score based on keyword overlap.
 *
 * `hardFilters` shape: `{ requiredKeywords: string[], blockedKeywords: string[], minSalary: number }`
 * `softWeights` shape: `{ [keyword: string]: number }` (weight 0–10 per keyword)
 */
export const roleProfilesTable = pgTable("role_profiles", {
  /** Auto-incrementing primary key. */
  id: serial("id").primaryKey(),

  /** Human-readable profile name (e.g. "Senior Frontend"). */
  name: text("name").notNull(),

  /** Optional longer description of the target role. */
  description: text("description"),

  /**
   * Hard filter rules. A job that fails any hard filter receives `passesHardFilters: false`
   * regardless of its soft score. Shape: `{ requiredKeywords, blockedKeywords, minSalary }`.
   */
  hardFilters: jsonb("hard_filters").notNull().default({}),

  /**
   * Soft scoring weights. Each key is a keyword/skill; the value (0–10) is its weight.
   * The job score is the sum of matched weights divided by total possible weight, normalised to 0–100.
   */
  softWeights: jsonb("soft_weights").notNull().default({}),

  /** Companies to prefer (informational — not yet enforced in scoring). */
  companyAllowList: text("company_allow_list").array().notNull().default([]),

  /** Companies to exclude (informational — not yet enforced in scoring). */
  companyDenyList: text("company_deny_list").array().notNull().default([]),

  /** Whether this profile is included in job scoring. Inactive profiles are skipped. */
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Zod schema for inserting a role profile (omits server-managed fields). */
export const insertRoleProfileSchema = createInsertSchema(
  roleProfilesTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/** Type for a new role profile insert payload. */
export type InsertRoleProfile = z.infer<typeof insertRoleProfileSchema>;

/** Type for a full role profile row as returned from the database. */
export type RoleProfile = typeof roleProfilesTable.$inferSelect;
