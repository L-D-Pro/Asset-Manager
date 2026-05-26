import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, roleProfilesTable } from "@workspace/db";
import {
  CreateRoleProfileBody,
  GetRoleProfileParams,
  GetRoleProfileResponse,
  UpdateRoleProfileParams,
  UpdateRoleProfileBody,
  UpdateRoleProfileResponse,
  DeleteRoleProfileParams,
  ListRoleProfilesResponse,
} from "@workspace/api-zod";
import type { JobOpsRequest } from "../lib/http-types";
import { currentUserId } from "../lib/ownership";

const router: IRouter = Router();

router.get("/role-profiles", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  req.log.info("Listing role profiles");
  const rows = await db
    .select()
    .from(roleProfilesTable)
    .where(eq(roleProfilesTable.userId, userId))
    .orderBy(roleProfilesTable.createdAt);
  res.json(ListRoleProfilesResponse.parse(rows));
});

router.post("/role-profiles", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const parsed = CreateRoleProfileBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid create role profile body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(roleProfilesTable)
    .values({ ...parsed.data, userId })
    .returning();
  res.status(201).json(GetRoleProfileResponse.parse(row));
});

router.get("/role-profiles/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = GetRoleProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(roleProfilesTable)
    .where(and(eq(roleProfilesTable.id, params.data.id), eq(roleProfilesTable.userId, userId)));
  if (!row) {
    res.status(404).json({ error: "Role profile not found" });
    return;
  }
  res.json(GetRoleProfileResponse.parse(row));
});

router.patch("/role-profiles/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = UpdateRoleProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateRoleProfileBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid update role profile body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(roleProfilesTable)
    .set(parsed.data)
    .where(and(eq(roleProfilesTable.id, params.data.id), eq(roleProfilesTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Role profile not found" });
    return;
  }
  res.json(UpdateRoleProfileResponse.parse(row));
});

router.delete("/role-profiles/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = DeleteRoleProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(roleProfilesTable)
    .where(and(eq(roleProfilesTable.id, params.data.id), eq(roleProfilesTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Role profile not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
