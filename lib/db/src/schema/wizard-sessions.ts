import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { adminUsersTable } from "./admin-users";
import { jobsTable } from "./jobs";

export const wizardSessionsTable = pgTable(
  "wizard_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => adminUsersTable.id, { onDelete: "cascade" }),
    jobId: integer("job_id").references(() => jobsTable.id, {
      onDelete: "set null",
    }),
    currentStep: text("current_step").notNull().default("intake"),
    state: jsonb("state").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("wizard_sessions_user_id_idx").on(table.userId),
    index("wizard_sessions_job_id_idx").on(table.jobId),
  ],
);

export const insertWizardSessionSchema = createInsertSchema(wizardSessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WizardSession = typeof wizardSessionsTable.$inferSelect;
export type InsertWizardSession = z.infer<typeof insertWizardSessionSchema>;
