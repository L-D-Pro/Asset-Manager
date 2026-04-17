import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  jsonb,
  boolean,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const freelanceProfilesTable = pgTable(
  "freelance_profiles",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    contractorResumeText: text("contractor_resume_text").notNull().default(""),
    portfolioProjects: jsonb("portfolio_projects").notNull().default([]),
    skills: text("skills").array().notNull().default([]),
    caseStudies: jsonb("case_studies").notNull().default([]),
    hourlyRateMin: numeric("hourly_rate_min", { precision: 10, scale: 2 }),
    hourlyRateTarget: numeric("hourly_rate_target", { precision: 10, scale: 2 }),
    availability: text("availability"),
    preferredProjectTypes: text("preferred_project_types").array().notNull().default([]),
    disallowedClaims: text("disallowed_claims").array().notNull().default([]),
    proofLinks: jsonb("proof_links").notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
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
    index("freelance_profiles_active_idx").on(table.isActive),
    index("freelance_profiles_name_idx").on(table.name),
  ],
);

export const projectSourcesTable = pgTable(
  "project_sources",
  {
    id: serial("id").primaryKey(),
    platform: text("platform").notNull().default("upwork"),
    sourceType: text("source_type").notNull().default("manual"),
    sourceUrl: text("source_url"),
    title: text("title"),
    rawText: text("raw_text"),
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
    index("project_sources_platform_idx").on(table.platform),
    index("project_sources_source_type_idx").on(table.sourceType),
  ],
);

export const freelanceProjectsTable = pgTable(
  "freelance_projects",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id").references(() => freelanceProfilesTable.id, {
      onDelete: "set null",
    }),
    sourceId: integer("source_id").references(() => projectSourcesTable.id, {
      onDelete: "set null",
    }),
    platform: text("platform").notNull().default("upwork"),
    title: text("title").notNull(),
    clientName: text("client_name"),
    projectUrl: text("project_url"),
    descriptionText: text("description_text").notNull(),
    budgetType: text("budget_type"),
    budgetMin: numeric("budget_min", { precision: 10, scale: 2 }),
    budgetMax: numeric("budget_max", { precision: 10, scale: 2 }),
    hourlyMin: numeric("hourly_min", { precision: 10, scale: 2 }),
    hourlyMax: numeric("hourly_max", { precision: 10, scale: 2 }),
    requiredSkills: text("required_skills").array().notNull().default([]),
    clientMetadata: jsonb("client_metadata").notNull().default({}),
    fitScore: integer("fit_score"),
    riskFlags: text("risk_flags").array().notNull().default([]),
    status: text("status").notNull().default("new"),
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
    index("freelance_projects_profile_id_idx").on(table.profileId),
    index("freelance_projects_platform_idx").on(table.platform),
    index("freelance_projects_status_idx").on(table.status),
    index("freelance_projects_fit_score_idx").on(table.fitScore),
  ],
);

export const proposalVersionsTable = pgTable(
  "proposal_versions",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => freelanceProjectsTable.id, { onDelete: "cascade" }),
    profileId: integer("profile_id").references(() => freelanceProfilesTable.id, {
      onDelete: "set null",
    }),
    label: text("label"),
    status: text("status").notNull().default("pending_approval"),
    proposalText: text("proposal_text").notNull(),
    clientMessageText: text("client_message_text"),
    bidAmount: numeric("bid_amount", { precision: 10, scale: 2 }),
    bidType: text("bid_type"),
    milestones: jsonb("milestones").notNull().default([]),
    citedProof: jsonb("cited_proof").notNull().default([]),
    riskNotes: text("risk_notes"),
    rawContent: text("raw_content"),
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
    index("proposal_versions_project_id_idx").on(table.projectId),
    index("proposal_versions_profile_id_idx").on(table.profileId),
    index("proposal_versions_status_idx").on(table.status),
  ],
);

export const proposalOutcomesTable = pgTable(
  "proposal_outcomes",
  {
    id: serial("id").primaryKey(),
    proposalVersionId: integer("proposal_version_id").references(
      () => proposalVersionsTable.id,
      { onDelete: "set null" },
    ),
    projectId: integer("project_id").references(() => freelanceProjectsTable.id, {
      onDelete: "cascade",
    }),
    outcome: text("outcome").notNull(),
    actualEarnings: numeric("actual_earnings", { precision: 10, scale: 2 }),
    clientQuality: integer("client_quality"),
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
    index("proposal_outcomes_project_id_idx").on(table.projectId),
    index("proposal_outcomes_outcome_idx").on(table.outcome),
  ],
);

export const clientMessageTemplatesTable = pgTable(
  "client_message_templates",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    templateText: text("template_text").notNull(),
    useCase: text("use_case").notNull().default("proposal"),
    isActive: boolean("is_active").notNull().default(true),
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
    index("client_message_templates_use_case_idx").on(table.useCase),
    index("client_message_templates_active_idx").on(table.isActive),
  ],
);

export const insertFreelanceProfileSchema = createInsertSchema(
  freelanceProfilesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectSourceSchema = createInsertSchema(projectSourcesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertFreelanceProjectSchema = createInsertSchema(
  freelanceProjectsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProposalVersionSchema = createInsertSchema(
  proposalVersionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProposalOutcomeSchema = createInsertSchema(
  proposalOutcomesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientMessageTemplateSchema = createInsertSchema(
  clientMessageTemplatesTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type FreelanceProfile = typeof freelanceProfilesTable.$inferSelect;
export type ProjectSource = typeof projectSourcesTable.$inferSelect;
export type FreelanceProject = typeof freelanceProjectsTable.$inferSelect;
export type ProposalVersion = typeof proposalVersionsTable.$inferSelect;
export type ProposalOutcome = typeof proposalOutcomesTable.$inferSelect;
export type ClientMessageTemplate = typeof clientMessageTemplatesTable.$inferSelect;
export type InsertFreelanceProfile = z.infer<typeof insertFreelanceProfileSchema>;
export type InsertProjectSource = z.infer<typeof insertProjectSourceSchema>;
export type InsertFreelanceProject = z.infer<typeof insertFreelanceProjectSchema>;
export type InsertProposalVersion = z.infer<typeof insertProposalVersionSchema>;
export type InsertProposalOutcome = z.infer<typeof insertProposalOutcomeSchema>;
export type InsertClientMessageTemplate = z.infer<typeof insertClientMessageTemplateSchema>;
