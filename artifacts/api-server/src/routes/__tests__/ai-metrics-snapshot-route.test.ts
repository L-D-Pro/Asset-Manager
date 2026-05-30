import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => {
  return {
    db: {
      select: vi.fn(),
    },
    aiRunEvaluationsTable: {
      userId: "ai_run_evaluations.user_id",
      runId: "ai_run_evaluations.run_id",
      taskScope: "ai_run_evaluations.task_scope",
      eventLogId: "ai_run_evaluations.event_log_id",
      createdAt: "ai_run_evaluations.created_at",
      approvalOutcome: "ai_run_evaluations.approval_outcome",
      promptVersionId: "ai_run_evaluations.prompt_version_id",
      editDistance: "ai_run_evaluations.edit_distance",
      truthfulnessScore: "ai_run_evaluations.truthfulness_score",
      relevanceScore: "ai_run_evaluations.relevance_score",
      formattingScore: "ai_run_evaluations.formatting_score",
      attributionScore: "ai_run_evaluations.attribution_score",
    },
    eventLogsTable: {
      userId: "event_logs.user_id",
      entityType: "event_logs.entity_type",
      runId: "event_logs.run_id",
    },
  };
});

import { db } from "@workspace/db";
import { aiMetricsSnapshotRouter } from "../ai-metrics-snapshot";

function makeMockResponse() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe("ai metrics snapshot route", () => {
  it("marks row_missing_root_ai_event when event_logs lacks ai_call for runId", async () => {
    const selectMock = db.select as unknown as ReturnType<typeof vi.fn>;

    // First query returns evaluations.
    selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => [
          {
            runId: "run_missing_root",
            taskScope: "resume_review",
            eventLogId: 1,
            createdAt: new Date("2026-04-18T10:15:00.000Z"),
            approvalOutcome: "approved",
            promptVersionId: 123,
            editDistance: 2,
            truthfulnessScore: 5,
            relevanceScore: 5,
            formattingScore: 4,
            attributionScore: 5,
          },
        ],
      }),
    });

    // Second query returns no root events.
    selectMock.mockReturnValueOnce({
      from: () => ({
        where: () => [],
      }),
    });

    const layer: any = aiMetricsSnapshotRouter;
    const route = layer.stack.find((l: any) => l.route?.path === "/ai-metrics-snapshot");
    expect(route).toBeTruthy();
    const handler = route.route.stack[0].handle;

    const req: any = {
      session: { adminId: 27 },
      query: {
        metricsVersion: "v1",
        windowStart: "2026-04-18T10:01:02.000Z",
        windowEnd: "2026-04-18T11:01:02.000Z",
        taskScope: "resume_review",
      },
    };
    const res = makeMockResponse();

    await handler(req, res);

    expect(res.status).not.toHaveBeenCalled();
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.status).toBe("degraded");
    expect(payload.degradedReasons).toContain("row_missing_root_ai_event");
  });
});

describe("ai metrics snapshot route — window guard", () => {
  function getHandler() {
    const layer: any = aiMetricsSnapshotRouter;
    const route = layer.stack.find((l: any) => l.route?.path === "/ai-metrics-snapshot");
    return route.route.stack[0].handle;
  }

  function makeReq(windowStart: string, windowEnd: string) {
    return {
      session: { adminId: 27 },
      query: { metricsVersion: "v1", windowStart, windowEnd },
    };
  }

  it("7-day window succeeds (no 400)", async () => {
    const selectMock = (db.select as unknown as ReturnType<typeof vi.fn>);
    selectMock.mockReturnValue({ from: () => ({ where: () => [] }) });

    const handler = getHandler();
    const res = makeMockResponse();
    await handler(makeReq("2026-01-01T00:00:00.000Z", "2026-01-08T00:00:00.000Z"), res);

    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it("31-day window succeeds (boundary)", async () => {
    const selectMock = (db.select as unknown as ReturnType<typeof vi.fn>);
    selectMock.mockReturnValue({ from: () => ({ where: () => [] }) });

    const handler = getHandler();
    const res = makeMockResponse();
    await handler(makeReq("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z"), res);

    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it("32-day window returns 400 with maxWindowDays", async () => {
    const handler = getHandler();
    const res = makeMockResponse();
    await handler(makeReq("2026-01-01T00:00:00.000Z", "2026-02-02T00:00:00.000Z"), res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.error).toMatch(/window too large/i);
    expect(payload.maxWindowDays).toBe(31);
  });

  it("windowEnd before windowStart returns 400", async () => {
    const handler = getHandler();
    const res = makeMockResponse();
    await handler(makeReq("2026-01-08T00:00:00.000Z", "2026-01-01T00:00:00.000Z"), res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.error).toMatch(/after/i);
  });

  it("invalid date still returns 400 (schema validation)", async () => {
    const handler = getHandler();
    const res = makeMockResponse();
    await handler(
      { session: { adminId: 27 }, query: { metricsVersion: "v1", windowStart: "not-a-date", windowEnd: "2026-01-08T00:00:00.000Z" } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
