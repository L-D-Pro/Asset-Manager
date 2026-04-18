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

    /**
     * Aggregates grouped by promptVersionId (stringified; null -> "unknown").
     */
    byPromptVersion: Record<
      string,
      {
        evaluationCount: number;
        approvalOutcomeCounts: Record<string, number>;
        avgEditDistance: number | null;
        avgRubricScores: Record<string, number | null>;
      }
    >;
  };

  /**
   * Per-bucket time series over eligible rows. Buckets align to window.granularityMs.
   */
  series: Array<{
    bucketStartInclusive: string;
    evaluationCount: number;
    approvalOutcomeCounts: Record<string, number>;
    avgEditDistance: number | null;
    avgRubricScores: Record<string, number | null>;
  }>;
}

export type AiRunEvaluationRowLite = {
  runId: string | null;
  taskScope: string | null;
  eventLogId: number | null;
  createdAt: Date;
  approvalOutcome: string | null;

  promptVersionId?: number | null;
  editDistance?: number | null;
  truthfulnessScore?: number | null;
  relevanceScore?: number | null;
  formattingScore?: number | null;
  attributionScore?: number | null;
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
      : true;

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

  function toOutcomeKey(value: string | null | undefined): string {
    return value ?? "unknown";
  }

  function toPromptKey(value: number | null | undefined): string {
    if (value === null || value === undefined) return "unknown";
    return String(value);
  }

  type RubricScoreField = "truthfulnessScore" | "relevanceScore" | "formattingScore" | "attributionScore";
  const rubricFields: RubricScoreField[] = [
    "truthfulnessScore",
    "relevanceScore",
    "formattingScore",
    "attributionScore",
  ];

  function initRubricAverages(): Record<string, number | null> {
    return {
      truthfulnessScore: null,
      relevanceScore: null,
      formattingScore: null,
      attributionScore: null,
    };
  }

  function computeAverages(rows: AiRunEvaluationRowLite[]): {
    avgEditDistance: number | null;
    avgRubricScores: Record<string, number | null>;
  } {
    const editDistanceValues = rows
      .map((r) => r.editDistance)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

    const avgEditDistance = editDistanceValues.length
      ? editDistanceValues.reduce((a, b) => a + b, 0) / editDistanceValues.length
      : null;

    const avgRubricScores: Record<string, number | null> = initRubricAverages();

    for (const field of rubricFields) {
      const values = rows
        .map((r) => r[field])
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      avgRubricScores[field] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    }

    return { avgEditDistance, avgRubricScores };
  }

  function computeOutcomeCounts(rows: AiRunEvaluationRowLite[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const key = toOutcomeKey(row.approvalOutcome);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }

  const approvalOutcomeCounts = computeOutcomeCounts(eligibleRows);

  const byPromptVersion: AiMetricsSnapshotResponseV1["aggregates"]["byPromptVersion"] = {};
  for (const row of eligibleRows) {
    const key = toPromptKey(row.promptVersionId);
    byPromptVersion[key] ??= {
      evaluationCount: 0,
      approvalOutcomeCounts: {},
      avgEditDistance: null,
      avgRubricScores: initRubricAverages(),
    };

    byPromptVersion[key].evaluationCount += 1;
    const outcomeKey = toOutcomeKey(row.approvalOutcome);
    byPromptVersion[key].approvalOutcomeCounts[outcomeKey] =
      (byPromptVersion[key].approvalOutcomeCounts[outcomeKey] ?? 0) + 1;
  }

  // Populate averages per prompt version.
  for (const key of Object.keys(byPromptVersion)) {
    const groupRows = eligibleRows.filter((r) => toPromptKey(r.promptVersionId) === key);
    const { avgEditDistance, avgRubricScores } = computeAverages(groupRows);
    byPromptVersion[key].avgEditDistance = avgEditDistance;
    byPromptVersion[key].avgRubricScores = avgRubricScores;
  }

  // Build per-bucket time series.
  const buckets = new Map<number, AiRunEvaluationRowLite[]>();
  for (const row of eligibleRows) {
    const bucketMs = window.granularityMs;
    const bucketStart = new Date(Math.floor(row.createdAt.getTime() / bucketMs) * bucketMs).getTime();
    const list = buckets.get(bucketStart) ?? [];
    list.push(row);
    buckets.set(bucketStart, list);
  }

  const series: AiMetricsSnapshotResponseV1["series"] = Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucketStartMs, bucketRows]) => {
      const { avgEditDistance, avgRubricScores } = computeAverages(bucketRows);
      return {
        bucketStartInclusive: new Date(bucketStartMs).toISOString(),
        evaluationCount: bucketRows.length,
        approvalOutcomeCounts: computeOutcomeCounts(bucketRows),
        avgEditDistance,
        avgRubricScores,
      };
    });

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
      byPromptVersion,
    },
    series,
  };
}
