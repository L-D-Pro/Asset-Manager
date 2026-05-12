import { and, eq, inArray, or } from "drizzle-orm";
import {
  aiRunEvaluationsTable,
  aiTrainingExamplesTable,
  applicationsTable,
  coverLetterVersionsTable,
  db,
  eventLogsTable,
  feedbackSignalsTable,
  jobsTable,
  resumeVersionsTable,
  wizardSessionsTable,
} from "@workspace/db";

type WizardState = Record<string, unknown>;

function toObject(value: unknown): WizardState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as WizardState;
}

function scrubWizardStateIds(
  state: WizardState,
  args: {
    jobIds?: number[];
    resumeVersionIds?: number[];
    coverLetterVersionIds?: number[];
  },
): { nextState: WizardState; changed: boolean } {
  const nextState: WizardState = { ...state };
  let changed = false;

  const matchesJob =
    typeof nextState.jobId === "number" &&
    (args.jobIds ?? []).includes(nextState.jobId as number);
  const matchesResume =
    typeof nextState.resumeVersionId === "number" &&
    (args.resumeVersionIds ?? []).includes(nextState.resumeVersionId as number);
  const matchesCover =
    typeof nextState.coverLetterVersionId === "number" &&
    (args.coverLetterVersionIds ?? []).includes(nextState.coverLetterVersionId as number);

  if (matchesJob) {
    delete nextState.jobId;
    changed = true;
  }
  if (matchesResume) {
    delete nextState.resumeVersionId;
    changed = true;
  }
  if (matchesCover) {
    delete nextState.coverLetterVersionId;
    changed = true;
  }

  return { nextState, changed };
}

export async function scrubWizardStateReferences(args: {
  jobIds?: number[];
  resumeVersionIds?: number[];
  coverLetterVersionIds?: number[];
}): Promise<number> {
  const rows = await db.select().from(wizardSessionsTable);
  if (rows.length === 0) return 0;

  let scrubbedCount = 0;
  for (const row of rows) {
    const state = toObject(row.state);
    const { nextState, changed } = scrubWizardStateIds(state, args);
    if (!changed) continue;
    await db
      .update(wizardSessionsTable)
      .set({
        state: nextState,
        jobId:
          typeof nextState.jobId === "number"
            ? (nextState.jobId as number)
            : null,
      })
      .where(eq(wizardSessionsTable.id, row.id));
    scrubbedCount += 1;
  }

  return scrubbedCount;
}

