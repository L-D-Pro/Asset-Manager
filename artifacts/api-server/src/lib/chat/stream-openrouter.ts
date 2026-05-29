import type { Response } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  conversations,
  messages,
  eventLogsTable,
  chatRoutingDecisionsTable,
  aiModelConfigsTable,
  type MessageAttachment,
  type AiModelConfig,
} from "@workspace/db";
import { openrouter } from "@workspace/integrations-openrouter-ai";
import { logger } from "../logger";
import { mintRunId } from "../lineage";
import { selectModelForTask, type SelectedModel } from "../model-router";
import { getChatLeverConfig, resolveChatPrompt } from "./resolve-system-prompt";
import { resolveChatPromptVersionId } from "./prompt-versions";
import { buildParsedJdBlock, type ParsedJd } from "./context-builder";
import { extractJdParseSource, getCachedJdParse, type JdParseSource } from "./jd-source";
import { validateChatOutput } from "./output-validator";
import { inspectContextRequirements } from "./context-requirements";
import type { RoutingDecision } from "./skill-router";

/**
 * Fallback max_tokens for model configs where maxTokens is null in the DB.
 * Model-level override always wins. This constant exists so the fallback is
 * visible and grep-able, not buried in an inline `?? 4096`.
 */
const DEFAULT_MODEL_MAX_TOKENS = 4096;

export interface StreamChatCompletionOptions {
  conversationId: number;
  userId: number;
  userMessage: { content: string; attachments: MessageAttachment[] };
  res: Response;
  /** When set, uses this specific model config instead of selecting via task scope. */
  modelConfigId?: number;
  /** When true, runs JD pre-parsing (haiku) before the main model. Main model waits for the result. */
  jdParseEnabled?: boolean;
  /** Skills the user explicitly picked in the composer (honored in `explicit` routing mode). */
  explicitSkillSlugs?: string[];
  /** Allows tests to inject a fake OpenRouter client. */
  client?: { chat: { completions: { create: typeof openrouter.chat.completions.create } } };
  /** Allows tests to provide a stable runId / clock. */
  runIdOverride?: string;
}

function toSelectedModel(row: AiModelConfig): SelectedModel {
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

async function resolveModel(
  thread: { modelScope: string },
  modelConfigId: number | undefined,
): Promise<SelectedModel | null> {
  if (modelConfigId != null) {
    const [row] = await db
      .select()
      .from(aiModelConfigsTable)
      .where(eq(aiModelConfigsTable.id, modelConfigId))
      .limit(1);
    return row ? toSelectedModel(row) : null;
  }
  return selectModelForTask(thread.modelScope);
}

function sseSend(res: Response, event: string | null, data: unknown): void {
  if (event) res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/** Classify how a routing decision was reached, for the decisions table. */
function classifierTypeFor(mode: string, decision: RoutingDecision): string {
  if (mode === "none") return "none";
  if (mode === "explicit" || mode === "debug_all") return "manual";
  if (decision.llmUsed) return "llm";
  return "deterministic";
}

function extractDeltaText(chunk: unknown): string {
  if (!chunk || typeof chunk !== "object") return "";
  const choices = (chunk as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = choices[0] as { delta?: { content?: unknown } } | undefined;
  const content = first?.delta?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === "string" ? p : (p as { text?: string })?.text ?? ""))
      .join("");
  }
  return "";
}

