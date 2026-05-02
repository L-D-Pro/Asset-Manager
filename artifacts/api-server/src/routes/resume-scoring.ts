import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
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

const router: IRouter = Router();

/**
 * POST /jobs/:id/resume-score
 *
 * Scores the user's current base resume semantically against a job.
 * Uses the latest `isCurrent = true` base resume version.
 */
router.post("/jobs/:id/resume-score", async (req, res): Promise<void> => {
  const params = ResumeScoreParams.safeParse(req.params);
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

  const [latestResume] = await db
    .select()
    .from(baseResumeVersionsTable)
    .where(eq(baseResumeVersionsTable.isCurrent, true))
    .orderBy(desc(baseResumeVersionsTable.createdAt))
    .limit(1);

  if (!latestResume) {
    res.status(400).json({ error: "No current resume found. Please upload a base resume first." });
    return;
  }

  const result = await scoreResumeAgainstJob(latestResume.contentText, job);

  req.log.info(
    { jobId: job.id, overallScore: result.overallScore },
    "Resume scored semantically against job",
  );

  res.json(ResumeScoreResponse.parse(result));
});

export default router;
