import {
  defineSnapshotWindow,
  isEligibleMetricsLineageCandidate,
  type MetricsContractVersion,
} from "./metrics-contract";

export type AiMetricsSnapshotStatus = "ok" | "degraded";

export interface AiMetricsSnapshotResponseV1 {
  metricsVersion: MetricsContractVersion;
  window: {
    startInclusive: string;
    endExclusive: string;
    granularityMs: number;
  };
  taskScope: string | null;
  status: AiMetricsSnapshotStatus;
  degradedReasons: string[];
  lastKnownGoodSnapshot: null;
  aggregates: {
    evaluationCount: number;
    approvalOutcomeCounts: Record<string, number>;
  };
}

export type AiRunEvaluationRowLite = {
  runId: string | null;
  taskScope: string | null;
  eventLogId: number | null;
  createdAt: Date;
  approvalOutcome: string | null;
};

export function buildAiMetricsSnapshotV1(params: {
  metricsVersion: MetricsContractVersion;
  taskScope: string | null;
  windowStart: Date;
  windowEnd: Date;
  rows: AiRunEvaluationRowLite[];
  hasRootAiEventByRunId?: Record<string, boolean>;
}): AiMetricsSnapshotResponseV1 {
  const window = defineSnapshotWindow({ start: params.windowStart, end: params.windowEnd });

  const degradedReasons: string[] = [];
  const eligibleRows: AiRunEvaluationRowLite[] = [];

  for (const row of params.rows) {
    const canonicalRunId = row.runId ?? null;
    const hasRootAiEvent = canonicalRunId
      ? params.hasRootAiEventByRunId?.[canonicalRunId] ?? true
      : false;

    const eligibility = isEligibleMetricsLineageCandidate({
      record: {
        runId: row.runId,
        table: "ai_run_evaluations",
        eventLogId: row.eventLogId,
      },
      hasRootAiEvent,
    });

    if (!eligibility.ok) {
      degradedReasons.push(...eligibility.reasons.map((r) => `row_${r}`));
      continue;
    }

    eligibleRows.push(row);
  }

  const approvalOutcomeCounts: Record<string, number> = {};
  for (const row of eligibleRows) {
    const key = row.approvalOutcome ?? "unknown";
    approvalOutcomeCounts[key] = (approvalOutcomeCounts[key] ?? 0) + 1;
  }

  const status: AiMetricsSnapshotStatus = degradedReasons.length > 0 ? "degraded" : "ok";

  return {
    metricsVersion: params.metricsVersion,
    taskScope: params.taskScope,
    window: {
      startInclusive: window.startInclusive.toISOString(),
      endExclusive: window.endExclusive.toISOString(),
      granularityMs: window.granularityMs,
    },
    status,
    degradedReasons: Array.from(new Set(degradedReasons)).sort(),
    lastKnownGoodSnapshot: null,
    aggregates: {
      evaluationCount: eligibleRows.length,
      approvalOutcomeCounts,
    },
  };
}
