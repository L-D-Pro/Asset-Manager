import { eq, and } from "drizzle-orm";
import { db, aiModelConfigsTable } from "@workspace/db";
import { logger } from "./logger";

export interface SelectedModel {
  id: number;
  provider: string;
  modelName: string;
  taskScope: string;
  maxTokens: number | null;
  costPerInputToken: string | null;
  costPerOutputToken: string | null;
  extraConfig: Record<string, unknown>;
}

/**
 * Resolves the active model config for a given task scope, following the
 * fallbackModelId chain until an active model is found.
 *
 * Resolution order:
 *  1. Best active config matching taskScope (lowest priority value wins).
 *  2. If inactive/absent, walk the fallbackModelId chain from that config.
 *  3. If chain exhausted, fall back to any active config with taskScope="default".
 *  4. If nothing found, return null.
 *
 * Task 3 will call this to route AI requests to the correct provider/model.
 */
export async function selectModelForTask(
  taskScope: string,
): Promise<SelectedModel | null> {
  const [primary] = await db
    .select()
    .from(aiModelConfigsTable)
    .where(
      and(
        eq(aiModelConfigsTable.taskScope, taskScope),
        eq(aiModelConfigsTable.isActive, true),
      ),
    )
    .orderBy(aiModelConfigsTable.priority)
    .limit(1);

  if (primary) {
    logger.debug(
      { taskScope, modelId: primary.id, modelName: primary.modelName },
      "Model selected for task",
    );
    return toSelectedModel(primary);
  }

  logger.warn(
    { taskScope },
    "No active primary model for task scope, checking fallback chain",
  );

  const [inactive] = await db
    .select()
    .from(aiModelConfigsTable)
    .where(eq(aiModelConfigsTable.taskScope, taskScope))
    .orderBy(aiModelConfigsTable.priority)
    .limit(1);

  if (inactive?.fallbackModelId != null) {
    const resolved = await resolveFallbackChain(
      inactive.fallbackModelId,
      new Set([inactive.id]),
    );
    if (resolved) {
      logger.info(
        { taskScope, resolvedModelId: resolved.id, modelName: resolved.modelName },
        "Resolved model via fallbackModelId chain",
      );
      return toSelectedModel(resolved);
    }
  }

  const [defaultModel] = await db
    .select()
    .from(aiModelConfigsTable)
    .where(
      and(
        eq(aiModelConfigsTable.taskScope, "default"),
        eq(aiModelConfigsTable.isActive, true),
      ),
    )
    .orderBy(aiModelConfigsTable.priority)
    .limit(1);

  if (defaultModel) {
    logger.info(
      { taskScope, defaultModelId: defaultModel.id },
      "Using default-scope model as final fallback",
    );
    return toSelectedModel(defaultModel);
  }

  logger.error({ taskScope }, "No model config available for task scope");
  return null;
}

async function resolveFallbackChain(
  modelId: number,
  visited: Set<number>,
): Promise<typeof aiModelConfigsTable.$inferSelect | null> {
  if (visited.has(modelId)) {
    logger.warn({ modelId, visited: [...visited] }, "Circular fallback chain detected");
    return null;
  }
  visited.add(modelId);

  const [model] = await db
    .select()
    .from(aiModelConfigsTable)
    .where(eq(aiModelConfigsTable.id, modelId));

  if (!model) return null;
  if (model.isActive) return model;

  if (model.fallbackModelId != null) {
    return resolveFallbackChain(model.fallbackModelId, visited);
  }
  return null;
}

function toSelectedModel(
  row: typeof aiModelConfigsTable.$inferSelect,
): SelectedModel {
  return {
    id: row.id,
    provider: row.provider,
    modelName: row.modelName,
    taskScope: row.taskScope,
    maxTokens: row.maxTokens,
    costPerInputToken: row.costPerInputToken,
    costPerOutputToken: row.costPerOutputToken,
    extraConfig: (row.extraConfig as Record<string, unknown>) ?? {},
  };
}
