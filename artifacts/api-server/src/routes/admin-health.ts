import { Router, type NextFunction, type Response } from "express";
import { eq } from "drizzle-orm";
import { adminUsersTable, db } from "@workspace/db";
import type { JobOpsRequest } from "../lib/http-types";
import { checkModelConfigHealth } from "../lib/model-config-health";

const adminHealthRouter = Router();

async function requireAdmin(req: JobOpsRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.session.adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await db.query.adminUsersTable.findFirst({
    where: eq(adminUsersTable.id, req.session.adminId),
    columns: { id: true, role: true },
  });

  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}

adminHealthRouter.get(
  "/admin/health/model-configs",
  requireAdmin,
  async (_req: JobOpsRequest, res): Promise<void> => {
    const report = await checkModelConfigHealth();
    const status = report.healthy ? 200 : 207;
    res.status(status).json(report);
  },
);

export default adminHealthRouter;
