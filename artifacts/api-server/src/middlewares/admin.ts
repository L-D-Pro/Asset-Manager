import type { NextFunction, Response } from "express";
import { eq } from "drizzle-orm";
import { adminUsersTable, db } from "@workspace/db";
import type { JobOpsRequest } from "../lib/http-types";

export async function requireAdmin(
  req: JobOpsRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
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
