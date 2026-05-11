import { openrouter } from "@workspace/integrations-openrouter-ai";
import { db, eventLogsTable, aiModelConfigsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { selectModelForTask, type SelectedModel } from "./model-router";
import { resolvePromptForTask } from "./prompt-router";
import { logger } from "./logger";
import { mintRunId } from "./lineage";

const DEFAULT_AI_REQUEST_TIMEOUT_MS = 60_000;
const AI_CONTROL_PARAM_KEYS = new Set(["timeoutMs", "requestTimeoutMs"]);

function resolveTimeoutMs(...configs: Array<Record<string, unknown> | undefined>): number {
  for (const config of configs) {
    const raw = config?.timeoutMs ?? config?.requestTimeoutMs;
    const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(5_000, Math.min(parsed, 180_000));
    }
  }

  const envTimeout = Number(process.env.AI_REQUEST_TIMEOUT_MS);
  if (Number.isFinite(envTimeout) && envTimeout > 0) {
    return Math.max(5_000, Math.min(envTimeout, 180_000));
  }

  return DEFAULT_AI_REQUEST_TIMEOUT_MS;
}

function stripAiControlParams(config: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(config).filter(([key]) => !AI_CONTROL_PARAM_KEYS.has(key)),
  );
}

/**
 * Options for a single AI call.
 *
 * `taskType` maps to the `taskScope` column in `ai_model_configs` and determines
 * which model (and fallback chain) is used.
 */
export interface AiCallOptions {
  /** Task identifier — used to select the correct model config (e.g. `"jd_parsing"`, `"resume_tailoring"`). */
  taskType: string;
  /** System-level instruction prompt sent as the first message. */
  systemPrompt: string;
  /** User-facing prompt sent as the second message. */
  userPrompt: string;
  /** Job ID for EventLog context. Pass when the call is tied to a specific job. */
  jobId?: number;
  /** Application ID for EventLog context. Pass when the call is tied to a specific application. */
  applicationId?: number;
  /** Optional pre-minted canonical lineage ID. If omitted, callAI mints one once and reuses it across retries. */
  runId?: string;
  /** Optional one-off model override used for comparison flows. */
  modelOverride?: {
    provider?: string;
    modelName: string;
  };
  /** Optional OpenRouter request parameters, such as response_format or provider routing hints. */
  extraParams?: Record<string, unknown>;
  /**
   * Optional contract validator for successful HTTP responses. Throw from this
   * callback to treat unusable model content as a model failure and advance to
   * the configured fallback model.
   */
  validateContent?: (content: string, model: SelectedModel) => void | Promise<void>;
}

/**
 * The result returned from a successful AI call.
 *
 * Includes the raw text content plus metadata about which model was used and
 * how many tokens were consumed (for cost logging purposes).
 */
export interface AiCallResult {
  /** Raw text content from the AI's first choice. May be empty string on degenerate responses. */
  content: string;
  /** The model identifier that produced this response (e.g. `"anthropic/claude-3.5-haiku"`). */
  modelName: string;
  /** Provider that served the response (e.g. `"openrouter"`). */
  provider: string;
  /** The task scope resolved for this call. */
  taskScope: string;
  /** Number of input (prompt) tokens consumed. */
  promptTokens: number;
  /** Number of output (completion) tokens produced. */
  completionTokens: number;
  /** Active prompt version used for this call, if one was configured. */
  promptVersionId: number | null;
  /** Canonical lineage ID shared by all attempts and the root AI event log row. */
  runId: string;
  /** Inserted event-log row ID for the successful AI root event, or the terminal failure row when all attempts fail. */
  eventLogId: number;
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
  const { taskType, systemPrompt, userPrompt, jobId, applicationId, modelOverride, extraParams, validateContent } = opts;
  const runId = opts.runId ?? mintRunId();
  const resolvedPrompt = await resolvePromptForTask(
    taskType,
    systemPrompt,
    userPrompt,
  );

  const modelChain = await resolveModelChainForCall(taskType, modelOverride);
  const attemptErrors: Array<{ modelName: string; error: string }> = [];
  let lastError: unknown;

  for (const model of modelChain) {
    try {
      logger.debug(
        { taskType, modelName: model.modelName, attempt: modelChain.indexOf(model) + 1 },
        "Calling AI model",
      );

      const modelExtraConfig =
        model.extraConfig && typeof model.extraConfig === "object" && !Array.isArray(model.extraConfig)
          ? model.extraConfig
          : {};
      const requestParams = {
        ...stripAiControlParams(modelExtraConfig),
        ...stripAiControlParams(extraParams ?? {}),
      };
      const timeoutMs = resolveTimeoutMs(extraParams, modelExtraConfig);
      const maxTokens =
        typeof requestParams.max_tokens === "number"
          ? requestParams.max_tokens
          : model.maxTokens ?? 8192;
      delete (requestParams as { max_tokens?: unknown }).max_tokens;

      const response = await openrouter.chat.completions.create({
        ...requestParams,
        model: model.modelName,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: resolvedPrompt.systemPrompt },
          { role: "user", content: resolvedPrompt.userPrompt },
        ],
      } as never, { timeout: timeoutMs } as never);

