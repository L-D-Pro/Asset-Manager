import { pgTable, text, serial, timestamp, integer, boolean, jsonb, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Job Sources — RSS/Atom feed configurations for job aggregation.
 * Ported and adapted from Portfolio Studio's job board.
 */
export const jobSourcesTable = pgTable("job_sources", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  feedUrl: text("feed_url").notNull(),
  sourceType: text("source_type").notNull().default("rss"),
  category: text("category").default("general"),
  keywords: text("keywords").array().default([]),
  isActive: boolean("is_active").default(true).notNull(),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("job_sources_category_idx").on(table.category),
  index("job_sources_active_idx").on(table.isActive),
]);

export const insertJobSourceSchema = createInsertSchema(jobSourcesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type JobSource = typeof jobSourcesTable.$inferSelect;
export type InsertJobSource = z.infer<typeof insertJobSourceSchema>;

/**
 * Job Listings — aggregated job postings from RSS feeds.
 */
export const jobListingsTable = pgTable("job_listings", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull().references(() => jobSourcesTable.id, { onDelete: "cascade" }),
  sourceKey: text("source_key").notNull(),
  sourceItemId: text("source_item_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location"),
  summary: text("summary"),
  tags: text("tags").array().default([]),
  jobType: text("job_type"),
  workplaceType: text("workplace_type"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  unique().on(table.sourceKey, table.sourceItemId),
  index("job_listings_source_id_idx").on(table.sourceId),
  index("job_listings_active_idx").on(table.isActive),
  index("job_listings_published_idx").on(table.publishedAt),
]);

export const insertJobListingSchema = createInsertSchema(jobListingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type JobListing = typeof jobListingsTable.$inferSelect;
export type InsertJobListing = z.infer<typeof insertJobListingSchema>;

/**
 * Trends Cache — stores AI-generated market research with TTL.
 */
export const trendsCacheTable = pgTable("trends_cache", {
  id: serial("id").primaryKey(),
  queryHash: text("query_hash").notNull().unique(),
  jobTitle: text("job_title").notNull(),
  location: text("location"),
  experienceLevel: text("experience_level"),
  salaryTarget: integer("salary_target"),
  analysisJson: jsonb("analysis_json").notNull().$type<MarketAnalysis>(),
  jobMatchesCount: integer("job_matches_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("trends_cache_job_title_idx").on(table.jobTitle),
  index("trends_cache_expires_idx").on(table.expiresAt),
]);

export const insertTrendsCacheSchema = createInsertSchema(trendsCacheTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TrendsCache = typeof trendsCacheTable.$inferSelect;
export type InsertTrendsCache = z.infer<typeof insertTrendsCacheSchema>;

/**
 * Market Analysis JSON structure (stored in trendsCache.analysisJson).
 */
export interface MarketAnalysis {
  marketOverview: {
    demandLevel: "high" | "medium" | "low";
    competition: "high" | "medium" | "low";
    salaryAlignment: "above" | "at" | "below-market";
    summary: string;
  };
  requiredSkills: Array<{
    skill: string;
    frequency: "required" | "common" | "nice-to-have";
    category: "technical" | "soft" | "domain";
  }>;
  certifications: Array<{
    name: string;
    demand: "high" | "medium" | "low";
    estimatedValue: string;
    provider: string;
  }>;
  trends: {
    emerging: string[];
    declining: string[];
    industryShifts: string[];
  };
  actionPlan: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  salaryInsights: {
    rangeLow: number;
    rangeHigh: number;
    median: number;
    factors: string[];
  };
}
