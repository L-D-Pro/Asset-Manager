import { Router, type IRouter } from "express";
import { z } from "zod";
import type { JobOpsRequest } from "../lib/http-types";
import {
  loadOrCreateBestPractices,
  updateBestPractices,
  refreshBestPracticesFromAI,
} from "../lib/best-practices";

const router: IRouter = Router();

const UpdateBody = z.object({
  domain: z.string().min(1),
  items: z.array(
    z.object({
      description: z.string().min(1),
      source: z.enum(["ai", "hardcoded", "hybrid"]),
      rationale: z.string().optional(),
      frequency: z.number().int().min(0).optional(),
    }),
  ),
});

router.get("/best-practices", async (req: JobOpsRequest, res): Promise<void> => {
  const config = await loadOrCreateBestPractices("general");
  res.json(config);
});

router.put("/best-practices", async (req: JobOpsRequest, res): Promise<void> => {
  const parsed = UpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const config = await updateBestPractices(parsed.data.domain, parsed.data.items);
  res.json(config);
});

router.post("/best-practices/refresh", async (req: JobOpsRequest, res): Promise<void> => {
  const config = await refreshBestPracticesFromAI("general");
  res.json(config);
});

export default router;
