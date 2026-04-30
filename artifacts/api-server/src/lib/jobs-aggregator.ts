import { DOMParser } from "@xmldom/xmldom";
import { and, desc, eq } from "drizzle-orm";
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
      .filter(
        (item): item is SourceSeed =>
          Boolean(item?.key && item?.name && item?.feedUrl),
      )
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XmlNode = any;

function textOf(node: XmlNode, tagNames: string[]): string {
  if (!node) return "";
  for (const tagName of tagNames) {
    const el = node.getElementsByTagName(tagName)?.[0];
    const value = el?.textContent?.trim();
    if (value) return value;
  }
  return "";
}

function attrOf(node: XmlNode, tagName: string, attrName: string): string {
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
  if (haystack.includes("on-site") || haystack.includes("onsite") || haystack.includes("in office"))
    return "onsite";
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

export class JobsAggregator {
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

    // Deactivate listings older than 30 days via raw SQL (Drizzle doesn't have a clean way to do this)
    await db.execute(
      `UPDATE job_listings SET is_active = false WHERE published_at < NOW() - INTERVAL '30 days'`,
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

    // Ensure source exists in DB (upsert by key)
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
        .onConflictDoNothing({
          target: [jobListingsTable.sourceKey, jobListingsTable.sourceItemId],
        });

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
    const xmlDoc = doc as unknown as XmlNode;
    const items = xmlDoc.getElementsByTagName("item") as XmlNode[];
    const entries = xmlDoc.getElementsByTagName("entry") as XmlNode[];
    const nodes = items.length > 0 ? items : entries;
    const results: ParsedJobListing[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const title = decodeHtml(textOf(node, ["title"]));
      const description = decodeHtml(
        textOf(node, ["description", "summary", "content"]),
      );
      const link =
        attrOf(node, "link", "href") || textOf(node, ["link"]);
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

  async getLatest(
    limit: number,
  ): Promise<
    Array<{
      job_listings: typeof jobListingsTable.$inferSelect;
      job_sources: typeof jobSourcesTable.$inferSelect;
    }>
  > {
    return db
      .select()
      .from(jobListingsTable)
      .innerJoin(
        jobSourcesTable,
        eq(jobListingsTable.sourceId, jobSourcesTable.id),
      )
      .where(
        and(
          eq(jobListingsTable.isActive, true),
          eq(jobSourcesTable.isActive, true),
        ),
      )
      .orderBy(desc(jobListingsTable.publishedAt), desc(jobListingsTable.createdAt))
      .limit(limit);
  }

  async getStatus(): Promise<{ sourceCount: number; listingCount: number }> {
    const sourceResult = await db
      .select({ count: jobSourcesTable.id })
      .from(jobSourcesTable);
    const listingResult = await db
      .select({ count: jobListingsTable.id })
      .from(jobListingsTable);
    return {
      sourceCount: sourceResult.length,
      listingCount: listingResult.length,
    };
  }
}

export const jobsAggregator = new JobsAggregator();
