import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import {
  db,
  jobsTable,
  baseResumeVersionsTable,
} from "@workspace/db";
import {
  ResumeScoreParams,
  ResumeScoreResponse,
} from "@workspace/api-zod";
import { scoreResumeAgainstJob } from "../lib/semantic-scoring";
import type { JobOpsRequest } from "../lib/http-types";
import { currentUserId } from "../lib/ownership";

const router: IRouter = Router();

/**
 * POST /jobs/:id/resume-score
 *
 * Scores the user's current base resume semantically against a job.
 * Uses the latest `isCurrent = true` base resume version.
 */
router.post("/jobs/:id/resume-score", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = ResumeScoreParams.safeParse(req.params);
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
    "Resume scored semantically against job",
  );

  res.json(ResumeScoreResponse.parse(result));
});

export default router;
