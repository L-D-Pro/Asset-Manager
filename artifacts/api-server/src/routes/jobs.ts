import { Router, type IRouter } from "express";
import type { JobOpsRequest } from "../lib/http-types";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  eventLogsTable,
  jobsTable,
  roleProfilesTable,
  claimsTable,
  resumeVersionsTable,
  coverLetterVersionsTable,
  baseResumeVersionsTable,
} from "@workspace/db";
import {
  ListJobsQueryParams,
  ListJobsResponse,
  CreateJobBody,
  GetJobParams,
  GetJobResponse,
  UpdateJobParams,
  UpdateJobBody,
  UpdateJobResponse,
  DeleteJobParams,
  ScoreJobParams,
  ScoreJobQueryParams,
  ScoreJobResponse,
  ParseJobDescriptionParams,
  ParseJobDescriptionBody,
  ParseJobDescriptionResponse,
  GetJobClaimMatchesParams,
  GetJobClaimMatchesResponse,
  TailorJobResumeParams,
  TailorJobResumeBody,
  GetResumeVersionResponse,
  DraftCoverLetterParams,
  DraftCoverLetterBody,
  GetCoverLetterVersionResponse,
} from "@workspace/api-zod";
import { scoreJobAgainstProfile, matchClaimsToJob } from "../lib/scoring";
import { scoreResumeAgainstJob } from "../lib/semantic-scoring";
import { runJdParsePipeline } from "../lib/pipelines/jd-parse";
import {
  runResumeTailorPipeline,
  MissingBaseResumeError,
} from "../lib/pipelines/resume-tailor";
import { runCoverLetterPipeline } from "../lib/pipelines/cover-letter-draft";
import { runJobResearchPipeline } from "../lib/pipelines/job-research";
import { runGapAnalysisPipeline } from "../lib/pipelines/gap-analysis";
import { mintRunId } from "../lib/lineage";
import { awardXp } from "../lib/gamification";
import { nukeJobAttemptData, scrubWizardStateReferences } from "../lib/wizard-state-cleanup";
import { z } from "zod/v4";
import { currentUserId } from "../lib/ownership";

const router: IRouter = Router();

const modelOverrideSchema = z.object({
  provider: z.string().optional(),
  modelName: z.string().min(1),
});

const compareBodySchema = z.object({
  claimIds: z.array(z.number()).optional(),
  templateId: z.string().optional(),
  models: z.array(modelOverrideSchema).min(1).max(3),
});

const promoteBodySchema = z.object({
  claimIds: z.array(z.number()).optional(),
  templateId: z.string().optional(),
  model: modelOverrideSchema.optional(),
  candidateVersionId: z.number().int().positive().optional(),
});

router.get("/jobs", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  req.log.info("Listing jobs");
  const query = ListJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [eq(jobsTable.userId, userId)];
  if (query.data.status != null) {
    conditions.push(eq(jobsTable.status, query.data.status));
  }
  if (query.data.roleProfileId != null) {
    conditions.push(eq(jobsTable.roleProfileId, query.data.roleProfileId));
  }

  const rows = await db
    .select()
    .from(jobsTable)
    .where(and(...conditions))
    .orderBy(jobsTable.createdAt);
  res.json(ListJobsResponse.parse(rows));
});

router.post("/jobs", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid create job body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.roleProfileId != null) {
    const [profile] = await db
      .select({ id: roleProfilesTable.id })
      .from(roleProfilesTable)
      .where(and(eq(roleProfilesTable.id, parsed.data.roleProfileId), eq(roleProfilesTable.userId, userId)));
    if (!profile) {
      res.status(400).json({ error: `Role profile ${parsed.data.roleProfileId} not found. Refresh the page and try again.` });
      return;
    }
  }
  const [row] = await db.insert(jobsTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(GetJobResponse.parse(row));
});

router.get("/jobs/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.userId, userId)));
  if (!row) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(GetJobResponse.parse(row));
});

router.patch("/jobs/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = UpdateJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateJobBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid update job body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.roleProfileId != null) {
    const [exists] = await db
      .select({ id: roleProfilesTable.id })
      .from(roleProfilesTable)
      .where(and(eq(roleProfilesTable.id, parsed.data.roleProfileId), eq(roleProfilesTable.userId, userId)));
    if (!exists) {
      req.log.warn(
        { jobId: params.data.id, roleProfileId: parsed.data.roleProfileId },
        "PATCH job rejected: roleProfileId does not exist",
      );
      res.status(400).json({
        error: `Role profile ${parsed.data.roleProfileId} not found. Refresh the page and try again.`,
      });
      return;
    }
  }
  const [row] = await db
    .update(jobsTable)
    .set(parsed.data)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(UpdateJobResponse.parse(row));
});

