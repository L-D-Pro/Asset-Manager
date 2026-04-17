import { and, eq } from "drizzle-orm";
import {
  db,
  eventLogsTable,
  resumeVersionsTable,
  coverLetterVersionsTable,
  aiRunEvaluationsTable,
  feedbackSignalsTable,
  type EventLog,
  type ResumeVersion,
  type CoverLetterVersion,
  type AiRunEvaluation,
  type FeedbackSignal,
} from "@workspace/db";

export const RUN_ID_PREFIX = "run";

export const lineageTableKinds = [
  "event_logs",
  "resume_versions",
  "cover_letter_versions",
  "ai_run_evaluations",
  "feedback_signals",
] as const;

export type LineageTableKind = (typeof lineageTableKinds)[number];
export type LineageEntityType = "ai_call" | "resume_version" | "cover_letter_version" | "ai_run_evaluation" | "feedback_signal";

export interface LineageRootRef {
  eventLogId?: number | null;
  runId?: string | null;
  jobId?: number | null;
  applicationId?: number | null;
}

export interface LineageRecordRef extends LineageRootRef {
  table: LineageTableKind;
  id?: number | null;
  entityType?: string | null;
  entityId?: number | null;
  resumeVersionId?: number | null;
  coverLetterVersionId?: number | null;
}

export interface LineageDiagnostics {
  table: LineageTableKind;
  recordId: number | null;
  runId: string | null;
  eventLogId: number | null;
  rootEventLogId: number | null;
  rootRunId: string | null;
  rootEventType: string | null;
  entityType: string | null;
  entityId: number | null;
  jobId: number | null;
  applicationId: number | null;
  reasons: string[];
  legacy: boolean;
}

export type LineageValidationStatus =
  | "valid"
  | "legacy_missing_run_id"
  | "invalid_run_id_format"
  | "missing_root_run"
  | "missing_root_ai_event"
  | "missing_child_linkage"
  | "mismatched_run_id"
  | "mismatched_event_linkage"
  | "mismatched_entity_reference";

export interface LineageValidationResult {
  ok: boolean;
  status: LineageValidationStatus;
  diagnostics: LineageDiagnostics;
  rootEvent: EventLog | null;
}

export type InScopeLineageRow =
  | ({ table: "event_logs" } & EventLog)
  | ({ table: "resume_versions" } & ResumeVersion)
  | ({ table: "cover_letter_versions" } & CoverLetterVersion)
  | ({ table: "ai_run_evaluations" } & AiRunEvaluation)
  | ({ table: "feedback_signals" } & FeedbackSignal);

export function mintRunId(seed?: { now?: Date; random?: string }): string {
  const now = seed?.now ?? new Date();
  const random = (seed?.random ?? crypto.randomUUID().replace(/-/g, "")).slice(0, 12);
  return `${RUN_ID_PREFIX}_${now.toISOString().replace(/[:.]/g, "").toLowerCase()}_${random}`;
}

export function isCanonicalRunId(value: unknown): value is string {
  return typeof value === "string" && /^run_[a-z0-9_-]{16,}$/i.test(value.trim());
}

export function normalizeRunId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function classifyLineageRecord(record: LineageRecordRef): {
  inScope: boolean;
  legacy: boolean;
  hasCanonicalRunId: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const runId = normalizeRunId(record.runId);
  const hasCanonicalRunId = isCanonicalRunId(runId);

  if (!runId) {
    reasons.push("missing_run_id");
  } else if (!hasCanonicalRunId) {
    reasons.push("invalid_run_id_format");
  }

  if (!record.eventLogId && record.table !== "event_logs") {
    reasons.push("missing_event_log_id");
  }

  const legacy = reasons.includes("missing_run_id");
  return {
    inScope: lineageTableKinds.includes(record.table),
    legacy,
    hasCanonicalRunId,
    reasons,
  };
}

