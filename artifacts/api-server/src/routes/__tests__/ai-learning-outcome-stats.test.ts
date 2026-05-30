import { describe, expect, it, vi, beforeEach } from "vitest";

function makeRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: unknown) => {
    res.payload = payload;
    return res;
  });
  return res;
}

const mockDb = {
  select: vi.fn(),
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  aiRunEvaluationsTable: {
    userId: "ai_run_evaluations.user_id",
    taskScope: "ai_run_evaluations.task_scope",
    approvalOutcome: "ai_run_evaluations.approval_outcome",
    truthfulnessScore: "ai_run_evaluations.truthfulness_score",
    relevanceScore: "ai_run_evaluations.relevance_score",
    createdAt: "ai_run_evaluations.created_at",
  },
  aiTrainingExamplesTable: {
    userId: "ai_training_examples.user_id",
    taskScope: "ai_training_examples.task_scope",
    isActive: "ai_training_examples.is_active",
  },
  // other tables referenced by the router module
  aiPromptVersionsTable: { id: "id", taskScope: "task_scope", isActive: "is_active", label: "label", roleLabel: "role_label", version: "version" },
  aiModelConfigsTable: { id: "id", taskScope: "task_scope", isActive: "is_active", modelName: "model_name", priority: "priority" },
  eventLogsTable: { userId: "user_id", taskScope: "task_scope", createdAt: "created_at", id: "id" },
  aiVariantStatsTable: { taskScope: "task_scope", variantLabel: "variant_label" },
  aiVariantComparisonsTable: { taskScope: "task_scope" },
  aiLearningConfigTable: { id: "id" },
  feedbackSignalsTable: { userId: "user_id", processedAt: "processed_at" },
  resumeVersionsTable: { id: "id", userId: "user_id" },
  coverLetterVersionsTable: { id: "id", userId: "user_id" },
  proposalVersionsTable: { id: "id", userId: "user_id" },
  insertAiPromptVersionSchema: { parse: vi.fn() },
  insertAiRunEvaluationSchema: { parse: vi.fn() },
  insertAiTrainingExampleSchema: { parse: vi.fn() },
  updateAiLearningConfigSchema: { parse: vi.fn() },
}));

vi.mock("../../lib/gamification.js", () => ({ awardXp: vi.fn() }));
vi.mock("../../lib/learning-processor.js", () => ({ runRecompute: vi.fn() }));
vi.mock("../../middlewares/admin.js", () => ({ requireAdmin: vi.fn((_req: any, _res: any, next: any) => next()) }));
vi.mock("../../lib/ownership.js", () => ({
  currentUserId: vi.fn(() => 42),
  withoutUserId: vi.fn((obj: any) => obj),
  withoutUserIds: vi.fn((arr: any) => arr),
}));
vi.mock("../ai-metrics-snapshot.js", async () => {
  const { Router } = await import("express");
  return { aiMetricsSnapshotRouter: Router() };
});

import { db } from "@workspace/db";

async function invokeOutcomeStats(taskScope?: string) {
  const { default: router } = await import("../ai-learning");
  const layer = (router as any).stack.find(
    (l: any) =>
      l.route?.path === "/ai-learning/outcome-stats" && l.route?.methods?.get,
  );
  expect(layer).toBeTruthy();
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;
  const req: any = {
    session: { userId: 42 },
    query: taskScope ? { taskScope } : {},
  };
  const res = makeRes();
  await handler(req, res);
  return { res };
}

function makeGroupByChain(resolvedValue: unknown[]) {
  const groupBy = vi.fn().mockResolvedValue(resolvedValue);
  const where = vi.fn().mockReturnValue({ groupBy });
  const from = vi.fn().mockReturnValue({ where });
  return { from, where, groupBy };
}

