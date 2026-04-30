import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, wizardSessionsTable } from "@workspace/db";
import {
  ListWizardSessionsResponse,
  CreateWizardSessionBody,
  GetWizardSessionParams,
  GetWizardSessionResponse,
  DeleteWizardSessionParams,
} from "@workspace/api-zod";
import type { JobOpsRequest } from "../lib/http-types";

const router: IRouter = Router();

router.get("/wizard-sessions", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = req.session.adminId!;

  const sessions = await db
    .select()
    .from(wizardSessionsTable)
    .where(eq(wizardSessionsTable.userId, userId))
    .orderBy(desc(wizardSessionsTable.updatedAt));

  res.json(ListWizardSessionsResponse.parse(sessions));
});

router.post("/wizard-sessions", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = req.session.adminId!;
  const parsed = CreateWizardSessionBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid create wizard session body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select({ id: wizardSessionsTable.id })
    .from(wizardSessionsTable)
    .where(eq(wizardSessionsTable.userId, userId))
    .orderBy(desc(wizardSessionsTable.updatedAt));

  if (existing.length >= 3) {
    const toDelete = existing.slice(2);
    for (const row of toDelete) {
      await db.delete(wizardSessionsTable).where(eq(wizardSessionsTable.id, row.id));
    }
  }

  const [row] = await db
    .insert(wizardSessionsTable)
    .values({
      userId,
      jobId: parsed.data.jobId ?? null,
      currentStep: parsed.data.currentStep,
      state: (parsed.data.state as Record<string, unknown>) ?? {},
    })
    .returning();

  req.log.info({ sessionId: row!.id, userId }, "Wizard session saved");
  res.status(201).json(GetWizardSessionResponse.parse(row!));
});

router.get("/wizard-sessions/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = req.session.adminId!;
  const params = GetWizardSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .select()
    .from(wizardSessionsTable)
    .where(eq(wizardSessionsTable.id, params.data.id));

  if (!session || session.userId !== userId) {
    res.status(404).json({ error: "Wizard session not found" });
    return;
  }

  res.json(GetWizardSessionResponse.parse(session));
});

router.delete("/wizard-sessions/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = req.session.adminId!;
  const params = DeleteWizardSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [session] = await db
    .select({ id: wizardSessionsTable.id, userId: wizardSessionsTable.userId })
    .from(wizardSessionsTable)
    .where(eq(wizardSessionsTable.id, params.data.id));

  if (!session || session.userId !== userId) {
    res.status(404).json({ error: "Wizard session not found" });
    return;
  }

  await db.delete(wizardSessionsTable).where(eq(wizardSessionsTable.id, params.data.id));

  req.log.info({ sessionId: params.data.id, userId }, "Wizard session deleted");
  res.status(204).end();
});

export default router;
