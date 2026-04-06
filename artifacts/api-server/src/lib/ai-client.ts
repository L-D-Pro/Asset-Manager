import { openrouter } from "@workspace/integrations-openrouter-ai";
import { db, eventLogsTable } from "@workspace/db";
import { selectModelForTask } from "./model-router";
import { logger } from "./logger";

export interface AiCallOptions {
  taskType: string;
  systemPrompt: string;
  userPrompt: string;
  jobId?: number;
  applicationId?: number;
  maxRetries?: number;
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
 * Calls the AI via OpenRouter using the configured model for the given task type.
 * Falls back via the model-router fallback chain on failure.
 * Logs cost metadata to EventLog after each call.
 */
export async function callAI(opts: AiCallOptions): Promise<AiCallResult> {
  const { taskType, systemPrompt, userPrompt, jobId, applicationId } = opts;
  const maxRetries = opts.maxRetries ?? 2;

  const model = await selectModelForTask(taskType);
  if (!model) {
    throw new Error(`No active AI model configured for task type: ${taskType}`);
  }

  let lastError: unknown;
  let attempt = 0;

  while (attempt <= maxRetries) {
    attempt++;
    try {
      logger.debug(
        { taskType, modelName: model.modelName, attempt },
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
        {
          taskType,
          modelName: model.modelName,
          promptTokens,
          completionTokens,
          totalCost,
        },
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
      logger.warn(
        { taskType, attempt, maxRetries, error: String(err) },
        "AI call failed, retrying",
      );
      if (attempt <= maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw new Error(
    `AI call failed after ${maxRetries + 1} attempts for task ${taskType}: ${String(lastError)}`,
  );
}

/**
 * Attempts to parse the AI response as JSON.
 * Falls back to returning the raw content if parsing fails.
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
