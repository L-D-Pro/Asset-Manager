import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import { db, applicationsTable, eventLogsTable } from "@workspace/db";
import {
  ListApplicationsQueryParams,
  ListApplicationsResponse,
  CreateApplicationBody,
  GetApplicationParams,
  GetApplicationResponse,
  UpdateApplicationParams,
  UpdateApplicationBody,
  UpdateApplicationResponse,
  DeleteApplicationParams,
  GetApplicationStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * Writes an EventLog entry for an application status transition.
 * Called automatically on create and update when status changes.
 */
async function writeApplicationEventLog(opts: {
  applicationId: number;
  jobId: number;
  previousState: string | null;
  nextState: string;
  actorType?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(eventLogsTable).values({
    entityType: "application",
    entityId: opts.applicationId,
    applicationId: opts.applicationId,
    jobId: opts.jobId,
    eventType: "status_transition",
    previousState: opts.previousState,
    nextState: opts.nextState,
    actorType: opts.actorType ?? "user",
    metadata: opts.metadata ?? {},
  });
}

router.get("/applications/stats", async (req, res): Promise<void> => {
  req.log.info("Fetching application stats");

  const rows = await db
    .select({ status: applicationsTable.status, cnt: count() })
    .from(applicationsTable)
    .groupBy(applicationsTable.status);

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    byStatus[row.status] = Number(row.cnt);
    total += Number(row.cnt);
  }

  const responseStatuses = ["phone_screen", "interview", "offer_received", "hired", "rejected", "ghosted"];
  const interviewStatuses = ["interview", "offer_received", "hired"];
  const offerStatuses = ["offer_received", "hired"];

  const responseCount = responseStatuses.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0);
  const interviewCount = interviewStatuses.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0);
  const offerCount = offerStatuses.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0);

  const responseRate = total > 0 ? responseCount / total : 0;
  const interviewRate = total > 0 ? interviewCount / total : 0;
  const offerRate = total > 0 ? offerCount / total : 0;

  res.json(
    GetApplicationStatsResponse.parse({
      total,
      byStatus,
      responseRate,
      interviewRate,
      offerRate,
    }),
  );
});

router.get("/applications", async (req, res): Promise<void> => {
  req.log.info("Listing applications");
  const query = ListApplicationsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.status != null) {
    conditions.push(eq(applicationsTable.status, query.data.status));
  }
  if (query.data.jobId != null) {
    conditions.push(eq(applicationsTable.jobId, query.data.jobId));
  }

  const rows = await db
    .select()
    .from(applicationsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(applicationsTable.createdAt);
  res.json(ListApplicationsResponse.parse(rows));
});

router.post("/applications", async (req, res): Promise<void> => {
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid create application body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .insert(applicationsTable)
    .values(parsed.data)
    .returning();

  await writeApplicationEventLog({
    applicationId: row.id,
    jobId: row.jobId,
    previousState: null,
    nextState: row.status,
    metadata: { applyMode: row.applyMode },
  });

  req.log.info({ applicationId: row.id, jobId: row.jobId, status: row.status }, "Application created");
  res.status(201).json(GetApplicationResponse.parse(row));
});

router.get("/applications/:id", async (req, res): Promise<void> => {
  const params = GetApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  res.json(GetApplicationResponse.parse(row));
});

router.patch("/applications/:id", async (req, res): Promise<void> => {
  const params = UpdateApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid update application body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const [row] = await db
    .update(applicationsTable)
    .set(parsed.data)
    .where(eq(applicationsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if (parsed.data.status != null && parsed.data.status !== existing.status) {
    await writeApplicationEventLog({
      applicationId: row.id,
      jobId: row.jobId,
      previousState: existing.status,
      nextState: row.status,
    });
    req.log.info(
      { applicationId: row.id, from: existing.status, to: row.status },
      "Application status transitioned",
    );
  }

  res.json(UpdateApplicationResponse.parse(row));
});

router.delete("/applications/:id", async (req, res): Promise<void> => {
  const params = DeleteApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(applicationsTable)
    .where(eq(applicationsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
