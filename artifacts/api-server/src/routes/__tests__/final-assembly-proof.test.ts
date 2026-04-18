import { describe, expect, it } from "vitest";

import {
  isEligibleMetricsLineageCandidate,
  type LineageRecordRefLite,
} from "../../lib/metrics-contract";
import { buildAiMetricsSnapshotV1, type AiRunEvaluationRowLite } from "../../lib/ai-metrics-snapshot";
import { isCanonicalRunId } from "../../lib/lineage-shared";

function makeCanonicalRunId(seed: string): string {
  // Our canonical matcher allows [a-z0-9_-]{16,} after run_
  const suffix = seed.replace(/[^a-z0-9_-]/gi, "").toLowerCase().padEnd(16, "a");
  return `run_${suffix}`;
}

type EventLogRowLite = { id: number; runId: string | null; entityType: string };

function hasRootAiEventByRunId(eventLogs: EventLogRowLite[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const e of eventLogs) {
    if (!e.runId) continue;
    map[e.runId] ??= false;
    if (e.entityType === "ai_call") map[e.runId] = true;
  }
  return map;
}

/**
 * Simulate the contract semantics we rely on:
 * - event logs are append-only (additive)
 * - ai_run_evaluations are upserted by (run_id, task_scope, entity)
 */
function upsertEvaluation(
  rows: AiRunEvaluationRowLite[],
  next: AiRunEvaluationRowLite & { taskScope: string | null; runId: string | null },
): AiRunEvaluationRowLite[] {
  const idx = rows.findIndex(
    (r) =>
      r.runId === next.runId &&
      r.taskScope === next.taskScope &&
      r.eventLogId === next.eventLogId,
  );

  if (idx === -1) return [...rows, next];
  const copy = rows.slice();
  copy[idx] = { ...rows[idx], ...next };
  return copy;
}

