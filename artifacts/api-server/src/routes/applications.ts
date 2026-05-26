import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import { db, applicationsTable, eventLogsTable, jobsTable, resumeVersionsTable, coverLetterVersionsTable } from "@workspace/db";
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
import type { JobOpsRequest } from "../lib/http-types";
import { currentUserId } from "../lib/ownership";

const router: IRouter = Router();


router.get("/applications/stats", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  req.log.info("Fetching application stats");

  const rows = await db
    .select({ status: applicationsTable.status, cnt: count() })
    .from(applicationsTable)
    .where(eq(applicationsTable.userId, userId))
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

router.get("/applications", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  req.log.info("Listing applications");
  const query = ListApplicationsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [eq(applicationsTable.userId, userId)];
  if (query.data.status != null) {
    conditions.push(eq(applicationsTable.status, query.data.status));
  }
  if (query.data.jobId != null) {
    conditions.push(eq(applicationsTable.jobId, query.data.jobId));
  }

  const rows = await db
    .select()
    .from(applicationsTable)
    .where(and(...conditions))
    .orderBy(applicationsTable.createdAt);
  res.json(ListApplicationsResponse.parse(rows));
});

router.post("/applications", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid create application body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [job] = await db
    .select({ id: jobsTable.id })
    .from(jobsTable)
    .where(and(eq(jobsTable.id, parsed.data.jobId), eq(jobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (parsed.data.resumeVersionId != null) {
    const [resume] = await db.select({ id: resumeVersionsTable.id }).from(resumeVersionsTable)
      .where(and(eq(resumeVersionsTable.id, parsed.data.resumeVersionId), eq(resumeVersionsTable.userId, userId)));
    if (!resume) {
      res.status(404).json({ error: "Resume version not found" });
      return;
    }
  }
  if (parsed.data.coverLetterVersionId != null) {
    const [cover] = await db.select({ id: coverLetterVersionsTable.id }).from(coverLetterVersionsTable)
      .where(and(eq(coverLetterVersionsTable.id, parsed.data.coverLetterVersionId), eq(coverLetterVersionsTable.userId, userId)));
    if (!cover) {
      res.status(404).json({ error: "Cover letter version not found" });
      return;
    }
  }

  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(applicationsTable)
      .values({ ...parsed.data, userId })
      .returning();
    await tx.insert(eventLogsTable).values({
      userId,
      entityType: "application",
      entityId: inserted.id,
      applicationId: inserted.id,
      jobId: inserted.jobId,
      eventType: "status_transition",
      previousState: null,
      nextState: inserted.status,
      actorType: "user",
      metadata: { applyMode: inserted.applyMode },
    });
    return inserted;
  });

  req.log.info({ applicationId: row.id, jobId: row.jobId, status: row.status }, "Application created");
  res.status(201).json(GetApplicationResponse.parse(row));
});

router.get("/applications/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = GetApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(applicationsTable)
    .where(and(eq(applicationsTable.id, params.data.id), eq(applicationsTable.userId, userId)));
  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  res.json(GetApplicationResponse.parse(row));
});

router.patch("/applications/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
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
    .where(and(eq(applicationsTable.id, params.data.id), eq(applicationsTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if (parsed.data.resumeVersionId != null) {
    const [resume] = await db.select({ id: resumeVersionsTable.id }).from(resumeVersionsTable)
      .where(and(eq(resumeVersionsTable.id, parsed.data.resumeVersionId), eq(resumeVersionsTable.userId, userId)));
    if (!resume) {
      res.status(404).json({ error: "Resume version not found" });
      return;
    }
  }
  if (parsed.data.coverLetterVersionId != null) {
    const [cover] = await db.select({ id: coverLetterVersionsTable.id }).from(coverLetterVersionsTable)
      .where(and(eq(coverLetterVersionsTable.id, parsed.data.coverLetterVersionId), eq(coverLetterVersionsTable.userId, userId)));
    if (!cover) {
      res.status(404).json({ error: "Cover letter version not found" });
      return;
    }
  }

  const statusChanging =
    parsed.data.status != null && parsed.data.status !== existing.status;

  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(applicationsTable)
      .set(parsed.data)
      .where(and(eq(applicationsTable.id, params.data.id), eq(applicationsTable.userId, userId)))
      .returning();
    if (!updated) return null;

    if (statusChanging) {
      await tx.insert(eventLogsTable).values({
        userId,
        entityType: "application",
        entityId: updated.id,
        applicationId: updated.id,
        jobId: updated.jobId,
        eventType: "status_transition",
        previousState: existing.status,
        nextState: updated.status,
        actorType: "user",
        metadata: {},
      });
    }
    return updated;
  });

  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if (statusChanging) {
    req.log.info(
      { applicationId: row.id, from: existing.status, to: row.status },
      "Application status transitioned",
    );
  }

  res.json(UpdateApplicationResponse.parse(row));
});

router.delete("/applications/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = DeleteApplicationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(applicationsTable)
    .where(and(eq(applicationsTable.id, params.data.id), eq(applicationsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
