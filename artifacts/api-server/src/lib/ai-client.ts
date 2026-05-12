import { openrouter } from "@workspace/integrations-openrouter-ai";
import { db, eventLogsTable, aiModelConfigsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { selectModelForTask, type SelectedModel } from "./model-router";
import { resolvePromptForTask } from "./prompt-router";
import { logger } from "./logger";
import { mintRunId } from "./lineage";
import { getOpenRouterModelCapabilities } from "./openrouter-model-capabilities";

const DEFAULT_AI_REQUEST_TIMEOUT_MS = 60_000;
const AI_CONTROL_PARAM_KEYS = new Set(["timeoutMs", "requestTimeoutMs", "maxAttempts"]);

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

function resolveMaxAttempts(...configs: Array<Record<string, unknown> | undefined>): number | null {
  for (const config of configs) {
    const raw = config?.maxAttempts;
    const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(1, Math.min(Math.floor(parsed), 5));
    }
  }

  return null;
}

function stripAiControlParams(config: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(config).filter(([key]) => !AI_CONTROL_PARAM_KEYS.has(key)),
  );
}

async function withHardTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
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
  /** OpenRouter finish reason for the successful response, when available. */
  finishReason: string | null;
  /** Prior failed attempts in the same fallback chain. */
  priorFailures: AiAttemptFailure[];
  /** Indicates the request had to degrade from strict response-format schema mode. */
  compatibilityNote?: string | null;
}

export interface AiAttemptFailure {
  attemptNumber: number;
  modelId: number;
  modelName: string;
  provider: string;
  error: string;
  category: string;
  elapsedMs: number;
}

function classifyAiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/empty_model_content|empty model content|empty content/i.test(message)) {
    return "empty_model_content";
  }
  if (/unsupported|require_parameters|response_format|json_schema|schema/i.test(message)) {
    return "model_parameter_compatibility";
  }
  if (/\b400\b|provider returned error/i.test(message)) {
    return "provider_rejected_request";
  }
  if (/timeout|abort|timed out/i.test(message)) {
    return "timeout";
  }
  if (/json|parse|source-ref|source ref|structured|contract|validation/i.test(message)) {
    return "content_contract";
  }
  return "upstream_or_unknown";
}

function hasResponseFormatParam(params: Record<string, unknown>): boolean {
  return params.response_format != null;
}

function extractMessageContent(message: unknown): string {
  if (!message || typeof message !== "object") return "";

  const candidate = message as {
    content?: unknown;
    parsed?: unknown;
    tool_calls?: unknown;
  };

  if (typeof candidate.content === "string") {
    return candidate.content;
  }

  if (Array.isArray(candidate.content)) {
    const text = candidate.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        const record = part as { text?: unknown; content?: unknown };
        if (typeof record.text === "string") return record.text;
        if (typeof record.content === "string") return record.content;
        return "";
      })
      .join("")
      .trim();
    if (text.length > 0) return text;
  }

  if (candidate.parsed && typeof candidate.parsed === "object") {
    try {
      return JSON.stringify(candidate.parsed);
    } catch {
      // ignore and continue with other extraction paths
    }
  }

  if (Array.isArray(candidate.tool_calls)) {
    const argsText = candidate.tool_calls
      .map((toolCall) => {
        if (!toolCall || typeof toolCall !== "object") return "";
        const functionObject = (toolCall as { function?: unknown }).function;
        if (!functionObject || typeof functionObject !== "object") return "";
        const args = (functionObject as { arguments?: unknown }).arguments;
        return typeof args === "string" ? args : "";
      })
      .join("\n")
      .trim();
    if (argsText.length > 0) return argsText;
  }

  return "";
}

function extractChoiceContent(choice: unknown): string {
  if (!choice || typeof choice !== "object") return "";
  const choiceRecord = choice as {
    message?: unknown;
    text?: unknown;
  };

  const fromMessage = extractMessageContent(choiceRecord.message);
  if (fromMessage.length > 0) return fromMessage;
  if (typeof choiceRecord.text === "string") return choiceRecord.text;
  return "";
}

