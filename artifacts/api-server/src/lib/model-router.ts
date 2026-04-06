import { eq, and } from "drizzle-orm";
import { db, aiModelConfigsTable } from "@workspace/db";
import { logger } from "./logger";

export interface SelectedModel {
  id: number;
  provider: string;
  modelName: string;
  taskScope: string;
  maxTokens: number | null;
  extraConfig: Record<string, unknown>;
}

/**
 * Selects the best active AI model config for a given task scope.
 * Respects priority ordering and falls back to the configured fallback model
 * if the primary is unavailable. Task 3 will call this to route AI requests.
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
    logger.debug({ taskScope, modelId: primary.id, modelName: primary.modelName }, "Model selected");
    return {
      id: primary.id,
      provider: primary.provider,
      modelName: primary.modelName,
      taskScope: primary.taskScope,
      maxTokens: primary.maxTokens,
      extraConfig: (primary.extraConfig as Record<string, unknown>) ?? {},
    };
  }

  logger.warn({ taskScope }, "No active model config found for task scope, trying wildcard");

  const [wildcard] = await db
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

  if (wildcard) {
    logger.info({ taskScope, fallbackModelId: wildcard.id }, "Using default-scope model as fallback");
    return {
      id: wildcard.id,
      provider: wildcard.provider,
      modelName: wildcard.modelName,
      taskScope: wildcard.taskScope,
      maxTokens: wildcard.maxTokens,
      extraConfig: (wildcard.extraConfig as Record<string, unknown>) ?? {},
    };
  }

  logger.error({ taskScope }, "No model config available for task scope");
  return null;
}
