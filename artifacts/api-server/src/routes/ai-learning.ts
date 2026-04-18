import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  aiPromptVersionsTable,
  aiRunEvaluationsTable,
  aiTrainingExamplesTable,
  eventLogsTable,
  insertAiPromptVersionSchema,
  insertAiRunEvaluationSchema,
  insertAiTrainingExampleSchema,
} from "@workspace/db";

const router: IRouter = Router();
const IdParams = z.object({ id: z.coerce.number().int().positive() });
const ListQuery = z.object({
  taskScope: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

router.get("/ai-review/overview", async (_req, res): Promise<void> => {
  const [recentAiEvents, evaluations, promptVersions, trainingExamples] =
    await Promise.all([
      db
        .select()
        .from(eventLogsTable)
        .where(eq(eventLogsTable.entityType, "ai_call"))
        .orderBy(desc(eventLogsTable.createdAt))
        .limit(25),
      db
        .select()
        .from(aiRunEvaluationsTable)
        .orderBy(desc(aiRunEvaluationsTable.createdAt))
        .limit(25),
      db
        .select()
        .from(aiPromptVersionsTable)
        .orderBy(desc(aiPromptVersionsTable.createdAt))
        .limit(25),
      db
        .select()
        .from(aiTrainingExamplesTable)
        .orderBy(desc(aiTrainingExamplesTable.createdAt))
        .limit(25),
    ]);

  res.json({
    recentAiEvents,
    evaluations,
    promptVersions,
    trainingExamples,
    stats: {
      recentAiEvents: recentAiEvents.length,
      evaluations: evaluations.length,
      activePromptVersions: promptVersions.filter((p) => p.isActive).length,
      trainingExamples: trainingExamples.length,
      failedAiEvents: recentAiEvents.filter((e) => e.eventType === "ai_call_failed").length,
    },
  });
});

router.get("/ai-prompt-versions", async (req, res): Promise<void> => {
  const query = ListQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.taskScope) {
    conditions.push(eq(aiPromptVersionsTable.taskScope, query.data.taskScope));
  }
  if (query.data.isActive != null) {
    conditions.push(eq(aiPromptVersionsTable.isActive, query.data.isActive));
  }

  const rows = await db
    .select()
    .from(aiPromptVersionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiPromptVersionsTable.createdAt));
  res.json(rows);
});

router.post("/ai-prompt-versions", async (req, res): Promise<void> => {
  const parsed = insertAiPromptVersionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db.transaction(async (tx) => {
    if (parsed.data.isActive) {
      await tx
        .update(aiPromptVersionsTable)
        .set({ isActive: false })
        .where(eq(aiPromptVersionsTable.taskScope, parsed.data.taskScope));
    }
    return tx.insert(aiPromptVersionsTable).values(parsed.data).returning();
  });
  res.status(201).json(row);
});

router.patch("/ai-prompt-versions/:id", async (req, res): Promise<void> => {
  const params = IdParams.safeParse(req.params);
  const parsed = insertAiPromptVersionSchema.partial().safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.success ? parsed.error?.message : params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(aiPromptVersionsTable)
    .where(eq(aiPromptVersionsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "AI prompt version not found" });
    return;
  }

  const [row] = await db.transaction(async (tx) => {
    const taskScope = parsed.data.taskScope ?? existing.taskScope;
    if (parsed.data.isActive) {
      await tx
        .update(aiPromptVersionsTable)
        .set({ isActive: false })
        .where(eq(aiPromptVersionsTable.taskScope, taskScope));
    }
    return tx
      .update(aiPromptVersionsTable)
      .set(parsed.data)
      .where(eq(aiPromptVersionsTable.id, params.data.id))
      .returning();
  });
  res.json(row);
});

import { validateLineage, isCanonicalRunId } from "../lib/lineage";

router.get("/ai-run-evaluations", async (req, res): Promise<void> => {
  const query = z.object({ taskScope: z.string().optional() }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(aiRunEvaluationsTable)
    .where(
      query.data.taskScope
        ? eq(aiRunEvaluationsTable.taskScope, query.data.taskScope)
        : undefined,
    )
    .orderBy(desc(aiRunEvaluationsTable.createdAt));
  res.json(rows);
});

router.post("/ai-run-evaluations", async (req, res): Promise<void> => {
  const parsed = insertAiRunEvaluationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { runId, eventLogId, entityType, entityId } = parsed.data;

  if (!isCanonicalRunId(runId)) {
    res.status(422).json({
      error: "Lineage validation failed",
      details: {
        reasons: ["Invalid or missing run_id"],
      },
    });
    return;
  }

  const lineageValidation = await validateLineage({
    table: "ai_run_evaluations",
    runId,
    eventLogId,
    entityType,
    entityId,
  });

  if (!lineageValidation.ok) {
    res.status(422).json({
      error: "Lineage validation failed",
      details: {
        status: lineageValidation.status,
        reasons: lineageValidation.diagnostics.reasons,
      },
    });
    return;
  }

  const [row] = await db.insert(aiRunEvaluationsTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/ai-training-examples", async (req, res): Promise<void> => {
  const query = ListQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conditions = [];
  if (query.data.taskScope) {
    conditions.push(eq(aiTrainingExamplesTable.taskScope, query.data.taskScope));
  }
  if (query.data.isActive != null) {
    conditions.push(eq(aiTrainingExamplesTable.isActive, query.data.isActive));
  }
  const rows = await db
    .select()
    .from(aiTrainingExamplesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiTrainingExamplesTable.createdAt));
  res.json(rows);
});

router.post("/ai-training-examples", async (req, res): Promise<void> => {
  const parsed = insertAiTrainingExampleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(aiTrainingExamplesTable).values(parsed.data).returning();
  res.status(201).json(row);
});

export default router;
