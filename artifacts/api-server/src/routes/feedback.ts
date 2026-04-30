import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, feedbackTable, adminUsersTable } from "@workspace/db";
import type { JobOpsRequest } from "../lib/http-types";

const router: IRouter = Router();

router.post("/feedback", async (req: JobOpsRequest, res): Promise<void> => {
  const { type, message, pageUrl, metadata } = req.body ?? {};
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  await db.insert(feedbackTable).values({
    userId: req.session.adminId ?? null,
    type: (type && ["bug", "feature", "general"].includes(type) ? type : "general"),
    message: message.trim(),
    pageUrl: pageUrl ?? null,
    metadata: metadata ?? {},
  });

  req.log.info({ type, userId: req.session.adminId }, "Feedback submitted");
  res.status(201).json({ ok: true });
});

export default router;
