import { sql } from "drizzle-orm";
import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

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
  keywords: text("keywords").array().default(sql`'{}'::text[]`),
  isActive: boolean("is_active").default(true).notNull(),
  lastFetchedAt: timestamp("last_fetched_at"),
  lastSuccessAt: timestamp("last_success_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertJobSourceSchema = createInsertSchema(jobSourcesTable).pick({
  key: true,
  name: true,
  feedUrl: true,
  sourceType: true,
  category: true,
  keywords: true,
  isActive: true,
});

export type JobSource = typeof jobSourcesTable.$inferSelect;
export type InsertJobSource = typeof jobSourcesTable.$inferInsert;

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
  tags: text("tags").array().default(sql`'{}'::text[]`),
  jobType: text("job_type"),
  workplaceType: text("workplace_type"),
  publishedAt: timestamp("published_at"),
  isActive: boolean("is_active").default(true).notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertJobListingSchema = createInsertSchema(jobListingsTable).pick({
  sourceId: true,
  sourceKey: true,
  sourceItemId: true,
  sourceUrl: true,
  title: true,
  company: true,
  location: true,
  summary: true,
  tags: true,
  jobType: true,
  workplaceType: true,
  publishedAt: true,
});

export type JobListing = typeof jobListingsTable.$inferSelect;
export type InsertJobListing = typeof jobListingsTable.$inferInsert;

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
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertTrendsCacheSchema = createInsertSchema(trendsCacheTable).pick({
  queryHash: true,
  jobTitle: true,
  location: true,
  experienceLevel: true,
  salaryTarget: true,
  analysisJson: true,
  jobMatchesCount: true,
  expiresAt: true,
});

export type TrendsCache = typeof trendsCacheTable.$inferSelect;
export type InsertTrendsCache = typeof trendsCacheTable.$inferInsert;

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
