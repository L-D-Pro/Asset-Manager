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
