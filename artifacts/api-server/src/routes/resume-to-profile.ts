import { Router, type IRouter } from "express";
import { runResumeToProfilePipeline, MissingBaseResumeError } from "../lib/pipelines/resume-to-profile";

const router: IRouter = Router();

router.post("/resume-to-profile", async (_req, res): Promise<void> => {
  try {
    const profile = await runResumeToProfilePipeline();
    res.status(201).json(profile);
  } catch (err) {
    if (err instanceof MissingBaseResumeError) {
      res.status(404).json({ error: err.message });
      return;
    }
    console.error("Resume-to-profile pipeline failed:", err);
    res.status(500).json({ error: "Failed to extract profile from resume" });
  }
});

export default router;
