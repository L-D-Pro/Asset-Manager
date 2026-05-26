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
import { requireAdmin } from "../middlewares/admin";

const router: IRouter = Router();

let modelCatalogCache: {
  expiresAt: number;
  items: Array<Record<string, unknown>>;
} | null = null;

router.get("/ai-model-catalog", async (req, res): Promise<void> => {
  const now = Date.now();
  if (modelCatalogCache && modelCatalogCache.expiresAt > now) {
    res.json({ source: "cache", models: modelCatalogCache.items });
    return;
  }

  const baseUrl = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;

  if (!baseUrl || !apiKey) {
    res.status(503).json({ error: "OpenRouter integration env is not configured" });
    return;
  }

  const [configs, resumeDefault, coverDefault] = await Promise.all([
    db.select().from(aiModelConfigsTable),
    db
      .select()
      .from(aiModelConfigsTable)
      .where(and(eq(aiModelConfigsTable.taskScope, "resume_tailoring"), eq(aiModelConfigsTable.isActive, true)))
      .orderBy(aiModelConfigsTable.priority)
      .limit(1),
    db
      .select()
      .from(aiModelConfigsTable)
      .where(and(eq(aiModelConfigsTable.taskScope, "cover_letter"), eq(aiModelConfigsTable.isActive, true)))
      .orderBy(aiModelConfigsTable.priority)
      .limit(1),
  ]);

  const configuredByModel = new Map<string, typeof configs>();
  for (const row of configs) {
    const current = configuredByModel.get(row.modelName) ?? [];
    current.push(row);
    configuredByModel.set(row.modelName, current);
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      res.status(502).json({ error: `OpenRouter catalog request failed (${response.status})` });
      return;
    }

    const payload = (await response.json()) as {
      data?: Array<Record<string, unknown>>;
    };

    const models = (payload.data ?? []).map((item) => {
      const modelId = typeof item.id === "string" ? item.id : "";
      const configured = configuredByModel.get(modelId) ?? [];
      return {
        id: modelId,
        name: typeof item.name === "string" ? item.name : modelId,
        contextLength:
          typeof item.context_length === "number" ? item.context_length : null,
        pricing: item.pricing ?? null,
        supportedParameters: Array.isArray(item.supported_parameters)
          ? item.supported_parameters
          : [],
        isConfigured: configured.length > 0,
        configuredScopes: [...new Set(configured.map((c) => c.taskScope))],
        isDefaultForResumeTailoring:
          resumeDefault[0]?.modelName != null && resumeDefault[0].modelName === modelId,
        isDefaultForCoverLetter:
          coverDefault[0]?.modelName != null && coverDefault[0].modelName === modelId,
      };
    });

    modelCatalogCache = {
      expiresAt: now + 5 * 60 * 1000,
      items: models,
    };

    res.json({ source: "openrouter", models });
  } catch (error) {
    req.log.error({ error }, "Failed to fetch OpenRouter model catalog");
    res.status(502).json({ error: "Failed to fetch OpenRouter model catalog" });
  }
});

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

router.post("/ai-model-configs", requireAdmin, async (req, res): Promise<void> => {
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

router.patch("/ai-model-configs/:id", requireAdmin, async (req, res): Promise<void> => {
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

router.delete("/ai-model-configs/:id", requireAdmin, async (req, res): Promise<void> => {
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