describe("GET /ai-learning/outcome-stats — SQL GROUP BY aggregation", () => {
  beforeEach(() => {
    vi.resetModules();
    (mockDb.select as ReturnType<typeof vi.fn>).mockReset();
  });

  it("returns grouped stats from SQL aggregation with correct computed fields", async () => {
    const selectMock = mockDb.select as ReturnType<typeof vi.fn>;

    const evalChain = makeGroupByChain([
      {
        taskScope: "chat",
        total: 5,
        approved: 3,
        rejected: 1,
        pending: 1,
        avgTruthfulness: "4.2",
        avgRelevance: "3.8",
      },
    ]);

    const trainingChain = makeGroupByChain([
      { taskScope: "chat", activeCount: 2 },
    ]);

    selectMock
      .mockReturnValueOnce({ from: evalChain.from })
      .mockReturnValueOnce({ from: trainingChain.from });

    const { res } = await invokeOutcomeStats();

    expect(res.statusCode).toBe(200);
    const payload = res.payload as Array<Record<string, unknown>>;
    expect(Array.isArray(payload)).toBe(true);
    expect(payload).toHaveLength(1);

    const stat = payload[0];
    expect(stat.taskScope).toBe("chat");
    expect(stat.totalEvaluations).toBe(5);
    expect(stat.approved).toBe(3);
    expect(stat.rejected).toBe(1);
    expect(stat.pending).toBe(1);
    // approvalRate = round(3/5 * 100) = 60
    expect(stat.approvalRate).toBe(60);
    // avgTruthfulnessScore = round(4.2) = 4
    expect(stat.avgTruthfulnessScore).toBe(4);
    // avgRelevanceScore = round(3.8) = 4
    expect(stat.avgRelevanceScore).toBe(4);
    expect(stat.activeTrainingExamples).toBe(2);
  });

  it("returns empty array when no evaluations exist", async () => {
    const selectMock = mockDb.select as ReturnType<typeof vi.fn>;

    const evalChain = makeGroupByChain([]);
    const trainingChain = makeGroupByChain([]);

    selectMock
      .mockReturnValueOnce({ from: evalChain.from })
      .mockReturnValueOnce({ from: trainingChain.from });

    const { res } = await invokeOutcomeStats();

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual([]);
  });

  it("returns null avgTruthfulnessScore and avgRelevanceScore when SQL returns null", async () => {
    const selectMock = mockDb.select as ReturnType<typeof vi.fn>;

    const evalChain = makeGroupByChain([
      {
        taskScope: "resume_tailoring",
        total: 2,
        approved: 2,
        rejected: 0,
        pending: 0,
        avgTruthfulness: null,
        avgRelevance: null,
      },
    ]);

    const trainingChain = makeGroupByChain([]);

    selectMock
      .mockReturnValueOnce({ from: evalChain.from })
      .mockReturnValueOnce({ from: trainingChain.from });

    const { res } = await invokeOutcomeStats();

    expect(res.statusCode).toBe(200);
    const payload = res.payload as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(1);
    expect(payload[0].avgTruthfulnessScore).toBeNull();
    expect(payload[0].avgRelevanceScore).toBeNull();
  });

  it("activeTrainingExamples defaults to 0 for scopes with no training examples", async () => {
    const selectMock = mockDb.select as ReturnType<typeof vi.fn>;

    const evalChain = makeGroupByChain([
      {
        taskScope: "chat",
        total: 3,
        approved: 1,
        rejected: 1,
        pending: 1,
        avgTruthfulness: "3.0",
        avgRelevance: "3.0",
      },
    ]);

    // training stats has no entry for "chat"
    const trainingChain = makeGroupByChain([]);

    selectMock
      .mockReturnValueOnce({ from: evalChain.from })
      .mockReturnValueOnce({ from: trainingChain.from });

    const { res } = await invokeOutcomeStats();

    expect(res.statusCode).toBe(200);
    const payload = res.payload as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(1);
    expect(payload[0].activeTrainingExamples).toBe(0);
  });

  it("correctly computes approvalRate as round(approved/total * 100)", async () => {
    const selectMock = mockDb.select as ReturnType<typeof vi.fn>;

    const evalChain = makeGroupByChain([
      {
        taskScope: "cover_letter",
        total: 7,
        approved: 2,
        rejected: 3,
        pending: 2,
        avgTruthfulness: "5.0",
        avgRelevance: "5.0",
      },
    ]);

    const trainingChain = makeGroupByChain([]);

    selectMock
      .mockReturnValueOnce({ from: evalChain.from })
      .mockReturnValueOnce({ from: trainingChain.from });

    const { res } = await invokeOutcomeStats();

    expect(res.statusCode).toBe(200);
    const payload = res.payload as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(1);
    // approvalRate = round(2/7 * 100) = round(28.57) = 29
    expect(payload[0].approvalRate).toBe(29);
  });

  it("filters both queries by taskScope when taskScope is provided", async () => {
    const selectMock = mockDb.select as ReturnType<typeof vi.fn>;

    const evalWhereGroupBy = vi.fn().mockResolvedValue([
      {
        taskScope: "chat",
        total: 1,
        approved: 1,
        rejected: 0,
        pending: 0,
        avgTruthfulness: null,
        avgRelevance: null,
      },
    ]);
    const evalWhere = vi.fn().mockReturnValue({ groupBy: evalWhereGroupBy });
    const evalFrom = vi.fn().mockReturnValue({ where: evalWhere });

    const trainingGroupBy = vi.fn().mockResolvedValue([]);
    const trainingWhere = vi.fn().mockReturnValue({ groupBy: trainingGroupBy });
    const trainingFrom = vi.fn().mockReturnValue({ where: trainingWhere });

    selectMock
      .mockReturnValueOnce({ from: evalFrom })
      .mockReturnValueOnce({ from: trainingFrom });

    const { res } = await invokeOutcomeStats("chat");

    expect(res.statusCode).toBe(200);

    // Both where() calls should have been made (filter is applied)
    expect(evalWhere).toHaveBeenCalledTimes(1);
    expect(trainingWhere).toHaveBeenCalledTimes(1);

    // Both groupBy() calls should have resolved
    expect(evalWhereGroupBy).toHaveBeenCalledTimes(1);
    expect(trainingGroupBy).toHaveBeenCalledTimes(1);
  });

  it("returns stats across multiple scopes when no taskScope filter is provided", async () => {
    const selectMock = mockDb.select as ReturnType<typeof vi.fn>;

    const evalChain = makeGroupByChain([
      {
        taskScope: "chat",
        total: 4,
        approved: 2,
        rejected: 1,
        pending: 1,
        avgTruthfulness: "4.0",
        avgRelevance: "3.5",
      },
      {
        taskScope: "resume_tailoring",
        total: 6,
        approved: 5,
        rejected: 0,
        pending: 1,
        avgTruthfulness: "4.8",
        avgRelevance: "4.5",
      },
    ]);

    const trainingChain = makeGroupByChain([
      { taskScope: "chat", activeCount: 1 },
      { taskScope: "resume_tailoring", activeCount: 3 },
    ]);

    selectMock
      .mockReturnValueOnce({ from: evalChain.from })
      .mockReturnValueOnce({ from: trainingChain.from });

    const { res } = await invokeOutcomeStats();

    expect(res.statusCode).toBe(200);
    const payload = res.payload as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(2);

    const chat = payload.find((r) => r.taskScope === "chat");
    const resume = payload.find((r) => r.taskScope === "resume_tailoring");

    expect(chat).toBeDefined();
    expect(chat!.totalEvaluations).toBe(4);
    expect(chat!.activeTrainingExamples).toBe(1);

    expect(resume).toBeDefined();
    expect(resume!.totalEvaluations).toBe(6);
    expect(resume!.activeTrainingExamples).toBe(3);
    // approvalRate = round(5/6 * 100) = round(83.33) = 83
    expect(resume!.approvalRate).toBe(83);
  });
});
