import { isCanonicalRunId, normalizeRunId } from "./lineage-shared";

export type LineageRecordRefLite = {
  runId?: string | null;
  table: "event_logs" | "resume_versions" | "cover_letter_versions" | "ai_run_evaluations" | "feedback_signals";
  eventLogId?: number | null;
};

export type MetricsContractVersion = "v1";

export interface MetricsContractDefinitionV1 {
  version: "v1";
  windowing: {
    timezone: "UTC";
    granularityMs: number;
  };
  evaluationSchema: {
    // Mirrors key fields from lib/db/src/schema/ai-run-evaluations.ts.
    editDistanceField: "editDistance";
    rubricScoreFields: ["truthfulnessScore", "relevanceScore", "formattingScore", "attributionScore"];
    outcomeFields: ["approvalOutcome", "downstreamOutcome"];
    notesField: "notes";
    metadataField: "metadata";
  };
}

export const metricsContractV1: MetricsContractDefinitionV1 = {
  version: "v1",
  windowing: {
    timezone: "UTC",
    granularityMs: 60 * 60 * 1000, // hour buckets; stable + sufficient for snapshot windows
  },
  evaluationSchema: {
    editDistanceField: "editDistance",
    rubricScoreFields: ["truthfulnessScore", "relevanceScore", "formattingScore", "attributionScore"],
    outcomeFields: ["approvalOutcome", "downstreamOutcome"],
    notesField: "notes",
    metadataField: "metadata",
  },
};

export interface SnapshotWindow {
  startInclusive: Date;
  endExclusive: Date;
  granularityMs: number;
}

function assertValidDate(value: Date, label: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${label} must be a valid Date`);
  }
}

/**
 * Deterministically round a timestamp down to the start of its UTC bucket.
 */
export function floorToUtcBucket(date: Date, bucketMs: number): Date {
  assertValidDate(date, "date");
  if (!Number.isFinite(bucketMs) || bucketMs <= 0) {
    throw new Error("bucketMs must be a positive number");
  }

  const ms = date.getTime();
  return new Date(Math.floor(ms / bucketMs) * bucketMs);
}

/**
 * Deterministically round a timestamp up to the start of the next UTC bucket,
 * unless it is already aligned.
 */
export function ceilToUtcBucket(date: Date, bucketMs: number): Date {
  assertValidDate(date, "date");
  if (!Number.isFinite(bucketMs) || bucketMs <= 0) {
    throw new Error("bucketMs must be a positive number");
  }

  const ms = date.getTime();
  const floored = Math.floor(ms / bucketMs) * bucketMs;
  if (ms === floored) return new Date(ms);
  return new Date((Math.floor(ms / bucketMs) + 1) * bucketMs);
}

/**
 * Define a deterministic window: start is floored, end is ceiled.
 *
 * Semantics:
 * - startInclusive <= eventTime < endExclusive
 * - both bounds are aligned to the contract granularity
 */
export function defineSnapshotWindow(params: {
  start: Date;
  end: Date;
  granularityMs?: number;
}): SnapshotWindow {
  const granularityMs = params.granularityMs ?? metricsContractV1.windowing.granularityMs;
  assertValidDate(params.start, "start");
  assertValidDate(params.end, "end");

  const startInclusive = floorToUtcBucket(params.start, granularityMs);
  const endExclusive = ceilToUtcBucket(params.end, granularityMs);

  if (endExclusive.getTime() < startInclusive.getTime()) {
    throw new Error("snapshot window end must be >= start");
  }

  return { startInclusive, endExclusive, granularityMs };
}

/**
 * Secretless inclusion predicate used by snapshot logic:
 * a row is eligible only if it has a canonical run_id and a joinable root AI event.
 *
 * Since DB access is not part of this task, callers pass whether the run_id has
 * an AI root event (e.g. derived by joining event_logs).
 */
export function isEligibleMetricsLineageCandidate(params: {
  record: Pick<LineageRecordRefLite, "runId" | "table" | "eventLogId">;
  hasRootAiEvent: boolean;
}): { ok: boolean; reasons: string[]; canonicalRunId: string | null } {
  const reasons: string[] = [];
  const canonicalRunId = normalizeRunId(params.record.runId);

  if (!canonicalRunId) {
    reasons.push("missing_run_id");
  } else if (!isCanonicalRunId(canonicalRunId)) {
    reasons.push("invalid_run_id_format");
  }

  if (!params.record.eventLogId && params.record.table !== "event_logs") {
    reasons.push("missing_event_log_id");
  }

  if (!params.hasRootAiEvent) {
    reasons.push("missing_root_ai_event");
  }

  return {
    ok: reasons.length === 0,
    reasons,
    canonicalRunId: canonicalRunId && isCanonicalRunId(canonicalRunId) ? canonicalRunId : null,
  };
}