describe("final assembly proof", () => {
  it("encodes joinability: eligible candidates require canonical run_id + event_log_id + root ai event", () => {
    const runId = makeCanonicalRunId("2026_04_18_final_assembly_ok");
    expect(isCanonicalRunId(runId)).toBe(true);

    const record: Pick<LineageRecordRefLite, "runId" | "table" | "eventLogId"> = {
      runId,
      table: "ai_run_evaluations",
      eventLogId: 10,
    };

    const ok = isEligibleMetricsLineageCandidate({ record, hasRootAiEvent: true });
    expect(ok.ok).toBe(true);
    expect(ok.reasons).toEqual([]);
    expect(ok.canonicalRunId).toBe(runId);

    const missingRoot = isEligibleMetricsLineageCandidate({ record, hasRootAiEvent: false });
    expect(missingRoot.ok).toBe(false);
    expect(missingRoot.reasons).toContain("missing_root_ai_event");

    const missingEventLog = isEligibleMetricsLineageCandidate({
      record: { ...record, eventLogId: null },
      hasRootAiEvent: true,
    });
    expect(missingEventLog.ok).toBe(false);
    expect(missingEventLog.reasons).toContain("missing_event_log_id");

    const missingRunId = isEligibleMetricsLineageCandidate({
      record: { ...record, runId: null },
      hasRootAiEvent: true,
    });
    expect(missingRunId.ok).toBe(false);
    expect(missingRunId.reasons).toContain("missing_run_id");
  });

  it("fails closed in snapshot assembly when lineage pieces are missing", () => {
    const runOk = makeCanonicalRunId("run_ok");
    const runNoRoot = makeCanonicalRunId("run_no_root");

    const eventLogs: EventLogRowLite[] = [
      { id: 10, runId: runOk, entityType: "ai_call" },
      // no ai_call root for runNoRoot
      { id: 11, runId: runNoRoot, entityType: "other" },
    ];

    const rows: AiRunEvaluationRowLite[] = [
      {
        runId: runOk,
        taskScope: "resume_review",
        eventLogId: 10,
        createdAt: new Date("2026-04-18T00:00:00.000Z"),
        approvalOutcome: "approved",
        editDistance: 10,
        truthfulnessScore: 4,
        relevanceScore: 5,
        formattingScore: 3,
        attributionScore: 2,
        promptVersionId: 1,
      },
      {
        runId: runNoRoot,
        taskScope: "resume_review",
        eventLogId: 11,
        createdAt: new Date("2026-04-18T00:10:00.000Z"),
        approvalOutcome: "approved",
        editDistance: 5,
        promptVersionId: 1,
      },
      {
        runId: null,
        taskScope: "resume_review",
        eventLogId: 12,
        createdAt: new Date("2026-04-18T00:20:00.000Z"),
        approvalOutcome: "approved",
        editDistance: 1,
      },
      {
        runId: runOk,
        taskScope: "resume_review",
        eventLogId: null,
        createdAt: new Date("2026-04-18T00:30:00.000Z"),
        approvalOutcome: "approved",
        editDistance: 1,
      },
    ];

    const snapshot = buildAiMetricsSnapshotV1({
      metricsVersion: "v1",
      taskScope: "resume_review",
      windowStart: new Date("2026-04-18T00:00:00.000Z"),
      windowEnd: new Date("2026-04-18T01:00:00.000Z"),
      rows,
      hasRootAiEventByRunId: hasRootAiEventByRunId(eventLogs),
    });

    // Only the fully joinable row remains eligible.
    expect(snapshot.aggregates.evaluationCount).toBe(1);
    expect(snapshot.aggregates.approvalOutcomeCounts).toEqual({ approved: 1 });

    // Degraded status because we saw non-eligible rows.
    expect(snapshot.status).toBe("degraded");
    expect(snapshot.degradedReasons).toContain("row_missing_root_ai_event");
    expect(snapshot.degradedReasons).toContain("row_missing_run_id");
    expect(snapshot.degradedReasons).toContain("row_missing_event_log_id");
  });

  it("enforces append-only vs upsert precedence: event logs remain additive while evaluations overwrite per key", () => {
    const runId = makeCanonicalRunId("run_precedence");

    const eventLogs: EventLogRowLite[] = [];
    const appendEventLog = (row: EventLogRowLite) => {
      eventLogs.push(row);
    };

    appendEventLog({ id: 10, runId, entityType: "ai_call" });
    appendEventLog({ id: 11, runId, entityType: "ai_call" });

    expect(eventLogs.map((e) => e.id)).toEqual([10, 11]);

    let evaluations: AiRunEvaluationRowLite[] = [];

    evaluations = upsertEvaluation(evaluations, {
      runId,
      taskScope: "resume_review",
      eventLogId: 10,
      createdAt: new Date("2026-04-18T00:00:00.000Z"),
      approvalOutcome: "approved",
      editDistance: 15,
    });

    evaluations = upsertEvaluation(evaluations, {
      runId,
      taskScope: "resume_review",
      eventLogId: 10,
      createdAt: new Date("2026-04-18T00:00:00.000Z"),
      approvalOutcome: "rejected",
      editDistance: 99,
    });

    // Only one evaluation row remains after upsert; the newest outcome wins.
    expect(evaluations).toHaveLength(1);
    expect(evaluations[0]!.approvalOutcome).toBe("rejected");
    expect(evaluations[0]!.editDistance).toBe(99);

    const snapshot = buildAiMetricsSnapshotV1({
      metricsVersion: "v1",
      taskScope: "resume_review",
      windowStart: new Date("2026-04-18T00:00:00.000Z"),
      windowEnd: new Date("2026-04-18T01:00:00.000Z"),
      rows: evaluations,
      hasRootAiEventByRunId: { [runId]: true },
    });

    expect(snapshot.status).toBe("ok");
    expect(snapshot.aggregates.evaluationCount).toBe(1);
    expect(snapshot.aggregates.approvalOutcomeCounts).toEqual({ rejected: 1 });
  });
});
