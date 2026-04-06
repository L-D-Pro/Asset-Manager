import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, eventLogsTable } from "@workspace/db";
import {
  ListEventLogsQueryParams,
  ListEventLogsResponse,
  CreateEventLogBody,
  GetEventLogParams,
  GetEventLogResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/event-logs", async (req, res): Promise<void> => {
  req.log.info("Listing event logs");
  const query = ListEventLogsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(eventLogsTable.createdAt);
  res.json(ListEventLogsResponse.parse(rows));
});

router.post("/event-logs", async (req, res): Promise<void> => {
  const parsed = CreateEventLogBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid create event log body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(eventLogsTable).values(parsed.data).returning();
  res.status(201).json(GetEventLogResponse.parse(row));
});

router.get("/event-logs/:id", async (req, res): Promise<void> => {
  const params = GetEventLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(eventLogsTable)
    .where(eq(eventLogsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Event log not found" });
    return;
  }
  res.json(GetEventLogResponse.parse(row));
});

export default router;
