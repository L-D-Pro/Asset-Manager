import { Router, type NextFunction, type Response } from "express";
import { eq } from "drizzle-orm";
import { adminUsersTable, db } from "@workspace/db";
import type { JobOpsRequest } from "../lib/http-types";
import { logger } from "../lib/logger";
import {
  getAppTestResetSummary,
  resetAppTestData,
} from "../lib/app-test-reset";
import { ensureModelConfigConstraints, seedModelConfigs } from "../lib/seed-model-configs";
import { checkModelConfigHealth } from "../lib/model-config-health";

const adminResetRouter = Router();

function normalizeConfirmation(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toUpperCase() : "";
}

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

adminResetRouter.get(
  "/admin/test-reset/summary",
  requireAdmin,
  async (_req: JobOpsRequest, res): Promise<void> => {
    const [summary, modelConfigHealth] = await Promise.all([
      getAppTestResetSummary(),
      checkModelConfigHealth(),
    ]);
    res.json({ ...summary, modelConfigHealth });
  },
);

adminResetRouter.post(
  "/admin/test-reset",
  requireAdmin,
  async (req: JobOpsRequest, res): Promise<void> => {
    const confirmation = normalizeConfirmation((req.body as { confirmation?: unknown } | undefined)?.confirmation);
    if (confirmation !== "RESET" && confirmation !== "RESET APP") {
      logger.warn(
        {
          adminId: req.session.adminId,
          confirmationReceived: typeof req.body?.confirmation,
          confirmationLength:
            typeof req.body?.confirmation === "string" ? req.body.confirmation.length : null,
        },
        "Admin reset rejected due to confirmation mismatch",
      );
      res.status(400).json({ error: "Type RESET to confirm this admin reset." });
      return;
    }

    const adminId = req.session.adminId;
    if (!adminId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await resetAppTestData(adminId);
    logger.warn(
      {
        adminId,
        totalRowsBefore: result.totalRowsBefore,
        resetTables: result.resetTables.map((row) => row.table),
        missingTables: result.missingTables,
      },
      "Admin reset app test data",
    );

    await ensureModelConfigConstraints();
    await seedModelConfigs();
    logger.info({ adminId }, "Re-seeded model configs after data reset");

    const modelConfigHealth = await checkModelConfigHealth();
    res.json({ ...result, modelConfigHealth });
  },
);

export default adminResetRouter;
