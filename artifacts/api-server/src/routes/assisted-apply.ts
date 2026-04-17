import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  siteAdaptersTable,
  applicationSessionsTable,
  applicationFormFieldsTable,
  applicationActionsTable,
  eventLogsTable,
  insertSiteAdapterSchema,
  insertApplicationSessionSchema,
  insertApplicationFormFieldSchema,
  insertApplicationActionSchema,
} from "@workspace/db";

const router: IRouter = Router();
const IdParams = z.object({ id: z.coerce.number().int().positive() });

router.get("/site-adapters", async (req, res): Promise<void> => {
  const query = z.object({
    platform: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
  }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conditions = [];
  if (query.data.platform) {
    conditions.push(eq(siteAdaptersTable.platform, query.data.platform));
  }
  if (query.data.isActive != null) {
    conditions.push(eq(siteAdaptersTable.isActive, query.data.isActive));
  }
  const rows = await db
    .select()
    .from(siteAdaptersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(siteAdaptersTable.platform);
  res.json(rows);
});

router.post("/site-adapters", async (req, res): Promise<void> => {
  const parsed = insertSiteAdapterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(siteAdaptersTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/application-sessions", async (req, res): Promise<void> => {
  const query = z.object({
    applicationId: z.coerce.number().int().positive().optional(),
    jobId: z.coerce.number().int().positive().optional(),
    status: z.string().optional(),
  }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conditions = [];
  if (query.data.applicationId != null) {
    conditions.push(eq(applicationSessionsTable.applicationId, query.data.applicationId));
  }
  if (query.data.jobId != null) {
    conditions.push(eq(applicationSessionsTable.jobId, query.data.jobId));
  }
  if (query.data.status != null) {
    conditions.push(eq(applicationSessionsTable.status, query.data.status));
  }
  const rows = await db
    .select()
    .from(applicationSessionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(applicationSessionsTable.createdAt));
  res.json(rows);
});

router.post("/application-sessions", async (req, res): Promise<void> => {
  const parsed = insertApplicationSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(applicationSessionsTable)
      .values(parsed.data)
      .returning();
    await tx.insert(eventLogsTable).values({
      entityType: "application_session",
      entityId: inserted!.id,
      applicationId: inserted!.applicationId ?? null,
      jobId: inserted!.jobId ?? null,
      eventType: "assisted_apply_session_created",
      actorType: "user",
      metadata: {
        platform: inserted!.platform,
        targetUrl: inserted!.targetUrl,
        safetyPolicy: "human_checkpoint_required",
      },
    });
    return [inserted];
  });
  res.status(201).json(row);
});

router.get("/application-sessions/:id", async (req, res): Promise<void> => {
  const params = IdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [session] = await db
    .select()
    .from(applicationSessionsTable)
    .where(eq(applicationSessionsTable.id, params.data.id));
  if (!session) {
    res.status(404).json({ error: "Application session not found" });
    return;
  }
  const [fields, actions] = await Promise.all([
    db
      .select()
      .from(applicationFormFieldsTable)
      .where(eq(applicationFormFieldsTable.sessionId, params.data.id))
      .orderBy(applicationFormFieldsTable.createdAt),
    db
      .select()
      .from(applicationActionsTable)
      .where(eq(applicationActionsTable.sessionId, params.data.id))
      .orderBy(applicationActionsTable.createdAt),
  ]);
  res.json({ session, fields, actions });
});

router.post("/application-sessions/:id/fields", async (req, res): Promise<void> => {
  const params = IdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = insertApplicationFormFieldSchema.safeParse({
    ...req.body,
    sessionId: params.data.id,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(applicationFormFieldsTable)
    .values(parsed.data)
    .returning();
  res.status(201).json(row);
});

router.post("/application-sessions/:id/actions", async (req, res): Promise<void> => {
  const params = IdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = insertApplicationActionSchema.safeParse({
    ...req.body,
    sessionId: params.data.id,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(applicationActionsTable)
      .values(parsed.data)
      .returning();
    await tx.insert(eventLogsTable).values({
      entityType: "application_session",
      entityId: params.data.id,
      eventType: "assisted_apply_action_logged",
      actorType: "user",
      metadata: {
        actionType: inserted!.actionType,
        summary: inserted!.summary,
        requiresHumanApproval: inserted!.requiresHumanApproval,
      },
    });
    return [inserted];
  });
  res.status(201).json(row);
});

export default router;
