import { describe, expect, it } from "vitest";
import { buildAiMetricsSnapshotV1, type AiRunEvaluationRowLite } from "../../lib/ai-metrics-snapshot";

describe("ai metrics snapshot (v1)", () => {
  it("normalizes the requested window deterministically and returns stable shape", () => {
    const rows: AiRunEvaluationRowLite[] = [
      {
        runId: "run_2026_04_18_valid",
        taskScope: "resume_review",
        eventLogId: 10,
        createdAt: new Date("2026-04-18T10:15:00.000Z"),
        approvalOutcome: "approved",
      },
      {
        runId: "run_2026_04_18_valid_2",
        taskScope: "resume_review",
        eventLogId: 11,
        createdAt: new Date("2026-04-18T10:45:00.000Z"),
        approvalOutcome: "rejected",
      },
    ];

    const snapshot = buildAiMetricsSnapshotV1({
      metricsVersion: "v1",
      taskScope: "resume_review",
      windowStart: new Date("2026-04-18T10:01:02.000Z"),
      windowEnd: new Date("2026-04-18T12:59:59.000Z"),
      rows,
    });

    expect(snapshot.metricsVersion).toBe("v1");
    expect(snapshot.status).toBe("ok");
    expect(snapshot.degradedReasons).toEqual([]);
    expect(snapshot.lastKnownGoodSnapshot).toBe(null);

    // granularity is contract-defined (hour buckets)
    expect(snapshot.window.granularityMs).toBe(60 * 60 * 1000);
    expect(snapshot.window.startInclusive).toBe("2026-04-18T10:00:00.000Z");
    expect(snapshot.window.endExclusive).toBe("2026-04-18T13:00:00.000Z");

    expect(snapshot.aggregates.evaluationCount).toBe(2);
    expect(snapshot.aggregates.approvalOutcomeCounts).toEqual({ approved: 1, rejected: 1 });

    expect(snapshot.aggregates.byPromptVersion).toEqual({
      unknown: {
        evaluationCount: 2,
        approvalOutcomeCounts: { approved: 1, rejected: 1 },
        avgEditDistance: null,
        avgRubricScores: {
          truthfulnessScore: null,
          relevanceScore: null,
          formattingScore: null,
          attributionScore: null,
        },
      },
    });

    expect(snapshot.series).toEqual([
      {
        bucketStartInclusive: "2026-04-18T10:00:00.000Z",
        evaluationCount: 2,
        approvalOutcomeCounts: { approved: 1, rejected: 1 },
        avgEditDistance: null,
        avgRubricScores: {
          truthfulnessScore: null,
          relevanceScore: null,
          formattingScore: null,
          attributionScore: null,
        },
      },
    ]);
  });

  it("returns degraded status with reasons when integrity issues are detected", () => {
    const rows: AiRunEvaluationRowLite[] = [
      {
        runId: null,
        taskScope: "resume_review",
        eventLogId: 10,
        createdAt: new Date("2026-04-18T10:15:00.000Z"),
        approvalOutcome: "approved",
      },
      {
        runId: "run_2026_04_18_valid",
        taskScope: "resume_review",
        eventLogId: null,
        createdAt: new Date("2026-04-18T10:45:00.000Z"),
        approvalOutcome: "approved",
      },
      {
        runId: "run_2026_04_18_valid_2",
        taskScope: "resume_review",
        eventLogId: 12,
        createdAt: new Date("2026-04-18T10:50:00.000Z"),
        approvalOutcome: null,
      },
    ];

    const snapshot = buildAiMetricsSnapshotV1({
      metricsVersion: "v1",
      taskScope: "resume_review",
      windowStart: new Date("2026-04-18T10:01:02.000Z"),
      windowEnd: new Date("2026-04-18T11:01:02.000Z"),
      rows,
      // simulate a missing root ai event for one run
      hasRootAiEventByRunId: {
        run_2026_04_18_valid_2: false,
      },
    });

    expect(snapshot.status).toBe("degraded");
    expect(snapshot.degradedReasons).toContain("row_missing_run_id");
    expect(snapshot.degradedReasons).toContain("row_missing_event_log_id");
    expect(snapshot.degradedReasons).toContain("row_missing_root_ai_event");

    // Still computes aggregates over eligible rows only.
    expect(snapshot.aggregates.evaluationCount).toBe(0);
    expect(snapshot.series).toEqual([]);
    expect(snapshot.aggregates.byPromptVersion).toEqual({});
  });

  it("groups series by bucket deterministically regardless of input order", () => {
    const baseRows: AiRunEvaluationRowLite[] = [
      {
        runId: "run_2026_04_18_bucket_1",
        taskScope: "resume_review",
        eventLogId: 1,
        createdAt: new Date("2026-04-18T10:15:00.000Z"),
        approvalOutcome: "approved",
      },
      {
        runId: "run_2026_04_18_bucket_2",
        taskScope: "resume_review",
        eventLogId: 2,
        createdAt: new Date("2026-04-18T10:45:00.000Z"),
        approvalOutcome: "rejected",
      },
      {
        runId: "run_2026_04_18_bucket_3",
        taskScope: "resume_review",
        eventLogId: 3,
        createdAt: new Date("2026-04-18T11:05:00.000Z"),
        approvalOutcome: "approved",
      },
    ];

    const snapshotA = buildAiMetricsSnapshotV1({
      metricsVersion: "v1",
      taskScope: "resume_review",
      windowStart: new Date("2026-04-18T10:00:00.000Z"),
      windowEnd: new Date("2026-04-18T12:00:00.000Z"),
      rows: baseRows,
    });

    const snapshotB = buildAiMetricsSnapshotV1({
      metricsVersion: "v1",
      taskScope: "resume_review",
      windowStart: new Date("2026-04-18T10:00:00.000Z"),
      windowEnd: new Date("2026-04-18T12:00:00.000Z"),
      rows: [...baseRows].reverse(),
    });

    expect(snapshotA.series).toEqual(snapshotB.series);
    expect(snapshotA.series.map((b) => b.bucketStartInclusive)).toEqual([
      "2026-04-18T10:00:00.000Z",
      "2026-04-18T11:00:00.000Z",
    ]);
  });
});