router.delete("/jobs/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const resumeRows = await db
    .select({ id: resumeVersionsTable.id })
    .from(resumeVersionsTable)
    .where(and(eq(resumeVersionsTable.jobId, params.data.id), eq(resumeVersionsTable.userId, userId)));
  const coverRows = await db
    .select({ id: coverLetterVersionsTable.id })
    .from(coverLetterVersionsTable)
    .where(and(eq(coverLetterVersionsTable.jobId, params.data.id), eq(coverLetterVersionsTable.userId, userId)));

  const [row] = await db.delete(jobsTable).where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.userId, userId))).returning();
  if (!row) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  await scrubWizardStateReferences({
    userId,
    jobIds: [params.data.id],
    resumeVersionIds: resumeRows.map((item) => item.id),
    coverLetterVersionIds: coverRows.map((item) => item.id),
  });

  res.sendStatus(204);
});

router.post("/jobs/:id/nuke-attempts", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db
    .select({ id: jobsTable.id })
    .from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const result = await nukeJobAttemptData(params.data.id, userId);
  req.log.info({ jobId: params.data.id, result }, "Job-scoped nuke cleanup completed");

  res.json({
    jobId: params.data.id,
    ...result,
  });
});

router.get("/jobs/:id/score", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = ScoreJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const queryParams = ScoreJobQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (queryParams.data.useResume) {
    const [latestResume] = await db
      .select()
      .from(baseResumeVersionsTable)
      .where(and(eq(baseResumeVersionsTable.userId, userId), eq(baseResumeVersionsTable.isCurrent, true)))
      .orderBy(desc(baseResumeVersionsTable.createdAt))
      .limit(1);

    if (!latestResume) {
      res.status(400).json({ error: "No current resume found. Please upload a base resume first." });
      return;
    }

    const result = await scoreResumeAgainstJob(latestResume.contentText, job, userId);
    req.log.info(
      { jobId: job.id, overallScore: result.overallScore },
      "Job scored using resume semantic scoring",
    );
    res.json(result);
    return;
  }

  const roleProfileId = queryParams.data.roleProfileId ?? job.roleProfileId;
  if (roleProfileId == null) {
    res.status(400).json({ error: "roleProfileId is required (either via query param or job.roleProfileId)" });
    return;
  }

  const [roleProfile] = await db
    .select()
    .from(roleProfilesTable)
    .where(and(eq(roleProfilesTable.id, roleProfileId), eq(roleProfilesTable.userId, userId)));
  if (!roleProfile) {
    res.status(404).json({ error: "Role profile not found" });
    return;
  }

  const result = scoreJobAgainstProfile(job, roleProfile);
  req.log.info(
    { jobId: job.id, roleProfileId, score: result.score, passesHardFilters: result.passesHardFilters },
    "Job scored",
  );
  res.json(ScoreJobResponse.parse(result));
});

router.post("/jobs/:id/parse", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = ParseJobDescriptionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = ParseJobDescriptionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const rawJdText = body.data.rawJdText ?? job.rawJdText;
  if (!rawJdText) {
    res.status(400).json({ error: "rawJdText is required — provide it in the request body or store it on the job first" });
    return;
  }

  req.log.info({ jobId: job.id }, "Starting JD parse pipeline");

  const updated = await runJdParsePipeline(job, rawJdText);

  res.json(ParseJobDescriptionResponse.parse(updated));
});

router.post("/jobs/:id/research", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (!job.rawJdText) {
    res.status(400).json({ error: "rawJdText is required — please parse or store JD first" });
    return;
  }

  req.log.info({ jobId: job.id }, "Starting job research pipeline");

  try {
    const researchResult = await runJobResearchPipeline(job.title, job.company, job.rawJdText, job.id, userId);
    
    const [updated] = await db
      .update(jobsTable)
      .set({ researchData: researchResult })
      .where(and(eq(jobsTable.id, job.id), eq(jobsTable.userId, userId)))
      .returning();

    res.json(GetJobResponse.parse(updated));
  } catch (error) {
    req.log.error({ error }, "Job research pipeline failed");
    res.status(500).json({ error: error instanceof Error ? error.message : "Job research failed" });
  }
});