async function adaptRequestParamsForModel(args: {
  taskType: string;
  model: SelectedModel;
  requestParams: Record<string, unknown>;
}): Promise<{ requestParams: Record<string, unknown>; compatibilityNote: string | null }> {
  if (!hasResponseFormatParam(args.requestParams)) {
    return { requestParams: args.requestParams, compatibilityNote: null };
  }

  const capabilities = await getOpenRouterModelCapabilities(args.model.modelName);
  const supported = capabilities?.supportedParameters;
  if (!supported || supported.length === 0 || supported.includes("response_format")) {
    const isStrictSchemaTask = args.taskType === "resume_tailoring" || args.taskType === "cover_letter";
    const isOpenAiFamily = args.model.modelName.startsWith("openai/");
    if (isStrictSchemaTask && !isOpenAiFamily) {
      const degraded: Record<string, unknown> = {
        ...args.requestParams,
        response_format: { type: "json_object" },
      };
      if (
        degraded.provider &&
        typeof degraded.provider === "object" &&
        !Array.isArray(degraded.provider)
      ) {
        const provider = { ...(degraded.provider as Record<string, unknown>) };
        delete provider.require_parameters;
        degraded.provider = provider;
      }
      return {
        requestParams: degraded,
        compatibilityNote:
          `Model family ${args.model.modelName} forced to json_object compatibility mode for ${args.taskType}.`,
      };
    }
    return { requestParams: args.requestParams, compatibilityNote: null };
  }

  if (args.taskType === "resume_tailoring" || args.taskType === "cover_letter") {
    const degraded: Record<string, unknown> = { ...args.requestParams };
    delete degraded.response_format;
    if (
      degraded.provider &&
      typeof degraded.provider === "object" &&
      !Array.isArray(degraded.provider)
    ) {
      const provider = { ...(degraded.provider as Record<string, unknown>) };
      delete provider.require_parameters;
      degraded.provider = provider;
    }
    return {
      requestParams: degraded,
      compatibilityNote:
        `Model catalog does not list response_format support; ${args.taskType} degraded to prompt-only JSON validation.`,
    };
  }

  throw new Error(
    `Model ${args.model.modelName} does not support response_format required by ${args.taskType}.`,
  );
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
  const maxAttempts = resolveMaxAttempts(extraParams);
  const attemptModelChain = maxAttempts == null ? modelChain : modelChain.slice(0, maxAttempts);
  logger.info(
    {
      runId,
      taskType,
      modelChain: attemptModelChain.map((model, index) => ({
        attemptNumber: index + 1,
        modelId: model.id,
        modelName: model.modelName,
        provider: model.provider,
      })),
      configuredModelCount: modelChain.length,
      maxAttempts,
    },
    "Resolved AI model fallback chain",
  );
  const attemptErrors: AiAttemptFailure[] = [];
  let lastError: unknown;

  for (const [index, model] of attemptModelChain.entries()) {
    const attemptNumber = index + 1;
    const attemptStartedAt = Date.now();
    try {
      logger.debug(
        { taskType, modelId: model.id, modelName: model.modelName, attempt: attemptNumber, runId },
        "Calling AI model",
      );

      const modelExtraConfig =
        model.extraConfig && typeof model.extraConfig === "object" && !Array.isArray(model.extraConfig)
          ? model.extraConfig
          : {};
      const rawRequestParams = {
        ...stripAiControlParams(modelExtraConfig),
        ...stripAiControlParams(extraParams ?? {}),
      };
      const timeoutMs = resolveTimeoutMs(extraParams, modelExtraConfig);
      const adapted = await adaptRequestParamsForModel({
        taskType,
        model,
        requestParams: rawRequestParams,
      });
      const requestParams = adapted.requestParams;
      const maxTokens =
        typeof requestParams.max_tokens === "number"
          ? requestParams.max_tokens
          : model.maxTokens ?? 8192;
      delete (requestParams as { max_tokens?: unknown }).max_tokens;

      logger.info(
        {
          taskType,
          modelId: model.id,
          modelName: model.modelName,
          attemptNumber,
          timeoutMs,
          maxTokens,
          runId,
        },
        "Dispatching AI request",
      );

      const response = await withHardTimeout(
        openrouter.chat.completions.create({
          ...requestParams,
          model: model.modelName,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: resolvedPrompt.systemPrompt },
            { role: "user", content: resolvedPrompt.userPrompt },
          ],
        } as never, { timeout: timeoutMs } as never),
        timeoutMs,
        `AI request timed out after ${timeoutMs}ms for ${taskType} attempt ${attemptNumber} (${model.modelName})`,
      );

      const content = extractChoiceContent(response.choices[0]);
      const finishReason = response.choices[0]?.finish_reason ?? null;
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
        {
          taskType,
          modelId: model.id,
          modelName: model.modelName,
          promptTokens,
          completionTokens,
          totalCost,
          finishReason,
          contentLength: content.length,
          runId,
          attemptNumber,
          elapsedMs: Date.now() - attemptStartedAt,
        },
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
          modelConfigId: model.id,
          modelOverride: modelOverride ?? null,
          structuredOutput: Boolean(extraParams?.response_format),
          degradedStructuredOutput: Boolean(adapted.compatibilityNote),
          compatibilityNote: adapted.compatibilityNote,
          promptTokens,
          completionTokens,
          finishReason,
          estimatedCostUsd: totalCost,
          succeeded: true,
          attemptNumber,
          priorFailures: attemptErrors,
          configuredModelCount: modelChain.length,
          modelsAttempted: attemptModelChain.length,
          contentLength: content.length,
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
        finishReason,
        priorFailures: attemptErrors,
        compatibilityNote: adapted.compatibilityNote,
      };
    } catch (err) {
      lastError = err;
      const errorMsg = err instanceof Error ? err.message : String(err);
      const elapsedMs = Date.now() - attemptStartedAt;
      attemptErrors.push({
        attemptNumber,
        modelId: model.id,
        modelName: model.modelName,
        provider: model.provider,
        error: errorMsg,
        category: classifyAiError(err),
        elapsedMs,
      });
      logger.warn(
        {
          taskType,
          modelId: model.id,
          modelName: model.modelName,
          error: errorMsg,
          category: classifyAiError(err),
          attemptNumber,
          elapsedMs,
          runId,
        },
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
        configuredModelCount: modelChain.length,
        modelsAttempted: attemptModelChain.length,
        attemptErrors,
        finalError: lastError instanceof Error ? lastError.message : String(lastError),
        finalCategory: classifyAiError(lastError),
        runId,
      },
    }).returning({ id: eventLogsTable.id });

    throw Object.assign(
      new Error(
        `AI call failed for task ${taskType} after exhausting all ${attemptModelChain.length} model(s) in fallback chain: ${String(lastError)}`,
      ),
      {
        runId,
        eventLogId: failureEvent!.id,
        attemptErrors,
      },
    );
  } catch (logErr) {
    if (logErr instanceof Error && "eventLogId" in logErr) {
      throw logErr;
    }
    logger.error({ logErr }, "Failed to write AI failure to event_logs");
  }

  throw new Error(
    `AI call failed for task ${taskType} after exhausting all ${attemptModelChain.length} model(s) in fallback chain: ${String(lastError)}`,
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
