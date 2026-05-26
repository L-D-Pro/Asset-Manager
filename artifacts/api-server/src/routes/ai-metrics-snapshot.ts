import { Router, type IRouter } from "express";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { aiRunEvaluationsTable, db, eventLogsTable } from "@workspace/db";
import { defineSnapshotWindow, type MetricsContractVersion } from "../lib/metrics-contract";
import { buildAiMetricsSnapshotV1, type AiRunEvaluationRowLite } from "../lib/ai-metrics-snapshot";
import type { JobOpsRequest } from "../lib/http-types";
import { currentUserId } from "../lib/ownership";

export { buildAiMetricsSnapshotV1, type AiRunEvaluationRowLite } from "../lib/ai-metrics-snapshot";
export type { AiMetricsSnapshotResponseV1, AiMetricsSnapshotStatus } from "../lib/ai-metrics-snapshot";

const QuerySchema = z.object({
  metricsVersion: z.literal("v1"),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  taskScope: z.string().optional(),
});

export const aiMetricsSnapshotRouter: IRouter = Router();

aiMetricsSnapshotRouter.get("/ai-metrics-snapshot", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const windowStart = new Date(parsed.data.windowStart);
  const windowEnd = new Date(parsed.data.windowEnd);

  const window = defineSnapshotWindow({ start: windowStart, end: windowEnd });

  const where = [
    eq(aiRunEvaluationsTable.userId, userId),
    gte(aiRunEvaluationsTable.createdAt, window.startInclusive),
    lt(aiRunEvaluationsTable.createdAt, window.endExclusive),
  ];

  if (parsed.data.taskScope) {
    where.push(eq(aiRunEvaluationsTable.taskScope, parsed.data.taskScope));
  }

  const rows = (await db
    .select({
      runId: aiRunEvaluationsTable.runId,
      taskScope: aiRunEvaluationsTable.taskScope,
      eventLogId: aiRunEvaluationsTable.eventLogId,
      createdAt: aiRunEvaluationsTable.createdAt,
      approvalOutcome: aiRunEvaluationsTable.approvalOutcome,
      promptVersionId: aiRunEvaluationsTable.promptVersionId,
      editDistance: aiRunEvaluationsTable.editDistance,
      truthfulnessScore: aiRunEvaluationsTable.truthfulnessScore,
      relevanceScore: aiRunEvaluationsTable.relevanceScore,
      formattingScore: aiRunEvaluationsTable.formattingScore,
      attributionScore: aiRunEvaluationsTable.attributionScore,
    })
    .from(aiRunEvaluationsTable)
    .where(and(...where))) as AiRunEvaluationRowLite[];

  const runIds = Array.from(
    new Set(rows.map((r) => r.runId).filter((id): id is string => typeof id === "string" && id.length > 0)),
  );

  const hasRootAiEventByRunId: Record<string, boolean> = {};
  if (runIds.length > 0) {
    const rootAiEvents = await db
      .select({
        runId: eventLogsTable.runId,
      })
      .from(eventLogsTable)
      .where(and(
        eq(eventLogsTable.entityType, "ai_call"),
        eq(eventLogsTable.userId, userId),
        inArray(eventLogsTable.runId, runIds),
      ));

    for (const row of rootAiEvents) {
      if (row.runId) hasRootAiEventByRunId[row.runId] = true;
    }

    for (const runId of runIds) {
      hasRootAiEventByRunId[runId] ??= false;
    }
  }

  const response = buildAiMetricsSnapshotV1({
    metricsVersion: parsed.data.metricsVersion,
    taskScope: parsed.data.taskScope ?? null,
    windowStart,
    windowEnd,
    rows,
    hasRootAiEventByRunId,
  });

  res.json(response);
});