router.post("/jobs/:id/gap-analysis", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const allClaims = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.userId, userId), eq(claimsTable.isActive, true)));

  try {
    const result = await runGapAnalysisPipeline(job, allClaims, userId);
    res.json(result);
  } catch (error) {
    req.log.error({ error }, "Gap analysis failed");
    res.status(500).json({ error: error instanceof Error ? error.message : "Gap analysis failed" });
  }
});

router.get("/jobs/:id/claim-matches", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = GetJobClaimMatchesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const claims = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.userId, userId), eq(claimsTable.isActive, true)));

  const matches = matchClaimsToJob(job, claims);

  const MIN_MATCHES = 3;
  let responseMatches = matches;

  if (matches.length < MIN_MATCHES) {
    const matchedIds = new Set(matches.map((m) => m.claim.id));
    const unmatched = claims
      .filter((c) => !matchedIds.has(c.id))
      .map((c) => ({
        claim: c,
        score: 0,
        matchType: "available" as const,
        matchedKeywords: [] as string[],
      }));
    responseMatches = [...matches, ...unmatched];
    req.log.info(
      { jobId: job.id, scored: matches.length, total: responseMatches.length },
      "Claim matches below threshold — returning all active claims for manual selection",
    );
  } else {
    req.log.info({ jobId: job.id, totalClaims: claims.length, matched: matches.length }, "Claim matches computed");
  }

  res.json(GetJobClaimMatchesResponse.parse(responseMatches));
});

router.post("/jobs/:id/tailor", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = TailorJobResumeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = TailorJobResumeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const requestedModelOverride = modelOverrideSchema.optional().safeParse(
    (req.body as { modelOverride?: unknown }).modelOverride,
  );

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const allClaims = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.userId, userId), eq(claimsTable.isActive, true)));

  req.log.info({ jobId: job.id }, "Received resume tailor request");

  try {
    const resumeVersion = await runResumeTailorPipeline(
      job,
      allClaims,
      body.data.claimIds,
      {
        userId,
        modelOverride: requestedModelOverride.success ? requestedModelOverride.data : undefined,
        templateId: body.data.templateId,
      },
    );

    awardXp(req.session.adminId!, "job_apply", { jobId: job.id }).catch(() => {});

    res.status(201).json(GetResumeVersionResponse.parse(resumeVersion));
  } catch (error) {
    if (error instanceof MissingBaseResumeError) {
      req.log.warn({ jobId: job.id }, "Resume tailoring blocked: missing current base resume");
      res.status(400).json({ error: error.message });
      return;
    }
    throw error;
  }
});

router.post("/jobs/:id/cover-letter", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = DraftCoverLetterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = DraftCoverLetterBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const requestedModelOverride = modelOverrideSchema.optional().safeParse(
    (req.body as { modelOverride?: unknown }).modelOverride,
  );

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const allClaims = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.userId, userId), eq(claimsTable.isActive, true)));

  let roleProfile = null;
  if (job.roleProfileId) {
    const [rp] = await db
      .select()
      .from(roleProfilesTable)
      .where(and(eq(roleProfilesTable.id, job.roleProfileId), eq(roleProfilesTable.userId, userId)));
    roleProfile = rp ?? null;
  }

  req.log.info({ jobId: job.id }, "Starting cover letter draft pipeline");

  const coverLetterVersion = await runCoverLetterPipeline(
    job,
    roleProfile,
    allClaims,
    body.data.claimIds,
    { userId, modelOverride: requestedModelOverride.success ? requestedModelOverride.data : undefined },
  );

  res.status(201).json(GetCoverLetterVersionResponse.parse(coverLetterVersion));
});