export async function validateLineage(record: LineageRecordRef): Promise<LineageValidationResult> {
  const diagnostics: LineageDiagnostics = {
    table: record.table,
    recordId: record.id ?? null,
    runId: normalizeRunId(record.runId),
    eventLogId: record.eventLogId ?? null,
    rootEventLogId: null,
    rootRunId: null,
    rootEventType: null,
    entityType: record.entityType ?? null,
    entityId: record.entityId ?? null,
    jobId: record.jobId ?? null,
    applicationId: record.applicationId ?? null,
    reasons: [],
    legacy: false,
  };

  if (!diagnostics.runId) {
    diagnostics.legacy = true;
    diagnostics.reasons.push("missing_run_id");
    return {
      ok: false,
      status: "legacy_missing_run_id",
      diagnostics,
      rootEvent: null,
    };
  }

  if (!isCanonicalRunId(diagnostics.runId)) {
    diagnostics.reasons.push("invalid_run_id_format");
    return {
      ok: false,
      status: "invalid_run_id_format",
      diagnostics,
      rootEvent: null,
    };
  }

  const [rootEvent] = await db
    .select()
    .from(eventLogsTable)
    .where(and(eq(eventLogsTable.runId, diagnostics.runId), eq(eventLogsTable.entityType, "ai_call")))
    .orderBy(eventLogsTable.createdAt)
    .limit(1);

  if (!rootEvent) {
    diagnostics.reasons.push("missing_root_run");
    return {
      ok: false,
      status: "missing_root_run",
      diagnostics,
      rootEvent: null,
    };
  }

  diagnostics.rootEventLogId = rootEvent.id;
  diagnostics.rootRunId = rootEvent.runId;
  diagnostics.rootEventType = rootEvent.eventType;
  diagnostics.jobId ??= rootEvent.jobId ?? null;
  diagnostics.applicationId ??= rootEvent.applicationId ?? null;

  if (rootEvent.eventType !== "ai_call" && rootEvent.eventType !== "ai_call_failed") {
    diagnostics.reasons.push("missing_root_ai_event");
    return {
      ok: false,
      status: "missing_root_ai_event",
      diagnostics,
      rootEvent,
    };
  }

  if (record.table !== "event_logs" && !record.eventLogId) {
    diagnostics.reasons.push("missing_child_linkage");
    return {
      ok: false,
      status: "missing_child_linkage",
      diagnostics,
      rootEvent,
    };
  }

  if (record.eventLogId && record.eventLogId !== rootEvent.id) {
    const [linkedEvent] = await db
      .select()
      .from(eventLogsTable)
      .where(eq(eventLogsTable.id, record.eventLogId))
      .limit(1);

    if (!linkedEvent) {
      diagnostics.reasons.push("missing_child_linkage");
      return {
        ok: false,
        status: "missing_child_linkage",
        diagnostics,
        rootEvent,
      };
    }

    if (linkedEvent.runId !== diagnostics.runId) {
      diagnostics.reasons.push("mismatched_run_id");
      return {
        ok: false,
        status: "mismatched_run_id",
        diagnostics,
        rootEvent,
      };
    }

    const linkedEntityType = linkedEvent.entityType ?? null;
    const linkedEntityId = linkedEvent.entityId ?? null;
    if (
      record.entityType != null &&
      linkedEntityType != null &&
      record.entityType !== linkedEntityType &&
      record.table === "event_logs"
    ) {
      diagnostics.reasons.push("mismatched_entity_reference");
      return {
        ok: false,
        status: "mismatched_entity_reference",
        diagnostics,
        rootEvent,
      };
    }

    if (
      record.entityId != null &&
      linkedEntityId != null &&
      record.table === "event_logs" &&
      record.entityId !== linkedEntityId
    ) {
      diagnostics.reasons.push("mismatched_entity_reference");
      return {
        ok: false,
        status: "mismatched_entity_reference",
        diagnostics,
        rootEvent,
      };
    }
  }

  if (rootEvent.runId !== diagnostics.runId) {
    diagnostics.reasons.push("mismatched_run_id");
    return {
      ok: false,
      status: "mismatched_run_id",
      diagnostics,
      rootEvent,
    };
  }

  return {
    ok: true,
    status: "valid",
    diagnostics,
    rootEvent,
  };
}

export async function inspectLineage(table: LineageTableKind, id: number): Promise<LineageValidationResult | null> {
  switch (table) {
    case "event_logs": {
      const [row] = await db.select().from(eventLogsTable).where(eq(eventLogsTable.id, id)).limit(1);
      if (!row) return null;
      return validateLineage({
        table,
        id: row.id,
        runId: row.runId,
        eventLogId: row.id,
        entityType: row.entityType,
        entityId: row.entityId,
        jobId: row.jobId,
        applicationId: row.applicationId,
      });
    }
    case "resume_versions": {
      const [row] = await db.select().from(resumeVersionsTable).where(eq(resumeVersionsTable.id, id)).limit(1);
      if (!row) return null;
      return validateLineage({
        table,
        id: row.id,
        runId: row.runId,
        eventLogId: row.eventLogId,
        entityType: "resume_version",
        entityId: row.id,
        jobId: row.jobId,
      });
    }
    case "cover_letter_versions": {
      const [row] = await db.select().from(coverLetterVersionsTable).where(eq(coverLetterVersionsTable.id, id)).limit(1);
      if (!row) return null;
      return validateLineage({
        table,
        id: row.id,
        runId: row.runId,
        eventLogId: row.eventLogId,
        entityType: "cover_letter_version",
        entityId: row.id,
        jobId: row.jobId,
      });
    }
    case "ai_run_evaluations": {
      const [row] = await db.select().from(aiRunEvaluationsTable).where(eq(aiRunEvaluationsTable.id, id)).limit(1);
      if (!row) return null;
      return validateLineage({
        table,
        id: row.id,
        runId: row.runId,
        eventLogId: row.eventLogId,
        entityType: row.entityType,
        entityId: row.entityId,
      });
    }
    case "feedback_signals": {
      const [row] = await db.select().from(feedbackSignalsTable).where(eq(feedbackSignalsTable.id, id)).limit(1);
      if (!row) return null;
      return validateLineage({
        table,
        id: row.id,
        runId: row.runId,
        eventLogId: row.eventLogId,
        entityType: "feedback_signal",
        entityId: row.id,
        applicationId: row.applicationId,
        jobId: row.jobId,
        resumeVersionId: row.resumeVersionId,
        coverLetterVersionId: row.coverLetterVersionId,
      });
    }
  }
}