export async function nukeJobAttemptData(jobId: number): Promise<{
  deletedResumeVersions: number;
  deletedCoverLetterVersions: number;
  deletedApplications: number;
  deletedFeedbackSignals: number;
  deletedEventLogs: number;
  deletedEvaluations: number;
  deletedTrainingExamples: number;
  scrubbedWizardSessions: number;
  deletedJob: boolean;
}> {
  return db.transaction(async (tx) => {
    const resumeRows = await tx
      .select({
        id: resumeVersionsTable.id,
        runId: resumeVersionsTable.runId,
      })
      .from(resumeVersionsTable)
      .where(eq(resumeVersionsTable.jobId, jobId));
    const coverRows = await tx
      .select({
        id: coverLetterVersionsTable.id,
        runId: coverLetterVersionsTable.runId,
      })
      .from(coverLetterVersionsTable)
      .where(eq(coverLetterVersionsTable.jobId, jobId));
    const appRows = await tx
      .select({ id: applicationsTable.id })
      .from(applicationsTable)
      .where(eq(applicationsTable.jobId, jobId));
    const eventRows = await tx
      .select({ id: eventLogsTable.id, runId: eventLogsTable.runId })
      .from(eventLogsTable)
      .where(eq(eventLogsTable.jobId, jobId));

    const resumeIds = resumeRows.map((row) => row.id);
    const coverIds = coverRows.map((row) => row.id);
    const applicationIds = appRows.map((row) => row.id);
    const eventLogIds = eventRows.map((row) => row.id);
    const runIds = [
      ...new Set(
        [...resumeRows.map((row) => row.runId), ...coverRows.map((row) => row.runId), ...eventRows.map((row) => row.runId)]
          .filter((runId): runId is string => typeof runId === "string" && runId.length > 0),
      ),
    ];

    const evaluationDeleteConditions = [];
    if (eventLogIds.length > 0) {
      evaluationDeleteConditions.push(inArray(aiRunEvaluationsTable.eventLogId, eventLogIds));
    }
    if (runIds.length > 0) {
      evaluationDeleteConditions.push(inArray(aiRunEvaluationsTable.runId, runIds));
    }
    if (resumeIds.length > 0) {
      evaluationDeleteConditions.push(
        and(
          eq(aiRunEvaluationsTable.entityType, "resume_version"),
          inArray(aiRunEvaluationsTable.entityId, resumeIds),
        ),
      );
    }
    if (coverIds.length > 0) {
      evaluationDeleteConditions.push(
        and(
          eq(aiRunEvaluationsTable.entityType, "cover_letter_version"),
          inArray(aiRunEvaluationsTable.entityId, coverIds),
        ),
      );
    }
    const deletedEvaluations = evaluationDeleteConditions.length
      ? (
          await tx
            .delete(aiRunEvaluationsTable)
            .where(or(...evaluationDeleteConditions))
            .returning({ id: aiRunEvaluationsTable.id })
        ).length
      : 0;

    const trainingDeleteConditions = [];
    if (resumeIds.length > 0) {
      trainingDeleteConditions.push(
        and(
          eq(aiTrainingExamplesTable.sourceEntityType, "resume_version"),
          inArray(aiTrainingExamplesTable.sourceEntityId, resumeIds),
        ),
      );
    }
    if (coverIds.length > 0) {
      trainingDeleteConditions.push(
        and(
          eq(aiTrainingExamplesTable.sourceEntityType, "cover_letter_version"),
          inArray(aiTrainingExamplesTable.sourceEntityId, coverIds),
        ),
      );
    }
    const deletedTrainingExamples = trainingDeleteConditions.length
      ? (
          await tx
            .delete(aiTrainingExamplesTable)
            .where(or(...trainingDeleteConditions))
            .returning({ id: aiTrainingExamplesTable.id })
        ).length
      : 0;

    const deletedFeedbackSignals = applicationIds.length
      ? (
          await tx
            .delete(feedbackSignalsTable)
            .where(inArray(feedbackSignalsTable.applicationId, applicationIds))
            .returning({ id: feedbackSignalsTable.id })
        ).length
      : 0;

    const deletedApplications = (
      await tx
        .delete(applicationsTable)
        .where(eq(applicationsTable.jobId, jobId))
        .returning({ id: applicationsTable.id })
    ).length;

    const deletedResumeVersions = (
      await tx
        .delete(resumeVersionsTable)
        .where(eq(resumeVersionsTable.jobId, jobId))
        .returning({ id: resumeVersionsTable.id })
    ).length;

    const deletedCoverLetterVersions = (
      await tx
        .delete(coverLetterVersionsTable)
        .where(eq(coverLetterVersionsTable.jobId, jobId))
        .returning({ id: coverLetterVersionsTable.id })
    ).length;

    const deletedEventLogs = (
      await tx
        .delete(eventLogsTable)
        .where(eq(eventLogsTable.jobId, jobId))
        .returning({ id: eventLogsTable.id })
    ).length;

    const deletedJob = (
      await tx
        .delete(jobsTable)
        .where(eq(jobsTable.id, jobId))
        .returning({ id: jobsTable.id })
    ).length > 0;

    const scrubbedWizardSessions = await scrubWizardStateReferences({
      jobIds: [jobId],
      resumeVersionIds: resumeIds,
      coverLetterVersionIds: coverIds,
    });

    return {
      deletedResumeVersions,
      deletedCoverLetterVersions,
      deletedApplications,
      deletedFeedbackSignals,
      deletedEventLogs,
      deletedEvaluations,
      deletedTrainingExamples,
      scrubbedWizardSessions,
      deletedJob,
    };
  });
}

export async function scrubWizardStatesForDeletedEntities(): Promise<number> {
  const existingJobs = new Set(
    (
      await db.select({ id: jobsTable.id }).from(jobsTable)
    ).map((row) => row.id),
  );
  const existingResumes = new Set(
    (
      await db.select({ id: resumeVersionsTable.id }).from(resumeVersionsTable)
    ).map((row) => row.id),
  );
  const existingCovers = new Set(
    (
      await db.select({ id: coverLetterVersionsTable.id }).from(coverLetterVersionsTable)
    ).map((row) => row.id),
  );

  const sessions = await db.select().from(wizardSessionsTable);
  let scrubbed = 0;

  for (const session of sessions) {
    const state = toObject(session.state);
    const staleJobIds =
      typeof state.jobId === "number" && !existingJobs.has(state.jobId as number)
        ? [state.jobId as number]
        : [];
    const staleResumeIds =
      typeof state.resumeVersionId === "number" && !existingResumes.has(state.resumeVersionId as number)
        ? [state.resumeVersionId as number]
        : [];
    const staleCoverIds =
      typeof state.coverLetterVersionId === "number" && !existingCovers.has(state.coverLetterVersionId as number)
        ? [state.coverLetterVersionId as number]
        : [];

    if (staleJobIds.length === 0 && staleResumeIds.length === 0 && staleCoverIds.length === 0) continue;

    const { nextState } = scrubWizardStateIds(state, {
      jobIds: staleJobIds,
      resumeVersionIds: staleResumeIds,
      coverLetterVersionIds: staleCoverIds,
    });
    await db
      .update(wizardSessionsTable)
      .set({
        state: nextState,
        jobId:
          typeof nextState.jobId === "number"
            ? (nextState.jobId as number)
            : null,
      })
      .where(eq(wizardSessionsTable.id, session.id));
    scrubbed += 1;
  }

  return scrubbed;
}
