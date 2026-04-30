import { Router, type IRouter } from "express";
import { and, desc, eq, like } from "drizzle-orm";
import { db, jobListingsTable, jobSourcesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/job-board/listings", async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit || 10), 50);
  const search = String(req.query.search || "");
  const location = String(req.query.location || "");

  let conditions = and(
    eq(jobListingsTable.isActive, true),
    eq(jobSourcesTable.isActive, true),
  );

  if (search) {
    conditions = and(conditions, like(jobListingsTable.title, `%${search}%`));
  }

  if (location) {
    conditions = and(
      conditions,
      like(jobListingsTable.location, `%${location}%`),
    );
  }

  const listings = await db
    .select()
    .from(jobListingsTable)
    .innerJoin(jobSourcesTable, eq(jobListingsTable.sourceId, jobSourcesTable.id))
    .where(conditions)
    .orderBy(desc(jobListingsTable.publishedAt))
    .limit(limit);

  const sources = await db.select().from(jobSourcesTable);
  const allListings = await db.select().from(jobListingsTable);

  res.json({
    jobs: listings.map((l) => l.job_listings),
    meta: {
      sourceCount: sources.length,
      listingCount: allListings.length,
    },
  });
});

router.get("/job-board/sources", async (_req, res): Promise<void> => {
  const sources = await db
    .select()
    .from(jobSourcesTable)
    .orderBy(jobSourcesTable.name);
  res.json(sources);
});

export default router;
