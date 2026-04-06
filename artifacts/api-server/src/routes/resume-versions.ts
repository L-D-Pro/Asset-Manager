import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, resumeVersionsTable, eventLogsTable } from "@workspace/db";
import {
  ListResumeVersionsQueryParams,
  ListResumeVersionsResponse,
  GetResumeVersionParams,
  GetResumeVersionResponse,
  UpdateResumeVersionParams,
  UpdateResumeVersionBody,
  UpdateResumeVersionResponse,
  DeleteResumeVersionParams,
  ApproveResumeVersionParams,
  ApproveResumeVersionResponse,
  RejectResumeVersionParams,
  RejectResumeVersionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/resume-versions", async (req, res): Promise<void> => {
  req.log.info("Listing resume versions");
  const query = ListResumeVersionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.jobId != null) {
    conditions.push(eq(resumeVersionsTable.jobId, query.data.jobId));
  }
  if (query.data.status != null) {
    conditions.push(eq(resumeVersionsTable.status, query.data.status));
  }

  const rows = await db
    .select()
    .from(resumeVersionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(resumeVersionsTable.createdAt);
  res.json(ListResumeVersionsResponse.parse(rows));
});

router.get("/resume-versions/:id", async (req, res): Promise<void> => {
  const params = GetResumeVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(resumeVersionsTable)
    .where(eq(resumeVersionsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Resume version not found" });
    return;
  }
  res.json(GetResumeVersionResponse.parse(row));
});

router.patch("/resume-versions/:id", async (req, res): Promise<void> => {
  const params = UpdateResumeVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateResumeVersionBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid update resume version body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(resumeVersionsTable)
    .set(parsed.data)
    .where(eq(resumeVersionsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Resume version not found" });
    return;
  }
  res.json(UpdateResumeVersionResponse.parse(row));
});

router.delete("/resume-versions/:id", async (req, res): Promise<void> => {
  const params = DeleteResumeVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(resumeVersionsTable)
    .where(eq(resumeVersionsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Resume version not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/resume-versions/:id/approve", async (req, res): Promise<void> => {
  const params = ApproveResumeVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(resumeVersionsTable)
    .where(eq(resumeVersionsTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Resume version not found" });
    return;
  }

  const previousStatus = existing[0].status;

  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(resumeVersionsTable)
      .set({ status: "approved" })
      .where(eq(resumeVersionsTable.id, params.data.id))
      .returning();
    await tx.insert(eventLogsTable).values({
      entityType: "resume_version",
      entityId: params.data.id,
      jobId: existing[0]!.jobId ?? null,
      applicationId: null,
      eventType: "approval",
      previousState: previousStatus,
      nextState: "approved",
      actorType: "user",
      metadata: { resumeVersionId: params.data.id },
    });
    return updated!;
  });

  req.log.info({ id: params.data.id }, "Resume version approved");
  res.json(ApproveResumeVersionResponse.parse(row));
});

router.post("/resume-versions/:id/reject", async (req, res): Promise<void> => {
  const params = RejectResumeVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(resumeVersionsTable)
    .where(eq(resumeVersionsTable.id, params.data.id));
  if (!existing[0]) {
    res.status(404).json({ error: "Resume version not found" });
    return;
  }

  const previousStatus = existing[0].status;

  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(resumeVersionsTable)
      .set({ status: "rejected" })
      .where(eq(resumeVersionsTable.id, params.data.id))
      .returning();
    await tx.insert(eventLogsTable).values({
      entityType: "resume_version",
      entityId: params.data.id,
      jobId: existing[0]!.jobId ?? null,
      applicationId: null,
      eventType: "rejection",
      previousState: previousStatus,
      nextState: "rejected",
      actorType: "user",
      metadata: { resumeVersionId: params.data.id },
    });
    return updated!;
  });

  req.log.info({ id: params.data.id }, "Resume version rejected");
  res.json(RejectResumeVersionResponse.parse(row));
});

export default router;
