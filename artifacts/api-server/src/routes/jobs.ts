import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, jobsTable, roleProfilesTable, claimsTable } from "@workspace/db";
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
  DraftCoverLetterParams,
  DraftCoverLetterBody,
} from "@workspace/api-zod";
import { scoreJobAgainstProfile, matchClaimsToJob } from "../lib/scoring";

const router: IRouter = Router();

router.get("/jobs", async (req, res): Promise<void> => {
  req.log.info("Listing jobs");
  const query = ListJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.status != null) {
    conditions.push(eq(jobsTable.status, query.data.status));
  }
  if (query.data.roleProfileId != null) {
    conditions.push(eq(jobsTable.roleProfileId, query.data.roleProfileId));
  }

  const rows = await db
    .select()
    .from(jobsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(jobsTable.createdAt);
  res.json(ListJobsResponse.parse(rows));
});

router.post("/jobs", async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid create job body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(jobsTable).values(parsed.data).returning();
  res.status(201).json(GetJobResponse.parse(row));
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(GetJobResponse.parse(row));
});

router.patch("/jobs/:id", async (req, res): Promise<void> => {
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
  const [row] = await db
    .update(jobsTable)
    .set(parsed.data)
    .where(eq(jobsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(UpdateJobResponse.parse(row));
});

router.delete("/jobs/:id", async (req, res): Promise<void> => {
  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(jobsTable)
    .where(eq(jobsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/jobs/:id/score", async (req, res): Promise<void> => {
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
    .where(eq(jobsTable.id, params.data.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
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
    .where(eq(roleProfilesTable.id, roleProfileId));
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

router.post("/jobs/:id/parse", async (req, res): Promise<void> => {
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
    .where(eq(jobsTable.id, params.data.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const rawJdText = body.data.rawJdText ?? job.rawJdText;

  req.log.info({ jobId: job.id }, "JD parse stub called (AI implementation in Task 3)");

  const [updated] = await db
    .update(jobsTable)
    .set({ rawJdText: rawJdText ?? job.rawJdText, status: "parsing" })
    .where(eq(jobsTable.id, params.data.id))
    .returning();

  res.json(ParseJobDescriptionResponse.parse(updated));
});

router.get("/jobs/:id/claim-matches", async (req, res): Promise<void> => {
  const params = GetJobClaimMatchesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, params.data.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const claims = await db
    .select()
    .from(claimsTable)
    .where(eq(claimsTable.isActive, true));

  const matches = matchClaimsToJob(job, claims);

  req.log.info({ jobId: job.id, totalClaims: claims.length, matched: matches.length }, "Claim matches computed");

  res.json(GetJobClaimMatchesResponse.parse(matches));
});

router.post("/jobs/:id/tailor", async (req, res): Promise<void> => {
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

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, params.data.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  req.log.info({ jobId: job.id }, "Resume tailor stub called (AI implementation in Task 3)");
  res.status(202).json({ message: "Resume tailoring queued. AI implementation in Task 3.", jobId: job.id });
});

router.post("/jobs/:id/cover-letter", async (req, res): Promise<void> => {
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

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, params.data.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  req.log.info({ jobId: job.id }, "Cover letter draft stub called (AI implementation in Task 3)");
  res.status(202).json({ message: "Cover letter drafting queued. AI implementation in Task 3.", jobId: job.id });
});

export default router;