router.post("/jobs/:id/compare/resume", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = TailorJobResumeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = compareBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const allClaims = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.userId, userId), eq(claimsTable.isActive, true)));

  const comparisonRunId = mintRunId();
  const candidates: Array<Record<string, unknown>> = [];

  for (const model of body.data.models) {
    try {
      const version = await runResumeTailorPipeline(
        job,
        allClaims,
        body.data.claimIds,
        { userId, modelOverride: model, templateId: body.data.templateId },
      );
      await db
        .update(resumeVersionsTable)
        .set({ status: "comparison_candidate" })
        .where(and(eq(resumeVersionsTable.id, version.id), eq(resumeVersionsTable.userId, userId)));

      candidates.push({
        versionId: version.id,
        modelName: model.modelName,
        provider: model.provider ?? "openrouter",
        status: "succeeded",
        preview: version.tailoredDocumentText ?? version.rawContent ?? "",
        notes: version.notes ?? "",
        templateId: version.templateId ?? body.data.templateId ?? null,
        runId: version.runId ?? null,
        eventLogId: version.eventLogId ?? null,
      });
    } catch (error) {
      candidates.push({
        modelName: model.modelName,
        provider: model.provider ?? "openrouter",
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await db.insert(eventLogsTable).values({
    userId,
    entityType: "job",
    entityId: job.id,
    jobId: job.id,
    runId: comparisonRunId,
    eventType: "wizard_compare_resume",
    previousState: null,
    nextState: "resume_compared",
    actorType: "user",
    metadata: {
      claimIds: body.data.claimIds ?? [],
      models: body.data.models,
      candidates,
    },
  });

  awardXp(req.session.adminId!, "compare", { jobId: job.id }).catch(() => {});

  res.json({ comparisonRunId, candidates });
});

router.post("/jobs/:id/compare/cover-letter", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = DraftCoverLetterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = compareBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const allClaims = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.userId, userId), eq(claimsTable.isActive, true)));

  let roleProfile = null;
  if (job.roleProfileId) {
    const [rp] = await db
      .select()
      .from(roleProfilesTable)
      .where(and(eq(roleProfilesTable.id, job.roleProfileId), eq(roleProfilesTable.userId, userId)));
    roleProfile = rp ?? null;
  }

  const comparisonRunId = mintRunId();
  const candidates: Array<Record<string, unknown>> = [];

  for (const model of body.data.models) {
    try {
      const version = await runCoverLetterPipeline(
        job,
        roleProfile,
        allClaims,
        body.data.claimIds,
        { userId, modelOverride: model },
      );
      await db
        .update(coverLetterVersionsTable)
        .set({ status: "comparison_candidate" })
        .where(and(eq(coverLetterVersionsTable.id, version.id), eq(coverLetterVersionsTable.userId, userId)));

      candidates.push({
        versionId: version.id,
        modelName: model.modelName,
        provider: model.provider ?? "openrouter",
        status: "succeeded",
        preview: version.draftContent ?? "",
        notes: version.notes ?? "",
        runId: version.runId ?? null,
        eventLogId: version.eventLogId ?? null,
      });
    } catch (error) {
      candidates.push({
        modelName: model.modelName,
        provider: model.provider ?? "openrouter",
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await db.insert(eventLogsTable).values({
    userId,
    entityType: "job",
    entityId: job.id,
    jobId: job.id,
    runId: comparisonRunId,
    eventType: "wizard_compare_cover_letter",
    previousState: null,
    nextState: "cover_letter_compared",
    actorType: "user",
    metadata: {
      claimIds: body.data.claimIds ?? [],
      models: body.data.models,
      candidates,
    },
  });

  awardXp(req.session.adminId!, "compare", { jobId: job.id }).catch(() => {});

  res.json({ comparisonRunId, candidates });
});

router.post("/jobs/:id/compare/promote-resume", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = TailorJobResumeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = promoteBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const allClaims = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.userId, userId), eq(claimsTable.isActive, true)));

  if (body.data.candidateVersionId != null) {
    const [candidate] = await db
      .select()
      .from(resumeVersionsTable)
      .where(and(eq(resumeVersionsTable.id, body.data.candidateVersionId), eq(resumeVersionsTable.userId, userId)));
    if (!candidate || candidate.jobId !== job.id) {
      res.status(404).json({ error: "Resume comparison candidate not found for this job" });
      return;
    }
    if (candidate.status !== "comparison_candidate") {
      res.status(409).json({ error: "Only comparison candidates can be promoted" });
      return;
    }

    const [promoted] = await db
      .update(resumeVersionsTable)
      .set({ status: "pending_approval" })
      .where(and(eq(resumeVersionsTable.id, candidate.id), eq(resumeVersionsTable.userId, userId)))
      .returning();

    await db.insert(eventLogsTable).values({
      userId,
      entityType: "resume_version",
      entityId: promoted!.id,
      jobId: job.id,
      runId: promoted!.runId ?? null,
      eventType: "wizard_compare_promote_resume",
      previousState: "comparison_candidate",
      nextState: "pending_approval",
      actorType: "user",
      metadata: {
        candidateVersionId: promoted!.id,
        model: body.data.model ?? null,
        claimIds: body.data.claimIds ?? [],
        templateId: promoted!.templateId ?? body.data.templateId ?? null,
        resumeVersionId: promoted!.id,
        eventLogId: promoted!.eventLogId ?? null,
      },
    });

    res.status(201).json(GetResumeVersionResponse.parse(promoted));
    return;
  }

  if (!body.data.model) {
    res.status(400).json({ error: "Either model or candidateVersionId is required" });
    return;
  }

  try {
    const version = await runResumeTailorPipeline(
      job,
      allClaims,
      body.data.claimIds,
      { userId, modelOverride: body.data.model, templateId: body.data.templateId },
    );

    await db.insert(eventLogsTable).values({
      userId,
      entityType: "resume_version",
      entityId: version.id,
      jobId: job.id,
      runId: version.runId ?? null,
      eventType: "wizard_compare_promote_resume",
      previousState: null,
      nextState: "pending_approval",
      actorType: "user",
      metadata: {
        model: body.data.model,
        claimIds: body.data.claimIds ?? [],
        templateId: version.templateId ?? body.data.templateId ?? null,
        resumeVersionId: version.id,
        eventLogId: version.eventLogId ?? null,
      },
    });

    res.status(201).json(GetResumeVersionResponse.parse(version));
  } catch (error) {
    if (error instanceof MissingBaseResumeError) {
      res.status(400).json({ error: error.message });
      return;
    }
    throw error;
  }
});

