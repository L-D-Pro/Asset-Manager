import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { applicationsTable } from "./applications";
import { jobsTable } from "./jobs";

export const siteAdaptersTable = pgTable(
  "site_adapters",
  {
    id: serial("id").primaryKey(),
    platform: text("platform").notNull(),
    label: text("label").notNull(),
    adapterType: text("adapter_type").notNull().default("assist_only"),
    allowedAutomationLevel: text("allowed_automation_level")
      .notNull()
      .default("assist_only"),
    isActive: boolean("is_active").notNull().default(true),
    requiresHumanFinalSubmit: boolean("requires_human_final_submit")
      .notNull()
      .default(true),
    notes: text("notes"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("site_adapters_platform_idx").on(table.platform),
    index("site_adapters_active_idx").on(table.isActive),
  ],
);

export const applicationSessionsTable = pgTable(
  "application_sessions",
  {
    id: serial("id").primaryKey(),
    applicationId: integer("application_id").references(
      () => applicationsTable.id,
      { onDelete: "cascade" },
    ),
    jobId: integer("job_id").references(() => jobsTable.id, {
      onDelete: "cascade",
    }),
    siteAdapterId: integer("site_adapter_id").references(
      () => siteAdaptersTable.id,
      { onDelete: "set null" },
    ),
    platform: text("platform").notNull(),
    targetUrl: text("target_url"),
    status: text("status").notNull().default("draft"),
    humanCheckpoint: text("human_checkpoint"),
    currentStep: text("current_step"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("application_sessions_application_id_idx").on(table.applicationId),
    index("application_sessions_job_id_idx").on(table.jobId),
    index("application_sessions_platform_idx").on(table.platform),
    index("application_sessions_status_idx").on(table.status),
  ],
);

export const applicationFormFieldsTable = pgTable(
  "application_form_fields",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => applicationSessionsTable.id, { onDelete: "cascade" }),
    fieldKey: text("field_key").notNull(),
    label: text("label"),
    fieldType: text("field_type").notNull().default("text"),
    detectedValue: text("detected_value"),
    suggestedValue: text("suggested_value"),
    approvedValue: text("approved_value"),
    status: text("status").notNull().default("draft"),
    isSensitive: boolean("is_sensitive").notNull().default(false),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("application_form_fields_session_id_idx").on(table.sessionId),
    index("application_form_fields_status_idx").on(table.status),
  ],
);

export const applicationActionsTable = pgTable(
  "application_actions",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => applicationSessionsTable.id, { onDelete: "cascade" }),
    actionType: text("action_type").notNull(),
    status: text("status").notNull().default("logged"),
    requiresHumanApproval: boolean("requires_human_approval")
      .notNull()
      .default(true),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("application_actions_session_id_idx").on(table.sessionId),
    index("application_actions_status_idx").on(table.status),
  ],
);

export const insertSiteAdapterSchema = createInsertSchema(siteAdaptersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertApplicationSessionSchema = createInsertSchema(
  applicationSessionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApplicationFormFieldSchema = createInsertSchema(
  applicationFormFieldsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApplicationActionSchema = createInsertSchema(
  applicationActionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type SiteAdapter = typeof siteAdaptersTable.$inferSelect;
export type ApplicationSession = typeof applicationSessionsTable.$inferSelect;
export type ApplicationFormField = typeof applicationFormFieldsTable.$inferSelect;
export type ApplicationAction = typeof applicationActionsTable.$inferSelect;
export type InsertSiteAdapter = z.infer<typeof insertSiteAdapterSchema>;
export type InsertApplicationSession = z.infer<typeof insertApplicationSessionSchema>;
export type InsertApplicationFormField = z.infer<typeof insertApplicationFormFieldSchema>;
export type InsertApplicationAction = z.infer<typeof insertApplicationActionSchema>;
