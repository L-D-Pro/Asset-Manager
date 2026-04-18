import { describe, expect, it } from "vitest";

import {
  ceilToUtcBucket,
  defineSnapshotWindow,
  floorToUtcBucket,
  isEligibleMetricsLineageCandidate,
  metricsContractV1,
} from "../metrics-contract";

describe("metrics contract v1 - windowing", () => {
  it("floors to deterministic UTC buckets", () => {
    const bucketMs = 60 * 60 * 1000;
    const date = new Date("2026-04-17T10:59:59.999Z");

    expect(floorToUtcBucket(date, bucketMs).toISOString()).toBe("2026-04-17T10:00:00.000Z");
    expect(floorToUtcBucket(new Date("2026-04-17T10:00:00.000Z"), bucketMs).toISOString()).toBe(
      "2026-04-17T10:00:00.000Z",
    );
  });

  it("ceils to deterministic UTC buckets", () => {
    const bucketMs = 60 * 60 * 1000;

    expect(ceilToUtcBucket(new Date("2026-04-17T10:00:00.000Z"), bucketMs).toISOString()).toBe(
      "2026-04-17T10:00:00.000Z",
    );
    expect(ceilToUtcBucket(new Date("2026-04-17T10:00:00.001Z"), bucketMs).toISOString()).toBe(
      "2026-04-17T11:00:00.000Z",
    );
  });

  it("defines a window with floor(start) and ceil(end)", () => {
    const granularityMs = metricsContractV1.windowing.granularityMs;
    const window = defineSnapshotWindow({
      start: new Date("2026-04-17T10:15:00.000Z"),
      end: new Date("2026-04-17T12:00:00.001Z"),
      granularityMs,
    });

    expect(window.granularityMs).toBe(granularityMs);
    expect(window.startInclusive.toISOString()).toBe("2026-04-17T10:00:00.000Z");
    expect(window.endExclusive.toISOString()).toBe("2026-04-17T13:00:00.000Z");
  });
});

describe("metrics contract v1 - lineage eligibility", () => {
  it("rejects missing run_id and missing root", () => {
    const result = isEligibleMetricsLineageCandidate({
      record: { table: "ai_run_evaluations", runId: null, eventLogId: 10 },
      hasRootAiEvent: false,
    });

    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining(["missing_run_id", "missing_root_ai_event"]));
    expect(result.canonicalRunId).toBeNull();
  });

  it("rejects non-canonical run_id", () => {
    const result = isEligibleMetricsLineageCandidate({
      record: { table: "ai_run_evaluations", runId: " run_bad ", eventLogId: 10 },
      hasRootAiEvent: true,
    });

    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual(["invalid_run_id_format"]);
  });

  it("rejects missing eventLogId for non-event_logs tables", () => {
    const result = isEligibleMetricsLineageCandidate({
      record: { table: "ai_run_evaluations", runId: "run_20260417t000000z_supplied123456", eventLogId: null },
      hasRootAiEvent: true,
    });

    expect(result.ok).toBe(false);
    expect(result.reasons).toEqual(["missing_event_log_id"]);
  });

  it("accepts canonical run_id with joinable root ai event", () => {
    const result = isEligibleMetricsLineageCandidate({
      record: { table: "ai_run_evaluations", runId: "run_20260417t000000z_supplied123456", eventLogId: 501 },
      hasRootAiEvent: true,
    });

    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.canonicalRunId).toBe("run_20260417t000000z_supplied123456");
  });
});
