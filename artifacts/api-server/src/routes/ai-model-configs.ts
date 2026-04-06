import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, aiModelConfigsTable } from "@workspace/db";
import {
  ListAiModelConfigsQueryParams,
  ListAiModelConfigsResponse,
  CreateAiModelConfigBody,
  GetAiModelConfigParams,
  GetAiModelConfigResponse,
  UpdateAiModelConfigParams,
  UpdateAiModelConfigBody,
  UpdateAiModelConfigResponse,
  DeleteAiModelConfigParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/ai-model-configs", async (req, res): Promise<void> => {
  req.log.info("Listing AI model configs");
  const query = ListAiModelConfigsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.taskScope != null) {
    conditions.push(eq(aiModelConfigsTable.taskScope, query.data.taskScope));
  }
  if (query.data.isActive != null) {
    conditions.push(eq(aiModelConfigsTable.isActive, query.data.isActive));
  }

  const rows = await db
    .select()
    .from(aiModelConfigsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(aiModelConfigsTable.priority);
  res.json(ListAiModelConfigsResponse.parse(rows));
});

router.post("/ai-model-configs", async (req, res): Promise<void> => {
  const parsed = CreateAiModelConfigBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid create AI model config body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(aiModelConfigsTable)
    .values(parsed.data)
    .returning();
  res.status(201).json(GetAiModelConfigResponse.parse(row));
});

router.get("/ai-model-configs/:id", async (req, res): Promise<void> => {
  const params = GetAiModelConfigParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(aiModelConfigsTable)
    .where(eq(aiModelConfigsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "AI model config not found" });
    return;
  }
  res.json(GetAiModelConfigResponse.parse(row));
});

router.patch("/ai-model-configs/:id", async (req, res): Promise<void> => {
  const params = UpdateAiModelConfigParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAiModelConfigBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid update AI model config body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(aiModelConfigsTable)
    .set(parsed.data)
    .where(eq(aiModelConfigsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "AI model config not found" });
    return;
  }
  res.json(UpdateAiModelConfigResponse.parse(row));
});

router.delete("/ai-model-configs/:id", async (req, res): Promise<void> => {
  const params = DeleteAiModelConfigParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(aiModelConfigsTable)
    .where(eq(aiModelConfigsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "AI model config not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
