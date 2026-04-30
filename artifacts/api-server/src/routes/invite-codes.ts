import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, inviteCodesTable, adminUsersTable } from "@workspace/db";
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

router.get("/invite-codes", requireAdmin, async (req: JobOpsRequest, res): Promise<void> => {
  const codes = await db
    .select()
    .from(inviteCodesTable)
    .orderBy(inviteCodesTable.createdAt);
  res.json(codes);
});

router.post("/invite-codes", requireAdmin, async (req: JobOpsRequest, res): Promise<void> => {
  const { maxUses, expiresInDays } = req.body ?? {};
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "JOBOPS-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const uses = typeof maxUses === "number" && maxUses > 0 ? maxUses : 50;
  const days = typeof expiresInDays === "number" && expiresInDays > 0 ? expiresInDays : 30;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const [row] = await db
    .insert(inviteCodesTable)
    .values({
      code,
      maxUses: uses,
      expiresAt,
      createdByAdminId: req.session.adminId!,
    })
    .returning();

  req.log.info({ code, maxUses: uses }, "Invite code generated");
  res.status(201).json(row);
});

router.delete("/invite-codes/:id", requireAdmin, async (req: JobOpsRequest, res): Promise<void> => {
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idParam!, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db
    .update(inviteCodesTable)
    .set({ isActive: false })
    .where(eq(inviteCodesTable.id, id));
  res.status(204).end();
});

router.post("/invite-codes/validate", async (req: JobOpsRequest, res): Promise<void> => {
  const { code } = req.body ?? {};
  if (!code || typeof code !== "string") {
    res.json({ valid: false, message: "Invite code is required" });
    return;
  }

  const [invite] = await db
    .select()
    .from(inviteCodesTable)
    .where(eq(inviteCodesTable.code, code.trim().toUpperCase()));

  if (!invite) {
    res.json({ valid: false, message: "Invalid invite code" });
    return;
  }
  if (!invite.isActive) {
    res.json({ valid: false, message: "This invite code has been revoked" });
    return;
  }
  if (new Date() > invite.expiresAt) {
    res.json({ valid: false, message: "This invite code has expired" });
    return;
  }
  if (invite.usedCount >= invite.maxUses) {
    res.json({ valid: false, message: "This invite code has reached its limit" });
    return;
  }

  res.json({ valid: true });
});

export default router;
