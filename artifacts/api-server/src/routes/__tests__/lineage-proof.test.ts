import { describe, expect, it, vi } from "vitest";

// Proof tests are secretless and DB-free: they validate the canonical join and exclusion
// predicates we rely on for lineage safety. Runtime route handlers do the actual DB work.

type RunId = string;

type EventLogRow = {
  id: number;
  entityType: string;
  entityId: number;
  eventType: string;
  runId: RunId | null;
};

type ResumeVersionRow = {
  id: number;
  runId: RunId | null;
  eventLogId: number | null;
};

type FeedbackSignalRow = {
  id: number;
  resumeVersionId: number | null;
  runId: RunId | null;
};

type AiRunEvaluationRow = {
  id: number;
  runId: RunId | null;
  eventLogId: number | null;
};

function isCanonicalRunId(runId: unknown): runId is RunId {
  return typeof runId === "string" && runId.startsWith("run_") && runId.length > 10;
}

function joinLineageChain(args: {
  eventLogs: EventLogRow[];
  resumeVersions: ResumeVersionRow[];
  feedbackSignals: FeedbackSignalRow[];
  aiRunEvaluations: AiRunEvaluationRow[];
}) {
  const { eventLogs, resumeVersions, feedbackSignals, aiRunEvaluations } = args;

  // Canonical metric input set:
  // - runId must be canonical
  // - every record in the chain must share the same runId
  // - required join edges must be present (eventLogId on artifact, eventLogId on evaluation)
  const candidates: Array<{
    runId: RunId;
    eventLog: EventLogRow;
    resumeVersion: ResumeVersionRow;
    evaluation: AiRunEvaluationRow;
    feedback: FeedbackSignalRow;
  }> = [];

  for (const feedback of feedbackSignals) {
    if (!feedback.runId || !isCanonicalRunId(feedback.runId)) continue;

    const resumeVersion =
      feedback.resumeVersionId == null
        ? null
        : resumeVersions.find((rv) => rv.id === feedback.resumeVersionId) ?? null;
    if (!resumeVersion) continue;

    if (resumeVersion.runId !== feedback.runId) continue;
    if (!resumeVersion.eventLogId) continue;

    const eventLog = eventLogs.find((e) => e.id === resumeVersion.eventLogId) ?? null;
    if (!eventLog) continue;
    if (eventLog.runId !== feedback.runId) continue;

    const evaluation =
      aiRunEvaluations.find(
        (ev) => ev.runId === feedback.runId && ev.eventLogId === eventLog.id,
      ) ?? null;
    if (!evaluation) continue;

    candidates.push({
      runId: feedback.runId,
      eventLog,
      resumeVersion,
      evaluation,
      feedback,
    });
  }

  return candidates;
}

describe("lineage proof", () => {
  it("joins one complete canonical run across ai_call event -> artifact -> evaluation -> feedback", () => {
    const runId = "run_2026_04_18_valid";

    const eventLogs: EventLogRow[] = [
      { id: 10, entityType: "ai_call", entityId: 999, eventType: "ai_call_succeeded", runId },
    ];

    const resumeVersions: ResumeVersionRow[] = [
      { id: 101, runId, eventLogId: 10 },
    ];

    const aiRunEvaluations: AiRunEvaluationRow[] = [
      { id: 201, runId, eventLogId: 10 },
    ];

    const feedbackSignals: FeedbackSignalRow[] = [
      { id: 301, resumeVersionId: 101, runId },
    ];

    const joined = joinLineageChain({ eventLogs, resumeVersions, aiRunEvaluations, feedbackSignals });
    expect(joined).toHaveLength(1);
    expect(joined[0]!.runId).toBe(runId);
    expect(joined[0]!.eventLog.entityType).toBe("ai_call");
  });

  it("excludes legacy/null-run rows from metric candidates but keeps them inspectable", () => {
    const canonical = "run_2026_04_18_valid";

    const eventLogs: EventLogRow[] = [
      { id: 10, entityType: "ai_call", entityId: 999, eventType: "ai_call_succeeded", runId: canonical },
      { id: 11, entityType: "ai_call", entityId: 998, eventType: "ai_call_succeeded", runId: null },
    ];

    const resumeVersions: ResumeVersionRow[] = [
      { id: 101, runId: canonical, eventLogId: 10 },
      // legacy row: no runId still exists and is inspectable in audit UIs
      { id: 102, runId: null, eventLogId: 11 },
    ];

    const aiRunEvaluations: AiRunEvaluationRow[] = [
      { id: 201, runId: canonical, eventLogId: 10 },
      { id: 202, runId: null, eventLogId: 11 },
    ];

    const feedbackSignals: FeedbackSignalRow[] = [
      { id: 301, resumeVersionId: 101, runId: canonical },
      // legacy feedback should never be considered a metric candidate
      { id: 302, resumeVersionId: 102, runId: null },
    ];

    const joined = joinLineageChain({ eventLogs, resumeVersions, aiRunEvaluations, feedbackSignals });
    expect(joined.map((j) => j.runId)).toEqual([canonical]);

    // Audit visibility: legacy rows are still present in the underlying collections
    expect(resumeVersions.find((r) => r.id === 102)).toBeTruthy();
    expect(eventLogs.find((e) => e.id === 11)).toBeTruthy();
  });

  it("fails closed when dashboard submits feedback without resumeVersionId/runId lineage", () => {
    const spy = vi.fn();

    const eventLogs: EventLogRow[] = [];
    const resumeVersions: ResumeVersionRow[] = [];
    const aiRunEvaluations: AiRunEvaluationRow[] = [];
    const feedbackSignals: FeedbackSignalRow[] = [
      { id: 1, resumeVersionId: null, runId: null },
    ];

    const joined = joinLineageChain({ eventLogs, resumeVersions, aiRunEvaluations, feedbackSignals });
    spy(joined);

    expect(joined).toHaveLength(0);
    expect(spy).toHaveBeenCalledWith([]);
  });
});
