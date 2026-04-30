import { Router, type IRouter } from "express";
import { eq, desc, sql, gte, and } from "drizzle-orm";
import { db, waitlistTable, adminUsersTable, jobsTable, applicationsTable, resumeVersionsTable } from "@workspace/db";
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

// Activity feed — public, no auth
router.get("/activity-feed", async (_req: JobOpsRequest, res): Promise<void> => {
  try {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [appliedLastHour] = await db
      .select({ count: sql<number>`count(*)` })
      .from(applicationsTable)
      .where(gte(applicationsTable.createdAt, lastHour));

    const [parsedToday] = await db
      .select({ count: sql<number>`count(*)` })
      .from(jobsTable)
      .where(gte(jobsTable.updatedAt, today));

    const [resumesThisWeek] = await db
      .select({ count: sql<number>`count(*)` })
      .from(resumeVersionsTable)
      .where(gte(resumeVersionsTable.createdAt, weekAgo));

    const [pilotUsers] = await db
      .select({ count: sql<number>`count(*)` })
      .from(adminUsersTable)
      .where(and(
        eq(adminUsersTable.isPilotParticipant, true),
        gte(adminUsersTable.createdAt, today),
      ));

    res.json({
      jobsAppliedLastHour: appliedLastHour?.count ?? 0,
      jobsParsedToday: parsedToday?.count ?? 0,
      resumesGeneratedThisWeek: resumesThisWeek?.count ?? 0,
      pilotUsersJoinedToday: pilotUsers?.count ?? 0,
    });
  } catch {
    res.json({
      jobsAppliedLastHour: 0,
      jobsParsedToday: 0,
      resumesGeneratedThisWeek: 0,
      pilotUsersJoinedToday: 0,
    });
  }
});

export default router;
