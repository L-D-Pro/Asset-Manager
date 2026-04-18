import { describe, expect, it, vi } from "vitest";


vi.mock("@workspace/db", () => {
  const dbMock = {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => [{ id: 901 }]) })) })),
    select: vi.fn(),
  };

  return {
    db: dbMock,
    // minimal table mocks used by validateLineage/ai-learning insert
    eventLogsTable: { id: "id", runId: "run_id", entityType: "entity_type", createdAt: "created_at" },
    aiRunEvaluationsTable: { id: "id" },
    insertAiRunEvaluationSchema: { safeParse: vi.fn() },
    __lineageEnforcementTest: { dbMock },
  };
});

import { mintRunId } from "../../lib/lineage";

// Route handlers are tested in-process without HTTP wiring so we don't need supertest.
// Each handler is invoked with a minimal req/res stub.

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
  res.sendStatus = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  return res;
}

describe("lineage enforcement (routes)", () => {
  it("rejects creating ai-run-evaluation when run_id is invalid", async () => {
    const { default: aiLearningRouter } = await import("../ai-learning");

    const layer = (aiLearningRouter as any).stack.find(
      (l: any) => l.route?.path === "/ai-run-evaluations" && l.route?.methods?.post,
    );
    expect(layer).toBeTruthy();

    (await import("@workspace/db") as any).insertAiRunEvaluationSchema.safeParse.mockReturnValueOnce({
      success: true,
      data: { taskScope: "test", evaluator: "human", score: 1, runId: "bad", eventLogId: null, entityType: null, entityId: null },
    });

    const handler = layer.route.stack[0].handle;
    const req: any = { body: { taskScope: "test", evaluator: "human", score: 1, runId: "bad" } };
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.payload?.error).toContain("Lineage validation failed");
  });

  it("allows creating evaluation when lineage is valid", async () => {
    const { default: aiLearningRouter } = await import("../ai-learning");

    const runId = mintRunId({ random: "aaaaaaaaaaaa" });

    // validateLineage in ai-learning queries event_logs via the db.select mock.
    (await import("@workspace/db") as any).__lineageEnforcementTest.dbMock.select.mockReturnValueOnce({
      from() {
        return {
          where() {
            return {
              orderBy() {
                return {
                  limit() {
                    return [
                      {
                        id: 501,
                        runId,
                        entityType: "ai_call",
                        eventType: "ai_call",
                        jobId: null,
                        applicationId: null,
                        createdAt: new Date(),
                      },
                    ];
                  },
                };
              },
            };
          },
        };
      },
    });

    (await import("@workspace/db") as any).insertAiRunEvaluationSchema.safeParse.mockReturnValueOnce({
      success: true,
      data: { taskScope: "test", evaluator: "human", score: 1, runId, eventLogId: 501, entityType: "ai_call", entityId: 123 },
    });

    const layer = (aiLearningRouter as any).stack.find(
      (l: any) => l.route?.path === "/ai-run-evaluations" && l.route?.methods?.post,
    );
    const handler = layer.route.stack[0].handle;

    const req: any = { body: { taskScope: "test", evaluator: "human", score: 1, runId, eventLogId: 501, entityType: "ai_call", entityId: 123 } };
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect((await import("@workspace/db") as any).__lineageEnforcementTest.dbMock.insert).toHaveBeenCalled();
  });
});
