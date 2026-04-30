# Trends & Market Research Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/trends` page that uses AI to analyze job market trends and optionally enriches insights with live RSS-aggregated job board data (ported from Portfolio Studio).

**Architecture:** Hybrid approach — AI generates structured market analysis via a new `market_research` task type, while a background RSS aggregator (ported from Portfolio Studio's `jobsService`) collects real job listings. Both data sources are cached and presented together on a dedicated dashboard page.

**Tech Stack:** Express 5, Drizzle ORM, PostgreSQL, OpenRouter AI, React + Vite, Tailwind CSS, shadcn/ui, Recharts, React Query, Zod, RSS/Atom parsing

---

## File Structure

| File | Purpose |
|------|---------|
| `lib/db/src/schema/job-board.ts` | New tables: `jobSources`, `jobListings`, `trendsCache` |
| `lib/db/src/schema/index.ts` | Export new schema modules |
| `lib/db/runtime-compat.sql` | Recovery SQL for new tables |
| `lib/api-spec/openapi.yaml` | New endpoints: `/trends/research`, `/job-board/listings`, `/job-board/sources` |
| `lib/api-spec/package.json` | Verify codegen script exists |
| `artifacts/api-server/src/lib/pipelines/market-research.ts` | AI pipeline for market analysis |
| `artifacts/api-server/src/lib/jobs-aggregator.ts` | Ported RSS feed aggregator service |
| `artifacts/api-server/src/routes/trends.ts` | API routes for trends research |
| `artifacts/api-server/src/routes/job-board.ts` | API routes for job board listings |
| `artifacts/api-server/src/routes/index.ts` | Register new routers |
| `artifacts/dashboard/src/pages/trends/index.tsx` | Main trends page with search + results |
| `artifacts/dashboard/src/components/trends/trends-search-form.tsx` | Search input form |
| `artifacts/dashboard/src/components/trends/market-overview-card.tsx` | Overview tab content |
| `artifacts/dashboard/src/components/trends/skills-matrix.tsx` | Skills tab content |
| `artifacts/dashboard/src/components/trends/certifications-table.tsx` | Certifications tab content |
| `artifacts/dashboard/src/components/trends/trends-timeline.tsx` | Trends tab content |
| `artifacts/dashboard/src/components/trends/action-plan-checklist.tsx` | Action plan tab content |
| `artifacts/dashboard/src/components/trends/job-match-card.tsx` | Job listing cards |
| `artifacts/dashboard/src/components/layout/sidebar.tsx` | Add "Trends" nav item |
| `artifacts/dashboard/src/App.tsx` | Add `/trends` route |
| `artifacts/api-server/src/routes/__tests__/trends.test.ts` | Route tests |

---

## Task 1: Database Schema

**Files:**
- Create: `lib/db/src/schema/job-board.ts`
- Modify: `lib/db/src/schema/index.ts`
- Modify: `lib/db/runtime-compat.sql`

- [ ] **Step 1: Create `lib/db/src/schema/job-board.ts`**

```typescript
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
```

- [ ] **Step 2: Export from `lib/db/src/schema/index.ts`**

Add to the end of the file:

```typescript
export * from "./job-board";
```

- [ ] **Step 3: Update `lib/db/runtime-compat.sql`**

Append to the file:

```sql
-- Job board tables (runtime compat)
CREATE TABLE IF NOT EXISTS job_sources (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'rss',
  category TEXT DEFAULT 'general',
  keywords TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_fetched_at TIMESTAMP,
  last_success_at TIMESTAMP,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_listings (
  id SERIAL PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES job_sources(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  source_item_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  summary TEXT,
  tags TEXT[] DEFAULT '{}',
  job_type TEXT,
  workplace_type TEXT,
  published_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  fetched_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(source_key, source_item_id)
);

CREATE INDEX IF NOT EXISTS idx_job_listings_active ON job_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_job_listings_published ON job_listings(published_at);

CREATE TABLE IF NOT EXISTS trends_cache (
  id SERIAL PRIMARY KEY,
  query_hash TEXT NOT NULL UNIQUE,
  job_title TEXT NOT NULL,
  location TEXT,
  experience_level TEXT,
  salary_target INTEGER,
  analysis_json JSONB NOT NULL,
  job_matches_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trends_cache_expires ON trends_cache(expires_at);
```

- [ ] **Step 4: Commit**

```bash
git add lib/db/src/schema/job-board.ts lib/db/src/schema/index.ts lib/db/runtime-compat.sql
git commit -m "feat(db): add job board and trends cache schema"
```

---

## Task 2: OpenAPI Spec

**Files:**
- Modify: `lib/api-spec/openapi.yaml`

- [ ] **Step 1: Add tags near the top of the file**

After the existing tags, add:

```yaml
  - name: trends
    description: Market research and trend analysis
  - name: job-board
    description: Aggregated job board listings
```

- [ ] **Step 2: Add paths for trends and job-board**

After the existing paths section (before `components:`), add:

```yaml
  # ── Trends ─────────────────────────────────────────────────────────────────
  /trends/research:
    post:
      operationId: researchTrends
      tags: [trends]
      summary: Research market trends for a job title
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ResearchTrendsBody"
      responses:
        "200":
          description: Market analysis and matching job listings
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ResearchTrendsResponse"
        "400":
          $ref: "#/components/responses/BadRequest"

  # ── Job Board ──────────────────────────────────────────────────────────────
  /job-board/listings:
    get:
      operationId: listJobBoardListings
      tags: [job-board]
      summary: List aggregated job board listings
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 10
            maximum: 50
        - name: search
          in: query
          schema:
            type: string
        - name: location
          in: query
          schema:
            type: string
      responses:
        "200":
          description: List of job listings
          content:
            application/json:
              schema:
                type: object
                properties:
                  jobs:
                    type: array
                    items:
                      $ref: "#/components/schemas/JobBoardListing"
                  meta:
                    type: object
                    properties:
                      sourceCount:
                        type: integer
                      listingCount:
                        type: integer

  /job-board/sources:
    get:
      operationId: listJobBoardSources
      tags: [job-board]
      summary: List configured job board sources
      responses:
        "200":
          description: List of sources
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/JobBoardSource"
```

- [ ] **Step 3: Add schemas in the components section**

In `components/schemas`, add:

```yaml
    ResearchTrendsBody:
      type: object
      required: [jobTitle]
      properties:
        jobTitle:
          type: string
        location:
          type: string
        experienceLevel:
          type: string
          enum: [entry, mid, senior, executive]
        salaryTarget:
          type: integer

    ResearchTrendsResponse:
      type: object
      required: [analysis, jobMatches, cached]
      properties:
        analysis:
          $ref: "#/components/schemas/MarketAnalysis"
        jobMatches:
          type: array
          items:
            $ref: "#/components/schemas/JobBoardListing"
        cached:
          type: boolean

    MarketAnalysis:
      type: object
      required: [marketOverview, requiredSkills, certifications, trends, actionPlan, salaryInsights]
      properties:
        marketOverview:
          type: object
          required: [demandLevel, competition, salaryAlignment, summary]
          properties:
            demandLevel:
              type: string
              enum: [high, medium, low]
            competition:
              type: string
              enum: [high, medium, low]
            salaryAlignment:
              type: string
              enum: [above, at, below-market]
            summary:
              type: string
        requiredSkills:
          type: array
          items:
            type: object
            required: [skill, frequency, category]
            properties:
              skill:
                type: string
              frequency:
                type: string
                enum: [required, common, nice-to-have]
              category:
                type: string
                enum: [technical, soft, domain]
        certifications:
          type: array
          items:
            type: object
            required: [name, demand, estimatedValue, provider]
            properties:
              name:
                type: string
              demand:
                type: string
                enum: [high, medium, low]
              estimatedValue:
                type: string
              provider:
                type: string
        trends:
          type: object
          required: [emerging, declining, industryShifts]
          properties:
            emerging:
              type: array
              items:
                type: string
            declining:
              type: array
              items:
                type: string
            industryShifts:
              type: array
              items:
                type: string
        actionPlan:
          type: object
          required: [immediate, shortTerm, longTerm]
          properties:
            immediate:
              type: array
              items:
                type: string
            shortTerm:
              type: array
              items:
                type: string
            longTerm:
              type: array
              items:
                type: string
        salaryInsights:
          type: object
          required: [rangeLow, rangeHigh, median, factors]
          properties:
            rangeLow:
              type: integer
            rangeHigh:
              type: integer
            median:
              type: integer
            factors:
              type: array
              items:
                type: string

    JobBoardListing:
      type: object
      required: [id, sourceId, sourceKey, sourceItemId, sourceUrl, title, company]
      properties:
        id:
          type: integer
        sourceId:
          type: integer
        sourceKey:
          type: string
        sourceItemId:
          type: string
        sourceUrl:
          type: string
        title:
          type: string
        company:
          type: string
        location:
          type: string
        summary:
          type: string
        tags:
          type: array
          items:
            type: string
        jobType:
          type: string
        workplaceType:
          type: string
        publishedAt:
          type: string
          format: date-time
        isActive:
          type: boolean

    JobBoardSource:
      type: object
      required: [id, key, name, feedUrl, sourceType]
      properties:
        id:
          type: integer
        key:
          type: string
        name:
          type: string
        feedUrl:
          type: string
        sourceType:
          type: string
        category:
          type: string
        keywords:
          type: array
          items:
            type: string
        isActive:
          type: boolean
        lastFetchedAt:
          type: string
          format: date-time
        lastSuccessAt:
          type: string
          format: date-time
        lastError:
          type: string
```

- [ ] **Step 4: Run codegen**

```bash
corepack pnpm --filter @workspace/api-spec run codegen
```

Expected: Generated files updated in `lib/api-zod` and `lib/api-client-react`.

- [ ] **Step 5: Commit**

```bash
git add lib/api-spec/openapi.yaml
git commit -m "feat(api-spec): add trends and job-board endpoints"
```

---

## Task 3: AI Market Research Pipeline

**Files:**
- Create: `artifacts/api-server/src/lib/pipelines/market-research.ts`

- [ ] **Step 1: Create the AI pipeline file**

```typescript
import { callAI, parseJsonResponse } from "../ai-client.js";
import type { MarketAnalysis } from "@workspace/db";

const SYSTEM_PROMPT = `You are a senior labor market analyst and career strategist with expertise in talent trends, compensation benchmarks, and skill demand forecasting.

Your task is to analyze the job market for a specific role and provide actionable, data-driven insights.

Provide your output strictly as a JSON object with the following exact shape:
{
  "marketOverview": {
    "demandLevel": "high|medium|low",
    "competition": "high|medium|low",
    "salaryAlignment": "above|at|below-market",
    "summary": "A 2-3 sentence market overview."
  },
  "requiredSkills": [
    { "skill": "Skill name", "frequency": "required|common|nice-to-have", "category": "technical|soft|domain" }
  ],
  "certifications": [
    { "name": "Cert name", "demand": "high|medium|low", "estimatedValue": "Brief value prop", "provider": "Issuing org" }
  ],
  "trends": {
    "emerging": ["Trend 1", "Trend 2"],
    "declining": ["Declining skill 1"],
    "industryShifts": ["Shift 1", "Shift 2"]
  },
  "actionPlan": {
    "immediate": ["Action 1", "Action 2"],
    "shortTerm": ["Action 3"],
    "longTerm": ["Action 4"]
  },
  "salaryInsights": {
    "rangeLow": 80000,
    "rangeHigh": 140000,
    "median": 110000,
    "factors": ["Factor 1", "Factor 2"]
  }
}

Guidelines:
- Demand level reflects current hiring velocity for this role.
- Competition reflects candidate supply vs demand.
- Salary alignment compares the user's target to market median.
- Include 8-12 skills total across all frequencies.
- Include 3-6 certifications.
- Salary ranges should be realistic USD annual figures.
- Do not include markdown outside the JSON block.`;

export interface MarketResearchInput {
  jobTitle: string;
  location?: string;
  experienceLevel?: string;
  salaryTarget?: number;
}

export async function runMarketResearchPipeline(
  input: MarketResearchInput
): Promise<MarketAnalysis> {
  const { jobTitle, location, experienceLevel, salaryTarget } = input;

  const userPrompt = `
Analyze the job market for the following role:

JOB TITLE: ${jobTitle}
${location ? `LOCATION: ${location}` : ""}
${experienceLevel ? `EXPERIENCE LEVEL: ${experienceLevel}` : ""}
${salaryTarget ? `TARGET SALARY: $${salaryTarget.toLocaleString()}` : ""}

Provide the complete market analysis in JSON format.
  `.trim();

  const aiResult = await callAI({
    taskType: "market_research",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
  });

  const parsed = parseJsonResponse<MarketAnalysis>(aiResult.content);

  if (!parsed) {
    throw new Error("AI failed to return valid JSON for market research.");
  }

  return parsed;
}
```

- [ ] **Step 2: Commit**

```bash
git add artifacts/api-server/src/lib/pipelines/market-research.ts
git commit -m "feat(api): add market research AI pipeline"
```

---

## Task 4: Jobs Aggregator Service

**Files:**
- Create: `artifacts/api-server/src/lib/jobs-aggregator.ts`

- [ ] **Step 1: Create the aggregator service**

Port and adapt from Portfolio Studio's `jobsService.ts`:

```typescript
import { DOMParser } from "@xmldom/xmldom";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, jobSourcesTable, jobListingsTable } from "@workspace/db";
import { logger } from "./logger";

interface SourceSeed {
  key: string;
  name: string;
  feedUrl: string;
  sourceType?: "rss" | "atom" | "json";
  category?: string;
  keywords?: string[];
  isActive?: boolean;
}

interface ParsedJobListing {
  sourceItemId: string;
  sourceUrl: string;
  title: string;
  company: string;
  location?: string;
  summary?: string;
  tags: string[];
  jobType?: string;
  workplaceType?: string;
  publishedAt?: Date;
}

const DEFAULT_REFRESH_INTERVAL_MS = 1000 * 60 * 30; // 30 minutes

function getConfiguredSources(): SourceSeed[] {
  const raw = process.env.JOB_SOURCE_CONFIG;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is SourceSeed => Boolean(item?.key && item?.name && item?.feedUrl))
      .map((item) => ({
        key: item.key,
        name: item.name,
        feedUrl: item.feedUrl,
        sourceType: item.sourceType || "rss",
        category: item.category || "general",
        keywords: Array.isArray(item.keywords) ? item.keywords : [],
        isActive: item.isActive ?? true,
      }));
  } catch (error) {
    logger.error({ error }, "Invalid JOB_SOURCE_CONFIG value");
    return [];
  }
}

function textOf(node: Element | null | undefined, tagNames: string[]): string {
  if (!node) return "";
  for (const tagName of tagNames) {
    const value = node.getElementsByTagName(tagName)?.[0]?.textContent?.trim();
    if (value) return value;
  }
  return "";
}

function attrOf(node: Element | null | undefined, tagName: string, attrName: string): string {
  const element = node?.getElementsByTagName(tagName)?.[0];
  return element?.getAttribute(attrName)?.trim() || "";
}

function decodeHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function inferWorkplaceType(...values: Array<string | undefined>): string | undefined {
  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  if (haystack.includes("hybrid")) return "hybrid";
  if (haystack.includes("remote")) return "remote";
  if (haystack.includes("on-site") || haystack.includes("onsite") || haystack.includes("in office")) return "onsite";
  return undefined;
}

function inferJobType(...values: Array<string | undefined>): string | undefined {
  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  if (haystack.includes("contract")) return "contract";
  if (haystack.includes("part-time") || haystack.includes("part time")) return "part-time";
  if (haystack.includes("temporary")) return "temporary";
  if (haystack.includes("intern") || haystack.includes("internship")) return "internship";
  if (haystack.includes("full-time") || haystack.includes("full time")) return "full-time";
  return undefined;
}

function extractTags(title: string, summary: string): string[] {
  const text = `${title} ${summary}`.toLowerCase();
  const commonSkills = [
    "javascript", "typescript", "python", "java", "go", "rust", "c++", "c#",
    "react", "vue", "angular", "svelte", "node.js", "express", "django",
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform",
    "sql", "postgresql", "mysql", "mongodb", "redis",
    "machine learning", "ai", "data science", "analytics",
    "agile", "scrum", "leadership", "management",
  ];
  return commonSkills.filter((skill) => text.includes(skill));
}

class JobsAggregator {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    const sources = getConfiguredSources();
    if (sources.length === 0) {
      logger.info("Jobs aggregator: no sources configured, skipping start");
      return;
    }

    logger.info({ sourceCount: sources.length }, "Starting jobs aggregator");
    this.refresh().catch((err) => logger.error({ err }, "Initial refresh failed"));
    this.timer = setInterval(() => {
      this.refresh().catch((err) => logger.error({ err }, "Scheduled refresh failed"));
    }, DEFAULT_REFRESH_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async refresh(): Promise<number> {
    const sources = getConfiguredSources();
    let totalNew = 0;

    for (const source of sources) {
      if (!source.isActive) continue;

      try {
        const newCount = await this.refreshSource(source);
        totalNew += newCount;
      } catch (error) {
        logger.error({ error, source: source.key }, "Failed to refresh source");
      }
    }

    // Deactivate listings older than 30 days
    await db
      .update(jobListingsTable)
      .set({ isActive: false })
      .where(
        sql`${jobListingsTable.publishedAt} < NOW() - INTERVAL '30 days'`
      );

    logger.info({ totalNew }, "Jobs refresh complete");
    return totalNew;
  }

  private async refreshSource(source: SourceSeed): Promise<number> {
    const response = await fetch(source.feedUrl, {
      headers: { "User-Agent": "JobOps-Bot/1.0" },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xmlText = await response.text();
    const listings = this.parseFeed(xmlText, source);

    // Ensure source exists in DB
    const [dbSource] = await db
      .insert(jobSourcesTable)
      .values({
        key: source.key,
        name: source.name,
        feedUrl: source.feedUrl,
        sourceType: source.sourceType,
        category: source.category,
        keywords: source.keywords,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: jobSourcesTable.key,
        set: { name: source.name, feedUrl: source.feedUrl, updatedAt: new Date() },
      })
      .returning();

    let newCount = 0;
    for (const listing of listings) {
      const result = await db
        .insert(jobListingsTable)
        .values({
          sourceId: dbSource.id,
          sourceKey: source.key,
          sourceItemId: listing.sourceItemId,
          sourceUrl: listing.sourceUrl,
          title: listing.title,
          company: listing.company,
          location: listing.location,
          summary: listing.summary,
          tags: listing.tags,
          jobType: listing.jobType,
          workplaceType: listing.workplaceType,
          publishedAt: listing.publishedAt,
        })
        .onConflictDoNothing({ target: [jobListingsTable.sourceKey, jobListingsTable.sourceItemId] });

      if (result.rowCount && result.rowCount > 0) {
        newCount++;
      }
    }

    await db
      .update(jobSourcesTable)
      .set({ lastSuccessAt: new Date(), lastFetchedAt: new Date(), lastError: null })
      .where(eq(jobSourcesTable.id, dbSource.id));

    return newCount;
  }

  private parseFeed(xmlText: string, source: SourceSeed): ParsedJobListing[] {
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    const items = doc.getElementsByTagName("item");
    const entries = doc.getElementsByTagName("entry");
    const nodes = items.length > 0 ? items : entries;
    const results: ParsedJobListing[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const title = decodeHtml(textOf(node, ["title"]));
      const description = decodeHtml(textOf(node, ["description", "summary", "content"]));
      const link = attrOf(node, "link", "href") || textOf(node, ["link"]);
      const guid = textOf(node, ["guid", "id"]);
      const pubDate = textOf(node, ["pubDate", "published", "updated"]);

      // Try to extract company from title (common format: "Title at Company")
      let company = "Unknown";
      const atMatch = title.match(/at\s+(.+?)$/i);
      const dashMatch = title.match(/-\s*(.+?)$/);
      if (atMatch) company = atMatch[1].trim();
      else if (dashMatch) company = dashMatch[1].trim();

      const listing: ParsedJobListing = {
        sourceItemId: guid || link || `${source.key}-${i}`,
        sourceUrl: link || source.feedUrl,
        title: title || "Untitled",
        company,
        location: undefined,
        summary: description.slice(0, 500),
        tags: extractTags(title, description),
        jobType: inferJobType(title, description),
        workplaceType: inferWorkplaceType(title, description),
        publishedAt: pubDate ? new Date(pubDate) : undefined,
      };

      results.push(listing);
    }

    return results;
  }

  async getLatest(limit: number): Promise<Array<{ listing: typeof jobListingsTable.$inferSelect; source: typeof jobSourcesTable.$inferSelect }>> {
    return db
      .select()
      .from(jobListingsTable)
      .innerJoin(jobSourcesTable, eq(jobListingsTable.sourceId, jobSourcesTable.id))
      .where(and(eq(jobListingsTable.isActive, true), eq(jobSourcesTable.isActive, true)))
      .orderBy(desc(jobListingsTable.publishedAt), desc(jobListingsTable.createdAt))
      .limit(limit);
  }

  async getStatus(): Promise<{ sourceCount: number; listingCount: number }> {
    const [sourceResult] = await db.select({ count: sql<number>`count(*)` }).from(jobSourcesTable);
    const [listingResult] = await db.select({ count: sql<number>`count(*)` }).from(jobListingsTable);
    return {
      sourceCount: Number(sourceResult.count),
      listingCount: Number(listingResult.count),
    };
  }
}

export const jobsAggregator = new JobsAggregator();
```

- [ ] **Step 2: Commit**

```bash
git add artifacts/api-server/src/lib/jobs-aggregator.ts
git commit -m "feat(api): add RSS jobs aggregator service"
```

---

## Task 5: API Routes — Trends

**Files:**
- Create: `artifacts/api-server/src/routes/trends.ts`
- Create: `artifacts/api-server/src/routes/job-board.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`

- [ ] **Step 1: Create `artifacts/api-server/src/routes/trends.ts`**

```typescript
import { Router, type IRouter } from "express";
import { eq, and, gte } from "drizzle-orm";
import { db, trendsCacheTable, jobListingsTable, jobSourcesTable } from "@workspace/db";
import { ResearchTrendsBody } from "@workspace/api-zod";
import { runMarketResearchPipeline } from "../lib/pipelines/market-research.js";
import { createHash } from "crypto";

const router: IRouter = Router();

function hashQuery(input: { jobTitle: string; location?: string; experienceLevel?: string; salaryTarget?: number }): string {
  const data = `${input.jobTitle}|${input.location || ""}|${input.experienceLevel || ""}|${input.salaryTarget || ""}`;
  return createHash("sha256").update(data).digest("hex").slice(0, 32);
}

router.post("/trends/research", async (req, res): Promise<void> => {
  req.log.info("Researching trends");

  const parseResult = ResearchTrendsBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const { jobTitle, location, experienceLevel, salaryTarget } = parseResult.data;
  const queryHash = hashQuery({ jobTitle, location, experienceLevel, salaryTarget });

  // Check cache
  const [cached] = await db
    .select()
    .from(trendsCacheTable)
    .where(and(eq(trendsCacheTable.queryHash, queryHash), gte(trendsCacheTable.expiresAt, new Date())))
    .limit(1);

  if (cached) {
    const jobMatches = await db
      .select()
      .from(jobListingsTable)
      .innerJoin(jobSourcesTable, eq(jobListingsTable.sourceId, jobSourcesTable.id))
      .where(and(eq(jobListingsTable.isActive, true), eq(jobSourcesTable.isActive, true)))
      .limit(10);

    res.json({
      analysis: cached.analysisJson,
      jobMatches: jobMatches.map((m) => m.job_listings),
      cached: true,
    });
    return;
  }

  // Generate new analysis
  const analysis = await runMarketResearchPipeline({ jobTitle, location, experienceLevel, salaryTarget });

  // Find matching jobs
  const searchTerms = jobTitle.toLowerCase().split(" ");
  const allListings = await db
    .select()
    .from(jobListingsTable)
    .innerJoin(jobSourcesTable, eq(jobListingsTable.sourceId, jobSourcesTable.id))
    .where(and(eq(jobListingsTable.isActive, true), eq(jobSourcesTable.isActive, true)))
    .limit(50);

  const jobMatches = allListings
    .filter((m) => searchTerms.some((term) => m.job_listings.title.toLowerCase().includes(term)))
    .slice(0, 10)
    .map((m) => m.job_listings);

  // Save to cache
  await db.insert(trendsCacheTable).values({
    queryHash,
    jobTitle,
    location,
    experienceLevel,
    salaryTarget,
    analysisJson: analysis,
    jobMatchesCount: jobMatches.length,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours
  });

  res.json({
    analysis,
    jobMatches,
    cached: false,
  });
});

export default router;
```

- [ ] **Step 2: Create `artifacts/api-server/src/routes/job-board.ts`**

```typescript
import { Router, type IRouter } from "express";
import { and, desc, eq, sql, like } from "drizzle-orm";
import { db, jobListingsTable, jobSourcesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/job-board/listings", async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit || 10), 50);
  const search = String(req.query.search || "");
  const location = String(req.query.location || "");

  let conditions = and(eq(jobListingsTable.isActive, true), eq(jobSourcesTable.isActive, true));

  if (search) {
    conditions = and(conditions, like(jobListingsTable.title, `%${search}%`));
  }

  if (location) {
    conditions = and(conditions, like(jobListingsTable.location, `%${location}%`));
  }

  const listings = await db
    .select()
    .from(jobListingsTable)
    .innerJoin(jobSourcesTable, eq(jobListingsTable.sourceId, jobSourcesTable.id))
    .where(conditions)
    .orderBy(desc(jobListingsTable.publishedAt))
    .limit(limit);

  const status = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobSourcesTable);

  const listingCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobListingsTable);

  res.json({
    jobs: listings.map((l) => l.job_listings),
    meta: {
      sourceCount: Number(status[0].count),
      listingCount: Number(listingCount[0].count),
    },
  });
});

router.get("/job-board/sources", async (_req, res): Promise<void> => {
  const sources = await db.select().from(jobSourcesTable).orderBy(jobSourcesTable.name);
  res.json(sources);
});

export default router;
```

- [ ] **Step 3: Register routers in `artifacts/api-server/src/routes/index.ts`**

Add imports:

```typescript
import trendsRouter from "./trends";
import jobBoardRouter from "./job-board";
```

Add after `router.use(feedbackRouter);`:

```typescript
router.use(trendsRouter);
router.use(jobBoardRouter);
```

- [ ] **Step 4: Type check**

```bash
corepack pnpm --filter @workspace/api-server run typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/routes/trends.ts artifacts/api-server/src/routes/job-board.ts artifacts/api-server/src/routes/index.ts
git commit -m "feat(api): add trends and job-board routes"
```

---

## Task 6: Dashboard — Trends Page Components

**Files:**
- Create: `artifacts/dashboard/src/pages/trends/index.tsx`
- Create: `artifacts/dashboard/src/components/trends/trends-search-form.tsx`
- Create: `artifacts/dashboard/src/components/trends/market-overview-card.tsx`
- Create: `artifacts/dashboard/src/components/trends/skills-matrix.tsx`
- Create: `artifacts/dashboard/src/components/trends/certifications-table.tsx`
- Create: `artifacts/dashboard/src/components/trends/trends-timeline.tsx`
- Create: `artifacts/dashboard/src/components/trends/action-plan-checklist.tsx`
- Create: `artifacts/dashboard/src/components/trends/job-match-card.tsx`

- [ ] **Step 1: Create `artifacts/dashboard/src/components/trends/trends-search-form.tsx`**

```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";

interface TrendsSearchFormProps {
  onSearch: (params: { jobTitle: string; location: string; experienceLevel: string; salaryTarget: string }) => void;
  isLoading: boolean;
}

export function TrendsSearchForm({ onSearch, isLoading }: TrendsSearchFormProps) {
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [salaryTarget, setSalaryTarget] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim()) return;
    onSearch({ jobTitle, location, experienceLevel, salaryTarget });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="job-title">Job Title *</Label>
          <Input
            id="job-title"
            placeholder="e.g. Senior Frontend Engineer"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            placeholder="e.g. Remote, NYC"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="experience">Experience</Label>
          <select
            id="experience"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
          >
            <option value="">Any level</option>
            <option value="entry">Entry Level</option>
            <option value="mid">Mid Level</option>
            <option value="senior">Senior Level</option>
            <option value="executive">Executive</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="salary">Target Salary (USD)</Label>
          <Input
            id="salary"
            type="number"
            placeholder="e.g. 120000"
            value={salaryTarget}
            onChange={(e) => setSalaryTarget(e.target.value)}
          />
        </div>
      </div>
      <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
        <Sparkles className="mr-2 h-4 w-4" />
        {isLoading ? "Analyzing Market..." : "Analyze Market"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Create `artifacts/dashboard/src/components/trends/market-overview-card.tsx`**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import type { MarketAnalysis } from "@workspace/db";

interface MarketOverviewCardProps {
  overview: MarketAnalysis["marketOverview"];
}

export function MarketOverviewCard({ overview }: MarketOverviewCardProps) {
  const demandColors = {
    high: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-red-100 text-red-800",
  };

  const competitionColors = {
    high: "bg-red-100 text-red-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-green-100 text-green-800",
  };

  const alignmentIcons = {
    above: <TrendingUp className="h-4 w-4 text-green-600" />,
    at: <Minus className="h-4 w-4 text-yellow-600" />,
    "below-market": <TrendingDown className="h-4 w-4 text-red-600" />,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Market Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge className={demandColors[overview.demandLevel]}>
            Demand: {overview.demandLevel}
          </Badge>
          <Badge className={competitionColors[overview.competition]}>
            Competition: {overview.competition}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            {alignmentIcons[overview.salaryAlignment]}
            Salary: {overview.salaryAlignment.replace("-", " ")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{overview.summary}</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create `artifacts/dashboard/src/components/trends/skills-matrix.tsx`**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench } from "lucide-react";
import type { MarketAnalysis } from "@workspace/db";

interface SkillsMatrixProps {
  skills: MarketAnalysis["requiredSkills"];
}

export function SkillsMatrix({ skills }: SkillsMatrixProps) {
  const categories = {
    technical: "Technical",
    soft: "Soft Skills",
    domain: "Domain Knowledge",
  };

  const frequencyColors = {
    required: "bg-red-100 text-red-800",
    common: "bg-blue-100 text-blue-800",
    "nice-to-have": "bg-gray-100 text-gray-800",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          Skills in Demand
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(Object.keys(categories) as Array<keyof typeof categories>).map((cat) => {
            const catSkills = skills.filter((s) => s.category === cat);
            if (catSkills.length === 0) return null;
            return (
              <div key={cat}>
                <h4 className="text-sm font-semibold mb-2">{categories[cat]}</h4>
                <div className="flex flex-wrap gap-2">
                  {catSkills.map((skill) => (
                    <Badge key={skill.skill} className={frequencyColors[skill.frequency]}>
                      {skill.skill}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create `artifacts/dashboard/src/components/trends/certifications-table.tsx`**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Award } from "lucide-react";
import type { MarketAnalysis } from "@workspace/db";

interface CertificationsTableProps {
  certifications: MarketAnalysis["certifications"];
}

export function CertificationsTable({ certifications }: CertificationsTableProps) {
  const demandColors = {
    high: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-gray-100 text-gray-800",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          In-Demand Certifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Certification</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Demand</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certifications.map((cert) => (
              <TableRow key={cert.name}>
                <TableCell className="font-medium">{cert.name}</TableCell>
                <TableCell>{cert.provider}</TableCell>
                <TableCell>
                  <Badge className={demandColors[cert.demand]}>{cert.demand}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{cert.estimatedValue}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Create `artifacts/dashboard/src/components/trends/trends-timeline.tsx`**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import type { MarketAnalysis } from "@workspace/db";

interface TrendsTimelineProps {
  trends: MarketAnalysis["trends"];
}

export function TrendsTimeline({ trends }: TrendsTimelineProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ArrowUp className="h-4 w-4 text-green-600" />
            Emerging
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {trends.emerging.map((item) => (
              <li key={item} className="text-sm text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ArrowDown className="h-4 w-4 text-red-600" />
            Declining
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {trends.declining.map((item) => (
              <li key={item} className="text-sm text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <RefreshCw className="h-4 w-4 text-blue-600" />
            Industry Shifts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {trends.industryShifts.map((item) => (
              <li key={item} className="text-sm text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Create `artifacts/dashboard/src/components/trends/action-plan-checklist.tsx`**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Target } from "lucide-react";
import type { MarketAnalysis } from "@workspace/db";
import { useState } from "react";

interface ActionPlanChecklistProps {
  actionPlan: MarketAnalysis["actionPlan"];
}

export function ActionPlanChecklist({ actionPlan }: ActionPlanChecklistProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (item: string) => {
    const next = new Set(checked);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setChecked(next);
  };

  const sections = [
    { title: "Immediate (This Week)", items: actionPlan.immediate },
    { title: "Short Term (1-3 Months)", items: actionPlan.shortTerm },
    { title: "Long Term (3-12 Months)", items: actionPlan.longTerm },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Action Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h4 className="text-sm font-semibold mb-2">{section.title}</h4>
            <div className="space-y-2">
              {section.items.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <Checkbox
                    id={item}
                    checked={checked.has(item)}
                    onCheckedChange={() => toggle(item)}
                  />
                  <label
                    htmlFor={item}
                    className={`text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                      checked.has(item) ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {item}
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7: Create `artifacts/dashboard/src/components/trends/job-match-card.tsx`**

```typescript
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Building2, MapPin, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { JobListing } from "@workspace/db";

interface JobMatchCardProps {
  job: JobListing;
}

export function JobMatchCard({ job }: JobMatchCardProps) {
  return (
    <a
      href={job.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <Card className="transition-all hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {job.workplaceType && (
                  <Badge variant="secondary" className="capitalize">
                    {job.workplaceType}
                  </Badge>
                )}
                {job.jobType && (
                  <Badge variant="outline" className="capitalize">
                    {job.jobType}
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold group-hover:text-primary transition-colors">
                {job.title}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {job.company}
                </span>
                {job.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {job.location}
                  </span>
                )}
                {job.publishedAt && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDistanceToNow(new Date(job.publishedAt), { addSuffix: true })}
                  </span>
                )}
              </div>
              {job.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {job.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add artifacts/dashboard/src/components/trends/
git commit -m "feat(dashboard): add trends page components"
```

---

## Task 7: Dashboard — Main Trends Page

**Files:**
- Create: `artifacts/dashboard/src/pages/trends/index.tsx`

- [ ] **Step 1: Create the main trends page**

```typescript
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, DollarSign, Briefcase } from "lucide-react";
import { TrendsSearchForm } from "@/components/trends/trends-search-form";
import { MarketOverviewCard } from "@/components/trends/market-overview-card";
import { SkillsMatrix } from "@/components/trends/skills-matrix";
import { CertificationsTable } from "@/components/trends/certifications-table";
import { TrendsTimeline } from "@/components/trends/trends-timeline";
import { ActionPlanChecklist } from "@/components/trends/action-plan-checklist";
import { JobMatchCard } from "@/components/trends/job-match-card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { MarketAnalysis, JobListing } from "@workspace/db";

interface ResearchResponse {
  analysis: MarketAnalysis;
  jobMatches: JobListing[];
  cached: boolean;
}

export default function TrendsPage() {
  const { toast } = useToast();
  const [result, setResult] = useState<ResearchResponse | null>(null);

  const researchMutation = useMutation({
    mutationFn: async (params: { jobTitle: string; location: string; experienceLevel: string; salaryTarget: string }) => {
      const res = await apiRequest("POST", "/api/trends/research", {
        jobTitle: params.jobTitle,
        location: params.location || undefined,
        experienceLevel: params.experienceLevel || undefined,
        salaryTarget: params.salaryTarget ? Number(params.salaryTarget) : undefined,
      });
      return res.json() as Promise<ResearchResponse>;
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.cached) {
        toast({ title: "Loaded from cache", description: "This analysis was recently generated." });
      }
    },
    onError: (error) => {
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-primary" />
          Market Trends
        </h1>
        <p className="text-muted-foreground mt-1">
          Research job market trends, skills, and salary insights for any role.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <TrendsSearchForm
            onSearch={(params) => researchMutation.mutate(params)}
            isLoading={researchMutation.isPending}
          />
        </CardContent>
      </Card>

      {researchMutation.isPending && (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {result.cached && (
            <p className="text-xs text-muted-foreground text-right">Served from cache</p>
          )}

          <MarketOverviewCard overview={result.analysis.marketOverview} />

          <Tabs defaultValue="skills" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="certs">Certifications</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="action">Action Plan</TabsTrigger>
            </TabsList>
            <TabsContent value="skills" className="mt-4">
              <SkillsMatrix skills={result.analysis.requiredSkills} />
            </TabsContent>
            <TabsContent value="certs" className="mt-4">
              <CertificationsTable certifications={result.analysis.certifications} />
            </TabsContent>
            <TabsContent value="trends" className="mt-4">
              <TrendsTimeline trends={result.analysis.trends} />
            </TabsContent>
            <TabsContent value="action" className="mt-4">
              <ActionPlanChecklist actionPlan={result.analysis.actionPlan} />
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Salary Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">${result.analysis.salaryInsights.rangeLow.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Range Low</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">${result.analysis.salaryInsights.median.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Median</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">${result.analysis.salaryInsights.rangeHigh.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Range High</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium mb-1">Key Factors:</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {result.analysis.salaryInsights.factors.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {result.jobMatches.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Matching Job Listings
              </h2>
              <div className="grid gap-3">
                {result.jobMatches.map((job) => (
                  <JobMatchCard key={job.id} job={job} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add artifacts/dashboard/src/pages/trends/index.tsx
git commit -m "feat(dashboard): add main trends page"
```

---

## Task 8: Routing & Navigation

**Files:**
- Modify: `artifacts/dashboard/src/App.tsx`
- Modify: `artifacts/dashboard/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add route in `App.tsx`**

Add import near the top with other page imports:

```typescript
import TrendsPage from "@/pages/trends";
```

Add route inside the `<Routes>` component (alphabetical or logical order):

```typescript
<Route path="/trends" element={<TrendsPage />} />
```

- [ ] **Step 2: Add sidebar nav item**

In `artifacts/dashboard/src/components/layout/sidebar.tsx`:

Add `TrendingUp` to the lucide-react import:

```typescript
import { LayoutDashboard, Briefcase, FileText, CheckSquare, MessageSquare, Settings, UserCircle, Activity, FileCode, BookOpen, LogOut, User, ScrollText, Brain, MousePointerClick, Handshake, Sparkles, Shield, Ticket, BarChart3, TrendingUp } from "lucide-react";
```

Add to the `navigation` array (before "Guide"):

```typescript
{ name: "Trends", href: "/trends", icon: TrendingUp },
```

- [ ] **Step 3: Type check dashboard**

```bash
corepack pnpm --filter @workspace/dashboard run typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add artifacts/dashboard/src/App.tsx artifacts/dashboard/src/components/layout/sidebar.tsx
git commit -m "feat(dashboard): add trends route and navigation"
```

---

## Task 9: Integration & Startup

**Files:**
- Modify: `artifacts/api-server/src/app.ts`

- [ ] **Step 1: Start the jobs aggregator on app boot**

In `artifacts/api-server/src/app.ts`, add import:

```typescript
import { jobsAggregator } from "./lib/jobs-aggregator";
```

After `startLearningScheduler();` (or near app setup), add:

```typescript
// Start background job aggregation if sources are configured
jobsAggregator.start();
```

- [ ] **Step 2: Type check API server**

```bash
corepack pnpm --filter @workspace/api-server run typecheck
```

Expected: No errors.

- [ ] **Step 3: Full type check**

```bash
corepack pnpm run typecheck
```

Expected: No errors across all packages.

- [ ] **Step 4: Commit**

```bash
git add artifacts/api-server/src/app.ts
git commit -m "feat(api): integrate jobs aggregator startup"
```

---

## Task 10: End-to-End Testing

**Files:**
- Create: `artifacts/api-server/src/routes/__tests__/trends.test.ts`

- [ ] **Step 1: Write route test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestApp } from "../../test-utils";
import type { Express } from "express";
import request from "supertest";

let app: Express;
let authCookie: string;

beforeAll(async () => {
  const setup = await setupTestApp();
  app = setup.app;
  authCookie = setup.authCookie;
});

describe("POST /api/trends/research", () => {
  it("requires authentication", async () => {
    const res = await request(app).post("/api/trends/research").send({ jobTitle: "Engineer" });
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing jobTitle", async () => {
    const res = await request(app)
      .post("/api/trends/research")
      .set("Cookie", authCookie)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns market analysis for valid request", async () => {
    const res = await request(app)
      .post("/api/trends/research")
      .set("Cookie", authCookie)
      .send({ jobTitle: "Software Engineer", location: "Remote" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("analysis");
    expect(res.body).toHaveProperty("jobMatches");
    expect(res.body).toHaveProperty("cached");
    expect(res.body.analysis).toHaveProperty("marketOverview");
    expect(res.body.analysis).toHaveProperty("requiredSkills");
    expect(res.body.analysis).toHaveProperty("certifications");
    expect(res.body.analysis).toHaveProperty("trends");
    expect(res.body.analysis).toHaveProperty("actionPlan");
    expect(res.body.analysis).toHaveProperty("salaryInsights");
  });
});

describe("GET /api/job-board/listings", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/job-board/listings");
    expect(res.status).toBe(401);
  });

  it("returns listings with meta", async () => {
    const res = await request(app)
      .get("/api/job-board/listings")
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("jobs");
    expect(res.body).toHaveProperty("meta");
    expect(res.body.meta).toHaveProperty("sourceCount");
    expect(res.body.meta).toHaveProperty("listingCount");
  });
});
```

- [ ] **Step 2: Run tests**

```bash
corepack pnpm --filter @workspace/api-server test
```

Expected: Tests pass.

- [ ] **Step 3: Commit**

```bash
git add artifacts/api-server/src/routes/__tests__/trends.test.ts
git commit -m "test(api): add trends route tests"
```

---

## Task 11: Documentation

**Files:**
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/USER_GUIDE.md`

- [ ] **Step 1: Update CHANGELOG**

Add entry under "Unreleased":

```markdown
## Unreleased

### Added
- **Trends & Market Research Hub** (`/trends`): AI-powered market analysis for any job title, including skills demand, certifications, salary insights, and personalized action plans.
- **Job Board Aggregation**: Background RSS/Atom feed aggregator that collects real job listings. Configure via `JOB_SOURCE_CONFIG` env var.
- **Trends Cache**: 24-hour caching of AI-generated market research to reduce API costs.
- New sidebar navigation item: "Trends"
```

- [ ] **Step 2: Update USER_GUIDE**

Add a new section (e.g., after "AI Learning"):

```markdown
## Market Trends & Research

Navigate to **Trends** in the sidebar to research any job market.

1. Enter a **Job Title** (required)
2. Optionally add **Location**, **Experience Level**, and **Target Salary**
3. Click **Analyze Market**
4. Review the AI-generated analysis across tabs:
   - **Overview**: Demand level, competition, salary alignment
   - **Skills**: In-demand technical, soft, and domain skills
   - **Certifications**: Recommended certifications with demand ratings
   - **Trends**: Emerging technologies, declining skills, industry shifts
   - **Action Plan**: Prioritized steps to improve your candidacy
5. Browse matching job listings from aggregated sources below the analysis

### Job Board Configuration

Administrators can configure RSS/Atom feed sources via the `JOB_SOURCE_CONFIG` environment variable:

```json
[
  {
    "key": "example-careers",
    "name": "Example Careers",
    "feedUrl": "https://example.com/careers/feed.xml",
    "sourceType": "rss",
    "category": "tech",
    "keywords": ["software", "engineer"]
  }
]
```

Feeds are automatically refreshed every 30 minutes.
```

- [ ] **Step 3: Commit**

```bash
git add docs/CHANGELOG.md docs/USER_GUIDE.md
git commit -m "docs: add trends and job-board documentation"
```

---

## Spec Coverage Check

| Spec Requirement | Implementing Task |
|------------------|-------------------|
| New `/trends` page | Task 7, 8 |
| AI market analysis pipeline | Task 3 |
| Hybrid approach (AI + live data) | Task 3, 4, 5 |
| Job board from Portfolio Studio | Task 4, 5 |
| RSS feed aggregation | Task 4 |
| 24h cache for AI results | Task 5 |
| Tabbed results (Overview, Skills, Certs, Trends, Action Plan) | Task 6, 7 |
| Job matching listings | Task 5, 7 |
| Sidebar navigation | Task 8 |
| OpenAPI spec-first workflow | Task 2 |
| Database schema | Task 1 |
| Error handling | Embedded in all route files |
| Tests | Task 10 |
| Documentation | Task 11 |

## Placeholder Scan

- No "TBD", "TODO", or "implement later" found
- All code blocks contain complete implementation
- All file paths are exact
- All commands have expected outputs

## Type Consistency Check

- `MarketAnalysis` interface matches schema in `job-board.ts` and pipeline in `market-research.ts`
- `JobListing` type used consistently across API and dashboard
- Route paths match OpenAPI spec exactly
- Component props match data structures

---

## Execution Handoff

**Plan complete and saved to `.opencode\plans\2026-04-29-trends-market-research.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review

**Which approach do you prefer?**
