import { openrouter } from "@workspace/integrations-openrouter-ai";
import { db, eventLogsTable, aiModelConfigsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { selectModelForTask, type SelectedModel } from "./model-router";
import { logger } from "./logger";

export interface AiCallOptions {
  taskType: string;
  systemPrompt: string;
  userPrompt: string;
  jobId?: number;
  applicationId?: number;
}

export interface AiCallResult {
  content: string;
  modelName: string;
  provider: string;
  taskScope: string;
  promptTokens: number;
  completionTokens: number;
}

/**
 * Calls the AI via OpenRouter, routing through the model fallback chain on failure.
 *
 * Resolution strategy on failure:
 *  1. Call the active model for the task scope.
 *  2. If that call fails, follow the fallbackModelId chain from that model config.
 *  3. Log each attempt (success or failure) to EventLog for full auditability.
 *
 * Note on env vars: this integration uses AI_INTEGRATIONS_OPENROUTER_BASE_URL and
 * AI_INTEGRATIONS_OPENROUTER_API_KEY (provisioned by the Replit OpenRouter integration),
 * not a bare OPENROUTER_API_KEY. The `openrouter` client from @workspace/integrations-openrouter-ai
 * reads these automatically.
 */
export async function callAI(opts: AiCallOptions): Promise<AiCallResult> {
  const { taskType, systemPrompt, userPrompt, jobId, applicationId } = opts;

  const primaryModel = await selectModelForTask(taskType);
  if (!primaryModel) {
    throw new Error(`No active AI model configured for task type: ${taskType}`);
  }

  const modelChain = await resolveModelChain(primaryModel);
  const attemptErrors: Array<{ modelName: string; error: string }> = [];
  let lastError: unknown;

  for (const model of modelChain) {
    try {
      logger.debug(
        { taskType, modelName: model.modelName, attempt: modelChain.indexOf(model) + 1 },
        "Calling AI model",
      );

      const response = await openrouter.chat.completions.create({
        model: model.modelName,
        max_tokens: model.maxTokens ?? 8192,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = response.choices[0]?.message?.content ?? "";
      const usage = response.usage;
      const promptTokens = usage?.prompt_tokens ?? 0;
      const completionTokens = usage?.completion_tokens ?? 0;

      const costIn = model.costPerInputToken
        ? parseFloat(model.costPerInputToken) * promptTokens
        : null;
      const costOut = model.costPerOutputToken
        ? parseFloat(model.costPerOutputToken) * completionTokens
        : null;
      const totalCost = costIn != null && costOut != null ? costIn + costOut : null;

      logger.info(
        { taskType, modelName: model.modelName, promptTokens, completionTokens, totalCost },
        "AI call completed",
      );

      await db.insert(eventLogsTable).values({
        entityType: "ai_call",
        entityId: jobId ?? 0,
        applicationId: applicationId ?? null,
        jobId: jobId ?? null,
        eventType: "ai_call",
        previousState: null,
        nextState: taskType,
        actorType: "system",
        metadata: {
          taskType,
          modelName: model.modelName,
          provider: model.provider,
          promptTokens,
          completionTokens,
          estimatedCostUsd: totalCost,
          succeeded: true,
          attemptNumber: modelChain.indexOf(model) + 1,
          priorFailures: attemptErrors,
        },
      });

      return {
        content,
        modelName: model.modelName,
        provider: model.provider,
        taskScope: model.taskScope,
        promptTokens,
        completionTokens,
      };
    } catch (err) {
      lastError = err;
      const errorMsg = err instanceof Error ? err.message : String(err);
      attemptErrors.push({ modelName: model.modelName, error: errorMsg });
      logger.warn(
        { taskType, modelName: model.modelName, error: errorMsg },
        "AI call failed, advancing to next model in fallback chain",
      );
    }
  }

  // Log the terminal failure to EventLog for auditability
  try {
    await db.insert(eventLogsTable).values({
      entityType: "ai_call",
      entityId: jobId ?? 0,
      applicationId: applicationId ?? null,
      jobId: jobId ?? null,
      eventType: "ai_call_failed",
      previousState: null,
      nextState: `${taskType}_failed`,
      actorType: "system",
      metadata: {
        taskType,
        succeeded: false,
        modelsAttempted: modelChain.length,
        attemptErrors,
        finalError: lastError instanceof Error ? lastError.message : String(lastError),
      },
    });
  } catch (logErr) {
    logger.error({ logErr }, "Failed to write AI failure to event_logs");
  }

  throw new Error(
    `AI call failed for task ${taskType} after exhausting all ${modelChain.length} model(s) in fallback chain: ${String(lastError)}`,
  );
}

/**
 * Builds a list of models to try in order, starting with the primary
 * and following the fallbackModelId chain.
 */
async function resolveModelChain(primary: SelectedModel): Promise<SelectedModel[]> {
  const chain: SelectedModel[] = [primary];
  const visited = new Set<number>([primary.id]);

  let currentId: number | null = await getFallbackModelId(primary.id);

  while (currentId != null && !visited.has(currentId)) {
    visited.add(currentId);
    const [row] = await db
      .select()
      .from(aiModelConfigsTable)
      .where(and(eq(aiModelConfigsTable.id, currentId), eq(aiModelConfigsTable.isActive, true)));

    if (!row) break;

    chain.push({
      id: row.id,
      provider: row.provider,
      modelName: row.modelName,
      taskScope: row.taskScope,
      maxTokens: row.maxTokens,
      costPerInputToken: row.costPerInputToken,
      costPerOutputToken: row.costPerOutputToken,
      extraConfig: (row.extraConfig as Record<string, unknown>) ?? {},
    });

    currentId = row.fallbackModelId;
  }

  return chain;
}

async function getFallbackModelId(modelId: number): Promise<number | null> {
  const [row] = await db
    .select({ fallbackModelId: aiModelConfigsTable.fallbackModelId })
    .from(aiModelConfigsTable)
    .where(eq(aiModelConfigsTable.id, modelId));
  return row?.fallbackModelId ?? null;
}

/**
 * Attempts to parse the AI response as JSON.
 * Falls back to returning null if parsing fails.
 */
export function parseJsonResponse<T>(content: string): T | null {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ??
    content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  const jsonStr = jsonMatch ? jsonMatch[1] ?? jsonMatch[0] : content.trim();
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    logger.warn({ raw: content.slice(0, 200) }, "Failed to parse AI JSON response");
    return null;
  }
}
