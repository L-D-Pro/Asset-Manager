import { Router, type IRouter } from "express";
import { eq, and, gte } from "drizzle-orm";
import { db, trendsCacheTable, jobListingsTable, jobSourcesTable } from "@workspace/db";
import { ResearchTrendsBody } from "@workspace/api-zod";
import { runMarketResearchPipeline } from "../lib/pipelines/market-research.js";
import { createHash } from "crypto";

const router: IRouter = Router();

function hashQuery(input: {
  jobTitle: string;
  location?: string;
  experienceLevel?: string;
  salaryTarget?: number;
}): string {
  const data = `${input.jobTitle}|${input.location || ""}|${input.experienceLevel || ""}|${input.salaryTarget || ""}`;
  return createHash("sha256").update(data).digest("hex").slice(0, 32);
}

router.post("/trends/research", async (req, res): Promise<void> => {
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
    .where(
      and(
        eq(trendsCacheTable.queryHash, queryHash),
        gte(trendsCacheTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (cached) {
    const matches = await db
      .select()
      .from(jobListingsTable)
      .innerJoin(jobSourcesTable, eq(jobListingsTable.sourceId, jobSourcesTable.id))
      .where(
        and(eq(jobListingsTable.isActive, true), eq(jobSourcesTable.isActive, true)),
      )
      .limit(10);

    res.json({
      analysis: cached.analysisJson,
      jobMatches: matches.map((m) => m.job_listings),
      cached: true,
    });
    return;
  }

  // Generate new analysis
  const analysis = await runMarketResearchPipeline({
    jobTitle,
    location,
    experienceLevel,
    salaryTarget,
  });

  // Find matching jobs
  const searchTerms = jobTitle.toLowerCase().split(" ");
  const allListings = await db
    .select()
    .from(jobListingsTable)
    .innerJoin(jobSourcesTable, eq(jobListingsTable.sourceId, jobSourcesTable.id))
    .where(
      and(eq(jobListingsTable.isActive, true), eq(jobSourcesTable.isActive, true)),
    )
    .limit(50);

  const jobMatches = allListings
    .filter((m) =>
      searchTerms.some((term) =>
        m.job_listings.title.toLowerCase().includes(term),
      ),
    )
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