      const content = response.choices[0]?.message?.content ?? "";
      const usage = response.usage;
      const promptTokens = usage?.prompt_tokens ?? 0;
      const completionTokens = usage?.completion_tokens ?? 0;

      if (validateContent) {
        await validateContent(content, model);
      }

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

      const [eventLog] = await db.insert(eventLogsTable).values({
        entityType: "ai_call",
        entityId: jobId ?? 0,
        applicationId: applicationId ?? null,
        jobId: jobId ?? null,
        runId,
        eventType: "ai_call",
        previousState: null,
        nextState: taskType,
        actorType: "system",
        metadata: {
          taskType,
          promptVersionId: resolvedPrompt.promptVersionId,
          promptLabel: resolvedPrompt.promptLabel,
          modelName: model.modelName,
          provider: model.provider,
          modelOverride: modelOverride ?? null,
          structuredOutput: Boolean(extraParams?.response_format),
          promptTokens,
          completionTokens,
          estimatedCostUsd: totalCost,
          succeeded: true,
          attemptNumber: modelChain.indexOf(model) + 1,
          priorFailures: attemptErrors,
          runId,
        },
      }).returning({ id: eventLogsTable.id });

      return {
        content,
        modelName: model.modelName,
        provider: model.provider,
        taskScope: model.taskScope,
        promptTokens,
        completionTokens,
        promptVersionId: resolvedPrompt.promptVersionId,
        runId,
        eventLogId: eventLog!.id,
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
    const [failureEvent] = await db.insert(eventLogsTable).values({
      entityType: "ai_call",
      entityId: jobId ?? 0,
      applicationId: applicationId ?? null,
      jobId: jobId ?? null,
      runId,
      eventType: "ai_call_failed",
      previousState: null,
      nextState: `${taskType}_failed`,
      actorType: "system",
      metadata: {
        taskType,
        promptVersionId: resolvedPrompt.promptVersionId,
        promptLabel: resolvedPrompt.promptLabel,
        modelOverride: modelOverride ?? null,
        succeeded: false,
        modelsAttempted: modelChain.length,
        attemptErrors,
        finalError: lastError instanceof Error ? lastError.message : String(lastError),
        runId,
      },
    }).returning({ id: eventLogsTable.id });

    throw Object.assign(
      new Error(
        `AI call failed for task ${taskType} after exhausting all ${modelChain.length} model(s) in fallback chain: ${String(lastError)}`,
      ),
      {
        runId,
        eventLogId: failureEvent!.id,
      },
    );
  } catch (logErr) {
    if (logErr instanceof Error && "eventLogId" in logErr) {
      throw logErr;
    }
    logger.error({ logErr }, "Failed to write AI failure to event_logs");
  }

  throw new Error(
    `AI call failed for task ${taskType} after exhausting all ${modelChain.length} model(s) in fallback chain: ${String(lastError)}`,
  );
}

async function resolveModelChainForCall(
  taskType: string,
  modelOverride?: { provider?: string; modelName: string },
): Promise<SelectedModel[]> {
  if (modelOverride?.modelName) {
    const provider = modelOverride.provider?.trim() || "openrouter";
    if (provider !== "openrouter") {
      throw new Error(`Unsupported provider override: ${provider}`);
    }

    const [configured] = await db
      .select()
      .from(aiModelConfigsTable)
      .where(
        and(
          eq(aiModelConfigsTable.provider, provider),
          eq(aiModelConfigsTable.modelName, modelOverride.modelName),
          eq(aiModelConfigsTable.isActive, true),
        ),
      )
      .orderBy(aiModelConfigsTable.priority)
      .limit(1);

    if (configured) {
      return [
        {
          id: configured.id,
          provider: configured.provider,
          modelName: configured.modelName,
          taskScope: configured.taskScope,
          maxTokens: configured.maxTokens,
          costPerInputToken: configured.costPerInputToken,
          costPerOutputToken: configured.costPerOutputToken,
          extraConfig: (configured.extraConfig as Record<string, unknown>) ?? {},
        },
      ];
    }

    return [
      {
        id: -1,
        provider,
        modelName: modelOverride.modelName,
        taskScope: taskType,
        maxTokens: null,
        costPerInputToken: null,
        costPerOutputToken: null,
        extraConfig: {},
      },
    ];
  }

  const primaryModel = await selectModelForTask(taskType);
  if (!primaryModel) {
    throw new Error(`No active AI model configured for task type: ${taskType}`);
  }

  return resolveModelChain(primaryModel);
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
 *
 * Strips Markdown code fences (` ```json ... ``` `) before parsing.
 * Falls back to returning `null` if no valid JSON can be extracted.
 * Callers should treat a `null` return as a soft failure and decide whether to
 * store the raw content for debugging or retry.
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
