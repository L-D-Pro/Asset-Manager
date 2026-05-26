import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, eventLogsTable } from "@workspace/db";
import {
  ListEventLogsQueryParams,
  ListEventLogsResponse,
  GetEventLogParams,
  GetEventLogResponse,
} from "@workspace/api-zod";
import type { JobOpsRequest } from "../lib/http-types";
import { currentUserId } from "../lib/ownership";

const router: IRouter = Router();

router.get("/event-logs", async (req: JobOpsRequest, res): Promise<void> => {
  req.log.info("Listing event logs");
  const userId = currentUserId(req);
  const query = ListEventLogsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [eq(eventLogsTable.userId, userId)];
  if (query.data.entityType != null) {
    conditions.push(eq(eventLogsTable.entityType, query.data.entityType));
  }
  if (query.data.entityId != null) {
    conditions.push(eq(eventLogsTable.entityId, query.data.entityId));
  }
  if (query.data.applicationId != null) {
    conditions.push(eq(eventLogsTable.applicationId, query.data.applicationId));
  }
  if (query.data.jobId != null) {
    conditions.push(eq(eventLogsTable.jobId, query.data.jobId));
  }

  const rows = await db
    .select()
    .from(eventLogsTable)
    .where(and(...conditions))
    .orderBy(eventLogsTable.createdAt);
  res.json(ListEventLogsResponse.parse(rows));
});

router.get("/event-logs/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = GetEventLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(eventLogsTable)
    .where(and(eq(eventLogsTable.id, params.data.id), eq(eventLogsTable.userId, userId)));
  if (!row) {
    res.status(404).json({ error: "Event log not found" });
    return;
  }
  res.json(GetEventLogResponse.parse(row));
});

export default router;
