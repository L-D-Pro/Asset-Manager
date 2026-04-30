import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userUsageLimitsTable, adminUsersTable } from "@workspace/db";
import type { JobOpsRequest } from "../lib/http-types";

const router: IRouter = Router();

function requireAdmin(req: JobOpsRequest, res: import("express").Response, next: import("express").NextFunction): void {
  if (!req.session.adminId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  db.select({ role: adminUsersTable.role })
    .from(adminUsersTable)
    .where(eq(adminUsersTable.id, req.session.adminId))
    .then(([user]) => {
      if (!user || user.role !== "admin") {
        res.status(403).json({ error: "Admin access required" });
        return;
      }
      next();
    })
    .catch(() => res.status(500).json({ error: "Internal error" }));
}

router.get("/usage-limits", requireAdmin, async (req: JobOpsRequest, res): Promise<void> => {
  const limits = await db
    .select({
      limit: userUsageLimitsTable,
      username: adminUsersTable.username,
      email: adminUsersTable.email,
    })
    .from(userUsageLimitsTable)
    .innerJoin(adminUsersTable, eq(userUsageLimitsTable.userId, adminUsersTable.id))
    .orderBy(userUsageLimitsTable.createdAt);
  res.json(limits);
});

router.patch("/usage-limits/:userId", requireAdmin, async (req: JobOpsRequest, res): Promise<void> => {
  const userIdParam = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(userIdParam!, 10);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }
  const { weeklyLimit } = req.body ?? {};
  if (typeof weeklyLimit !== "number" || weeklyLimit < 0) {
    res.status(400).json({ error: "weeklyLimit must be a non-negative number" });
    return;
  }

  const [updated] = await db
    .update(userUsageLimitsTable)
    .set({ weeklyLimit })
    .where(eq(userUsageLimitsTable.userId, userId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Usage limit not found for this user" });
    return;
  }

  req.log.info({ userId, weeklyLimit }, "Usage limit updated");
  res.json(updated);
});

router.get("/usage-limits/me", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = req.session.adminId!;
  const [limit] = await db
    .select()
    .from(userUsageLimitsTable)
    .where(eq(userUsageLimitsTable.userId, userId));
  res.json(limit ?? { weeklyLimit: 5, weeklyUsed: 0, totalUsed: 0 });
});

export default router;
