import { Router, type IRouter } from "express";
import { eq, and, or, lt, gt, asc, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { db, eventLogsTable } from "@workspace/db";
import {
  GetEventLogParams,
  GetEventLogResponse,
} from "@workspace/api-zod";
import type { JobOpsRequest } from "../lib/http-types";
import { currentUserId } from "../lib/ownership";

const router: IRouter = Router();

// ── Local query schema (pagination + filters) ─────────────────────────────

const eventLogQuerySchema = z.object({
  // existing filters
  entityType: z.string().optional(),
  entityId: z.coerce.number().int().positive().optional(),
  applicationId: z.coerce.number().int().positive().optional(),
  jobId: z.coerce.number().int().positive().optional(),
  // new pagination params
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  // new filter params
  eventType: z.string().optional(),
  runId: z.string().optional(),
});

// ── Cursor helpers ────────────────────────────────────────────────────────

export function encodeEventLogCursor(createdAt: Date | string, id: number): string {
  return Buffer.from(
    JSON.stringify({ createdAt: new Date(createdAt).toISOString(), id }),
    "utf8",
  ).toString("base64url");
}

export function decodeEventLogCursor(cursor: string): { createdAt: string; id: number } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof parsed.createdAt === "string" && typeof parsed.id === "number") return parsed;
    return null;
  } catch {
    return null;
  }
}

// ── GET /event-logs ───────────────────────────────────────────────────────

router.get("/event-logs", async (req: JobOpsRequest, res): Promise<void> => {
  req.log.info("Listing event logs");
  const userId = currentUserId(req);
  const query = eventLogQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { limit, cursor, order, entityType, entityId, applicationId, jobId, eventType, runId } =
    query.data;

  const conditions = [eq(eventLogsTable.userId, userId)];

  if (entityType != null) {
    conditions.push(eq(eventLogsTable.entityType, entityType));
  }
  if (entityId != null) {
    conditions.push(eq(eventLogsTable.entityId, entityId));
  }
  if (applicationId != null) {
    conditions.push(eq(eventLogsTable.applicationId, applicationId));
  }
  if (jobId != null) {
    conditions.push(eq(eventLogsTable.jobId, jobId));
  }
  if (eventType != null) {
    conditions.push(eq(eventLogsTable.eventType, eventType));
  }
  if (runId != null) {
    conditions.push(eq(eventLogsTable.runId, runId));
  }

  // Decode cursor if provided
  let cursorCreatedAt: string | undefined;
  let cursorId: number | undefined;
  if (cursor != null) {
    const decoded = decodeEventLogCursor(cursor);
    if (decoded === null) {
      res.status(400).json({ error: "Invalid cursor" });
      return;
    }
    cursorCreatedAt = decoded.createdAt;
    cursorId = decoded.id;
  }

  // Apply cursor condition
  if (cursorCreatedAt != null && cursorId != null) {
    const cursorDate = new Date(cursorCreatedAt);
    if (order === "desc") {
      conditions.push(
        or(
          lt(eventLogsTable.createdAt, cursorDate),
          and(eq(eventLogsTable.createdAt, cursorDate), lt(eventLogsTable.id, cursorId)),
        )!,
      );
    } else {
      conditions.push(
        or(
          gt(eventLogsTable.createdAt, cursorDate),
          and(eq(eventLogsTable.createdAt, cursorDate), gt(eventLogsTable.id, cursorId)),
        )!,
      );
    }
  }

  const fetchLimit = limit + 1;

  const rows = await db
    .select()
    .from(eventLogsTable)
    .where(and(...conditions))
    .orderBy(
      order === "desc"
        ? desc(eventLogsTable.createdAt)
        : asc(eventLogsTable.createdAt),
      order === "desc"
        ? desc(eventLogsTable.id)
        : asc(eventLogsTable.id),
    )
    .limit(fetchLimit);

  let nextCursor: string | null = null;
  if (rows.length > limit) {
    rows.pop();
    const last = rows[rows.length - 1];
    nextCursor = encodeEventLogCursor(last.createdAt, last.id);
  }

  res.json({ rows, nextCursor });
});

// ── GET /event-logs/:id ───────────────────────────────────────────────────

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
