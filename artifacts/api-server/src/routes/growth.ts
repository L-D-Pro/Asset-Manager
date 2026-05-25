import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, waitlistTable } from "@workspace/db";
import type { JobOpsRequest } from "../lib/http-types";
import { resendService } from "../lib/resend-service";

const router: IRouter = Router();

router.post("/waitlist", async (req: JobOpsRequest, res): Promise<void> => {
  const { email, fullName, linkedinUrl, utmSource, utmMedium, utmCampaign } = req.body ?? {};
  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  try {
    await db.insert(waitlistTable).values({
      email: email.trim().toLowerCase(),
      fullName: fullName ?? null,
      linkedinUrl: linkedinUrl ?? null,
      utmSource: utmSource ?? null,
      utmMedium: utmMedium ?? null,
      utmCampaign: utmCampaign ?? null,
    });
  } catch {
    // Duplicate email — silently accept
  }

  resendService.sendWaitlistConfirmation(email);
  req.log.info({ email }, "Waitlist signup");
  res.status(201).json({ ok: true });
});

router.get("/waitlist", async (req: JobOpsRequest, res): Promise<void> => {
  const entries = await db
    .select()
    .from(waitlistTable)
    .orderBy(desc(waitlistTable.createdAt));
  res.json(entries);
});

export default router;