router.post("/jobs/:id/compare/promote-cover-letter", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = DraftCoverLetterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = promoteBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, params.data.id), eq(jobsTable.userId, userId)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const allClaims = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.userId, userId), eq(claimsTable.isActive, true)));

  if (body.data.candidateVersionId != null) {
    const [candidate] = await db
      .select()
      .from(coverLetterVersionsTable)
      .where(and(eq(coverLetterVersionsTable.id, body.data.candidateVersionId), eq(coverLetterVersionsTable.userId, userId)));
    if (!candidate || candidate.jobId !== job.id) {
      res.status(404).json({ error: "Cover letter comparison candidate not found for this job" });
      return;
    }
    if (candidate.status !== "comparison_candidate") {
      res.status(409).json({ error: "Only comparison candidates can be promoted" });
      return;
    }

    const [promoted] = await db
      .update(coverLetterVersionsTable)
      .set({ status: "pending_approval" })
      .where(and(eq(coverLetterVersionsTable.id, candidate.id), eq(coverLetterVersionsTable.userId, userId)))
      .returning();

    await db.insert(eventLogsTable).values({
      userId,
      entityType: "cover_letter_version",
      entityId: promoted!.id,
      jobId: job.id,
      runId: promoted!.runId ?? null,
      eventType: "wizard_compare_promote_cover_letter",
      previousState: "comparison_candidate",
      nextState: "pending_approval",
      actorType: "user",
      metadata: {
        candidateVersionId: promoted!.id,
        model: body.data.model ?? null,
        claimIds: body.data.claimIds ?? [],
        coverLetterVersionId: promoted!.id,
        eventLogId: promoted!.eventLogId ?? null,
      },
    });

    res.status(201).json(GetCoverLetterVersionResponse.parse(promoted));
    return;
  }

  if (!body.data.model) {
    res.status(400).json({ error: "Either model or candidateVersionId is required" });
    return;
  }

  let roleProfile = null;
  if (job.roleProfileId) {
    const [rp] = await db
      .select()
      .from(roleProfilesTable)
      .where(and(eq(roleProfilesTable.id, job.roleProfileId), eq(roleProfilesTable.userId, userId)));
    roleProfile = rp ?? null;
  }

  const version = await runCoverLetterPipeline(
    job,
    roleProfile,
      allClaims,
      body.data.claimIds,
    { userId, modelOverride: body.data.model },
    );

  await db.insert(eventLogsTable).values({
    userId,
    entityType: "cover_letter_version",
    entityId: version.id,
    jobId: job.id,
    runId: version.runId ?? null,
    eventType: "wizard_compare_promote_cover_letter",
    previousState: null,
    nextState: "pending_approval",
    actorType: "user",
    metadata: {
      model: body.data.model,
      claimIds: body.data.claimIds ?? [],
      coverLetterVersionId: version.id,
      eventLogId: version.eventLogId ?? null,
    },
  });

  res.status(201).json(GetCoverLetterVersionResponse.parse(version));
});

export default router;