function extractUsage(chunk: unknown): { promptTokens?: number; completionTokens?: number } | null {
  if (!chunk || typeof chunk !== "object") return null;
  const usage = (chunk as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return null;
  const u = usage as { prompt_tokens?: number; completion_tokens?: number };
  return {
    promptTokens: typeof u.prompt_tokens === "number" ? u.prompt_tokens : undefined,
    completionTokens: typeof u.completion_tokens === "number" ? u.completion_tokens : undefined,
  };
}

/**
 * Stream a chat completion to the client over SSE and persist the assistant
 * turn + lineage row when complete.
 *
 * Important: this function never calls `callAI()` and does not touch the
 * existing AI runtime. It owns its own OpenRouter call so chat can stream
 * without changing non-streaming code paths.
 */
export async function streamChatCompletion(opts: StreamChatCompletionOptions): Promise<void> {
  const { conversationId, userId, userMessage, res } = opts;
  const client = opts.client ?? openrouter;

  // ── Timing instrumentation ──────────────────────────────────────────────
  const t0 = performance.now();
  const timings: Record<string, number> = {};

  // ── Ownership check ─────────────────────────────────────────────────────
  const _t_ownership0 = performance.now();
  const [thread] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);
  timings.ownershipMs = Math.round(performance.now() - _t_ownership0);

  if (!thread) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  // ── Persist the user turn ───────────────────────────────────────────────
  const _t_persistUser0 = performance.now();
  const [userTurn] = await db
    .insert(messages)
    .values({
      conversationId,
      role: "user",
      content: userMessage.content,
      attachments: userMessage.attachments,
    })
    .returning();
  timings.persistUserTurnMs = Math.round(performance.now() - _t_persistUser0);

  // ── Resolve model (explicit config ID overrides scope-based selection) ──
  const _t_resolveModel0 = performance.now();
  const model = await resolveModel(thread, opts.modelConfigId);
  timings.resolveModelMs = Math.round(performance.now() - _t_resolveModel0);
  if (!model) {
    res.status(503).json({
      error: `No active AI model configured for task scope '${thread.modelScope}'. Seed one via the AI Config page or run the chat seed script.`,
    });
    return;
  }

  // ── Lever config for history turn limit ─────────────────────────────────
  const _t_leverConfig0 = performance.now();
  const leverConfig = await getChatLeverConfig();
  timings.loadLeverConfigMs = Math.round(performance.now() - _t_leverConfig0);

  // ── Prompt version + primary skill slug resolved from routing decision ──
  // Attribution deferred until after routing (see below).
  let promptVersionId: number | null = null;
  let primarySkillSlug: string | null = null;

  const _t_history0 = performance.now();
  const historyRows = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(leverConfig.historyTurnLimit);
  timings.loadHistoryMs = Math.round(performance.now() - _t_history0);

  const history = historyRows
    .reverse()
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const runId = opts.runIdOverride ?? mintRunId();

  // ── SSE headers — open the stream before any blocking AI work ───────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  sseSend(res, "user-message", { id: userTurn!.id, role: "user" });

  // ── JD pre-parsing (runs with SSE open; main model waits for result) ────
  // The SSE connection is alive here, so the frontend sees activity.
  // The main model will not start until this await resolves.
  let parsedJd: ParsedJd | null = null;
  let jdParseSource: JdParseSource["source"] = "none";
  let jdParseCacheHit = false;

  if (opts.jdParseEnabled) {
    const jdSource = extractJdParseSource({
      userMessage: userMessage.content,
      attachments: userMessage.attachments,
    });
    jdParseSource = jdSource.source;

    if (jdSource.text) {
      sseSend(res, "jd-parsing", {});
      const _t_jdParse0 = performance.now();
      const result = await getCachedJdParse(jdSource.text, userId);
      timings.jdParseMs = Math.round(performance.now() - _t_jdParse0);
      parsedJd = result.parsedJd;
      jdParseCacheHit = result.cacheHit;

      if (parsedJd) {
        sseSend(res, "jd-parsed", { requiredSkills: parsedJd.requiredSkills, senioritySignal: parsedJd.senioritySignal });
      } else {
        logger.warn({ conversationId }, "jdParseEnabled but parse returned null — proceeding without parsed JD");
        sseSend(res, "jd-parse-failed", {});
      }
    }
    // jdSource.source === "none" → skip parse silently, no SSE events emitted
  } else {
    timings.jdParseMs = 0;
  }

  // ── Route skills + build system prompt (after JD parse) ─────────────────
  const _t_resolvePrompt0 = performance.now();
  const { systemPrompt, decision: routingDecision, mode: routingMode } =
    await resolveChatPrompt({
      userMessage: userMessage.content,
      attachments: userMessage.attachments,
      explicitSlugs: opts.explicitSkillSlugs,
      userId,
    });
  timings.resolvePromptMs = Math.round(performance.now() - _t_resolvePrompt0);

  sseSend(res, "skill-routing", {
    selectedSlugs: routingDecision.selectedSlugs,
    confidence: routingDecision.confidence,
    reason: routingDecision.reason,
    llmUsed: routingDecision.llmUsed,
  });

  // ── Context requirements check (resume-tailoring guard) ─────────────────
  const contextReqs = inspectContextRequirements({
    selectedSlugs: routingDecision.selectedSlugs,
    attachments: userMessage.attachments,
    userMessage: userMessage.content,
  });

  if (contextReqs.blocking) {
    // Join with double newline so stored conversation history renders each instruction separately.
    const warningMsg = contextReqs.warnings.join("\n\n");
    sseSend(res, "context-warning", { warnings: contextReqs.warnings, blocking: true });
    const [blockedAssistantTurn] = await db
      .insert(messages)
      .values({
        conversationId,
        role: "assistant",
        content: warningMsg,
        attachments: [],
        runId,
        promptVersionId: null,
        modelName: null,
        promptTokens: null,
        completionTokens: null,
      })
      .returning();
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
    timings.totalMs = Math.round(performance.now() - t0);
    await db.insert(eventLogsTable).values({
      userId,
      entityType: "ai_call",
      entityId: blockedAssistantTurn!.id,
      runId,
      eventType: "ai_call_skipped",
      actorType: "system",
      metadata: {
        taskScope: thread.modelScope,
        runId,
        reason: "context_requirements_not_met",
        contextRequirements: contextReqs,
        chatTimings: { ...timings },
        selectedSlugs: routingDecision.selectedSlugs,
      },
    });
    // eventLogId is null on blocked turns — no LLM call was made so there is no ai_call event log to link.
    sseSend(res, "done", {
      messageId: blockedAssistantTurn!.id,
      runId,
      promptVersionId: null,
      eventLogId: null,
      primarySkill: null,
    });
    res.end();
    return;
  }

  // ── Resolve prompt version attribution from routing decision ────────────
  // Use the first selected skill slug (if any); null means no skill was selected.
  primarySkillSlug = routingDecision.selectedSlugs[0] ?? null;
  if (primarySkillSlug) {
    const _t_promptVersion0 = performance.now();
    promptVersionId = await resolveChatPromptVersionId(primarySkillSlug);
    timings.resolvePromptVersionMs = Math.round(performance.now() - _t_promptVersion0);
  } else {
    timings.resolvePromptVersionMs = 0;
  }

  const fullSystemPrompt = parsedJd
    ? `${systemPrompt}\n\n${buildParsedJdBlock(parsedJd)}`
    : systemPrompt;

  // ── Stream the assistant turn ───────────────────────────────────────────
  let assistantText = "";
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let finishReason: string | null = null;
  let activeModel = model;

  const chatMessages = [
    { role: "system" as const, content: fullSystemPrompt },
    ...history,
  ];

  /** True when the error is a permanent client error that should not trigger a fallback retry. */
  function isNonRetryable(err: unknown): boolean {
    const status =
      (err as { status?: number })?.status ??
      (err as { statusCode?: number })?.statusCode;
    if (typeof status !== "number") return false;
    // 4xx errors are permanent except 408 (timeout), 409 (conflict/transient), 429 (rate-limit).
    return status >= 400 && status < 500 && ![408, 409, 429].includes(status);
  }

  let primaryFailedPermanently = false;
  // Populated after the winning stream completes.
  let streamDurationMs = 0;
  let timeToFirstTokenMs = 0;

  async function attemptStream(m: SelectedModel): Promise<boolean> {
    const _t_stream0 = performance.now();
    let firstToken = true;
    try {
      const response = await client.chat.completions.create({
        model: m.modelName,
        stream: true,
        max_tokens: m.maxTokens ?? DEFAULT_MODEL_MAX_TOKENS,
        messages: chatMessages,
      } as never);

      for await (const chunk of response as unknown as AsyncIterable<unknown>) {
        const delta = extractDeltaText(chunk);
        if (delta.length > 0) {
          if (firstToken) {
            timeToFirstTokenMs = Math.round(performance.now() - _t_stream0);
            firstToken = false;
          }
          assistantText += delta;
          sseSend(res, null, { token: delta });
        }
        const usage = extractUsage(chunk);
        if (usage) {
          promptTokens = usage.promptTokens ?? promptTokens;
          completionTokens = usage.completionTokens ?? completionTokens;
        }
        const fr = (chunk as { choices?: Array<{ finish_reason?: string | null }> }).choices?.[0]?.finish_reason;
        if (fr) finishReason = fr;
      }
      streamDurationMs = Math.round(performance.now() - _t_stream0);
      return true;
    } catch (err) {
      logger.warn({ conversationId, modelName: m.modelName, err }, "Chat stream attempt failed");
      if (isNonRetryable(err)) primaryFailedPermanently = true;
      return false;
    }
  }

  const primaryOk = await attemptStream(model);

  if (!primaryOk) {
    // If partial tokens reached the client, tell it to discard them.
    if (assistantText.length > 0) {
      sseSend(res, "stream-reset", { reason: "Primary model failed mid-stream; retrying with fallback." });
    }
    // Reset accumulated state so the fallback starts clean.
    assistantText = "";
    promptTokens = undefined;
    completionTokens = undefined;
    finishReason = null;

    // Non-retryable 4xx from OpenRouter — fallback would also fail; skip it.
    if (primaryFailedPermanently) {
      const errMsg = `Chat model ${model.modelName} failed with a non-retryable error.`;
      logger.error({ conversationId, runId }, errMsg);
      sseSend(res, "error", { message: errMsg });
      timings.totalMs = Math.round(performance.now() - t0);
      await db.insert(eventLogsTable).values({
        userId,
        entityType: "ai_call", entityId: userTurn!.id, runId,
        eventType: "ai_call_failed", actorType: "system",
        metadata: { taskScope: thread.modelScope, modelName: model.modelName, finalError: errMsg, succeeded: false, runId, chatTimings: timings },
      });
      res.end();
      return;
    }

    // Try fallback model if configured
    let fallbackModel: SelectedModel | null = null;
    if (model.id) {
      const [configRow] = await db
        .select()
        .from(aiModelConfigsTable)
        .where(eq(aiModelConfigsTable.id, model.id))
        .limit(1);
      if (configRow?.fallbackModelId) {
        const [fallbackRow] = await db
          .select()
          .from(aiModelConfigsTable)
          .where(eq(aiModelConfigsTable.id, configRow.fallbackModelId))
          .limit(1);
        if (fallbackRow) fallbackModel = toSelectedModel(fallbackRow);
      }
    }

    if (fallbackModel) {
      logger.warn({ originalModel: model.modelName, fallbackModel: fallbackModel.modelName, conversationId }, "Primary chat model failed, switching to fallback");
      sseSend(res, "fallback", { originalModel: model.modelName, fallbackModel: fallbackModel.modelName });
      activeModel = fallbackModel;
      const fallbackOk = await attemptStream(fallbackModel);
      if (!fallbackOk) {
        const errMsg = `Both primary (${model.modelName}) and fallback (${fallbackModel.modelName}) models failed.`;
        logger.error({ conversationId, runId }, errMsg);
        sseSend(res, "error", { message: errMsg });
        timings.totalMs = Math.round(performance.now() - t0);
        await db.insert(eventLogsTable).values({
          userId,
          entityType: "ai_call", entityId: userTurn!.id, runId,
          eventType: "ai_call_failed", actorType: "system",
          metadata: { taskScope: thread.modelScope, modelName: fallbackModel.modelName, finalError: errMsg, succeeded: false, runId, chatTimings: timings },
        });
        res.end();
        return;
      }
    } else {
      const errMsg = `Chat model ${model.modelName} failed and no fallback is configured.`;
      logger.error({ err: errMsg, runId, conversationId }, "Chat stream failed");
      sseSend(res, "error", { message: errMsg });
      timings.totalMs = Math.round(performance.now() - t0);
      await db.insert(eventLogsTable).values({
        userId,
        entityType: "ai_call", entityId: userTurn!.id, runId,
        eventType: "ai_call_failed", actorType: "system",
        metadata: { taskScope: thread.modelScope, modelName: model.modelName, finalError: errMsg, succeeded: false, runId, chatTimings: timings },
      });
      res.end();
      return;
    }
  }

  // ── Persist assistant turn + canonical lineage event ────────────────────
  const _t_persistAssistant0 = performance.now();
  const [assistantTurn] = await db
    .insert(messages)
    .values({
      conversationId,
      role: "assistant",
      content: assistantText,
      attachments: [],
      runId,
      promptVersionId,
      modelName: activeModel.modelName,
      promptTokens: promptTokens ?? null,
      completionTokens: completionTokens ?? null,
    })
    .returning();
  timings.persistAssistantMs = Math.round(performance.now() - _t_persistAssistant0);

  // Refresh conversation updatedAt for thread ordering.
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  // ── Persist the routing decision (observability + evals) ────────────────
  const _t_persistRouting0 = performance.now();
  await db.insert(chatRoutingDecisionsTable).values({
    runId,
    conversationId,
    messageId: assistantTurn!.id,
    routingMode,
    candidates: routingDecision.candidates,
    selectedSkills: routingDecision.selectedSlugs,
    classifierType: classifierTypeFor(routingMode, routingDecision),
    confidence: routingDecision.confidence.toFixed(2),
    llmUsed: routingDecision.llmUsed,
    rationale: routingDecision.reason,
    skillPromptTokens: routingDecision.skillPromptTokens,
    budgetTrimmed: routingDecision.budgetTrimmed,
  });
  timings.persistRoutingDecisionMs = Math.round(performance.now() - _t_persistRouting0);

  // ── Light output validation (non-blocking — output already streamed) ────
  const validation = validateChatOutput(assistantText, { selectedSlugs: routingDecision.selectedSlugs });
  if (validation.warnings.length > 0) {
    logger.warn({ conversationId, runId, warnings: validation.warnings }, "chat output validation warnings");
  }

  const costIn = activeModel.costPerInputToken && promptTokens != null
    ? parseFloat(activeModel.costPerInputToken) * promptTokens
    : null;
  const costOut = activeModel.costPerOutputToken && completionTokens != null
    ? parseFloat(activeModel.costPerOutputToken) * completionTokens
    : null;
  const estimatedCostUsd = costIn != null && costOut != null ? costIn + costOut : null;

  timings.streamDurationMs = streamDurationMs;
  timings.timeToFirstTokenMs = timeToFirstTokenMs;
  // persistEventLogMs is 0 here because we can't know the insert duration before it happens.
  // The field is a sentinel: its presence confirms instrumentation ran; totalMs captures the full wall time.
  timings.persistEventLogMs = 0;
  timings.totalMs = Math.round(performance.now() - t0);
  // Freeze a snapshot so the stored chatTimings reflects values at insert time, not later mutations.
  const chatTimingsSnapshot = { ...timings };

  const _t_persistEventLog0 = performance.now();
  const [chatEvent] = await db
    .insert(eventLogsTable)
    .values({
      userId,
      entityType: "ai_call",
      entityId: assistantTurn!.id,
      runId,
      eventType: "ai_call",
      nextState: thread.modelScope,
      actorType: "system",
      metadata: {
        taskType: thread.modelScope,
        taskScope: thread.modelScope,
        promptVersionId,
        modelName: activeModel.modelName,
        provider: activeModel.provider,
        modelConfigId: activeModel.id,
        primaryModelName: model.modelName,
        usedFallback: activeModel.id !== model.id,
        primarySkill: primarySkillSlug,
        jdParsed: parsedJd != null,
        jdParseSource,
        jdParseCacheHit,
        routing: {
          mode: routingMode,
          selectedSlugs: routingDecision.selectedSlugs,
          confidence: routingDecision.confidence,
          llmUsed: routingDecision.llmUsed,
          skillPromptTokens: routingDecision.skillPromptTokens,
          budgetTrimmed: routingDecision.budgetTrimmed,
        },
        validation: { lengthOk: validation.lengthOk, formatOk: validation.formatOk, warnings: validation.warnings },
        chatMessageEntityType: "chat_message",
        chatMessageId: assistantTurn!.id,
        promptTokens: promptTokens ?? null,
        completionTokens: completionTokens ?? null,
        estimatedCostUsd,
        finishReason,
        succeeded: true,
        contentLength: assistantText.length,
        runId,
        chatTimings: chatTimingsSnapshot,
        selectedSlugs: routingDecision.selectedSlugs,
        llmUsed: routingDecision.llmUsed,
        jdParseEnabled: opts.jdParseEnabled ?? false,
        promptLengthEstimate: Math.ceil(fullSystemPrompt.length / 4),
        attachmentCount: userMessage.attachments.length,
        historyTurnCount: history.length,
      },
    })
    .returning({ id: eventLogsTable.id });
  timings.persistEventLogMs = Math.round(performance.now() - _t_persistEventLog0);

  sseSend(res, "done", {
    messageId: assistantTurn!.id,
    runId,
    promptVersionId,
    eventLogId: chatEvent?.id ?? null,
    primarySkill: primarySkillSlug,
  });
  res.end();
}

/**
 * Load a conversation's messages in chronological order for `GET /chat/threads/:id/messages`.
 */
export async function loadConversationMessages(conversationId: number) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
}
