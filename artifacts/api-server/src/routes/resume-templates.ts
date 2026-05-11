import { Router } from "express";
import { listResumeTemplates } from "../lib/resume-templates";

const router = Router();

router.get("/resume-templates", (_req, res): void => {
  res.json({ templates: listResumeTemplates() });
});

export default router;
