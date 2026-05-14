import type { Response } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  db,
  conversations,
  messages,
  eventLogsTable,
  type MessageAttachment,
} from "@workspace/db";
import { openrouter } from "@workspace/integrations-openrouter-ai";

import { logger } from "../logger";
import { mintRunId } from "../lineage";
import { selectModelForTask } from "../model-router";
import { classifyIntent, resolvePrimarySkill } from "./intent-classifier";
import { loadSkills } from "./skill-loader";
import { buildSystemPrompt } from "./system-prompt";
import { resolveChatPromptVersionId } from "./prompt-versions";

const HISTORY_TURN_LIMIT = 20;

export interface StreamChatCompletionOptions {
  conversationId: number;
  userId: number;
  userMessage: { content: string; attachments: MessageAttachment[] };
  res: Response;
  /** Allows tests to inject a fake OpenRouter client. */
  client?: { chat: { completions: { create: typeof openrouter.chat.completions.create } } };
  /** Allows tests to provide a stable runId / clock. */
  runIdOverride?: string;
}

function sseSend(res: Response, event: string | null, data: unknown): void {
  if (event) res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
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

  // ── Ownership check ─────────────────────────────────────────────────────
  const [thread] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);

  if (!thread) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  // ── Persist the user turn ───────────────────────────────────────────────
  const [userTurn] = await db
    .insert(messages)
    .values({
      conversationId,
      role: "user",
      content: userMessage.content,
      attachments: userMessage.attachments,
    })
    .returning();

  // ── Resolve model for `chat` task scope ─────────────────────────────────
  const model = await selectModelForTask(thread.modelScope);
  if (!model) {
    res.status(503).json({
      error: `No active AI model configured for task scope '${thread.modelScope}'. Seed one via the AI Config page or run the chat seed script.`,
    });
    return;
  }

  // ── Build system prompt + history ───────────────────────────────────────
  const loadedSkills = loadSkills();
  const primarySkillSlug = classifyIntent(userMessage.content);
  const primarySkill = resolvePrimarySkill(loadedSkills, primarySkillSlug);
  const promptVersionId = await resolveChatPromptVersionId(primarySkill.slug);

  const systemPrompt = buildSystemPrompt({
    attachments: userMessage.attachments,
    skills: loadedSkills,
  });

  const historyRows = await db
    .select({
      role: messages.role,
      content: messages.content,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(HISTORY_TURN_LIMIT);

  const history = historyRows
    .reverse()
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const runId = opts.runIdOverride ?? mintRunId();

  // ── SSE headers ─────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  sseSend(res, "user-message", { id: userTurn!.id, role: "user" });

  // ── Stream the assistant turn ───────────────────────────────────────────
  let assistantText = "";
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let finishReason: string | null = null;

  try {
    const response = await client.chat.completions.create({
      model: model.modelName,
      stream: true,
      max_tokens: model.maxTokens ?? 4096,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
      ],
    } as never);

    for await (const chunk of response as unknown as AsyncIterable<unknown>) {
      const delta = extractDeltaText(chunk);
      if (delta.length > 0) {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, runId, conversationId }, "Chat stream failed");
    sseSend(res, "error", { message });

    await db.insert(eventLogsTable).values({
      entityType: "ai_call",
      entityId: userTurn!.id,
      runId,
      eventType: "ai_call_failed",
      actorType: "system",
      metadata: {
        taskType: thread.modelScope,
        taskScope: thread.modelScope,
        promptVersionId,
        modelName: model.modelName,
        provider: model.provider,
        primarySkill: primarySkill.slug,
        chatMessageEntityType: "chat_message",
        finalError: message,
        succeeded: false,
        runId,
      },
    });
    res.end();
    return;
  }

  // ── Persist assistant turn + canonical lineage event ────────────────────
  const [assistantTurn] = await db
    .insert(messages)
    .values({
      conversationId,
      role: "assistant",
      content: assistantText,
      attachments: [],
      runId,
      promptVersionId,
      modelName: model.modelName,
      promptTokens: promptTokens ?? null,
      completionTokens: completionTokens ?? null,
    })
    .returning();

  // Refresh conversation updatedAt for thread ordering.
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  const costIn = model.costPerInputToken && promptTokens != null
    ? parseFloat(model.costPerInputToken) * promptTokens
    : null;
  const costOut = model.costPerOutputToken && completionTokens != null
    ? parseFloat(model.costPerOutputToken) * completionTokens
    : null;
  const estimatedCostUsd = costIn != null && costOut != null ? costIn + costOut : null;

  const [chatEvent] = await db
    .insert(eventLogsTable)
    .values({
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
        modelName: model.modelName,
        provider: model.provider,
        modelConfigId: model.id,
        primarySkill: primarySkill.slug,
        chatMessageEntityType: "chat_message",
        chatMessageId: assistantTurn!.id,
        promptTokens: promptTokens ?? null,
        completionTokens: completionTokens ?? null,
        estimatedCostUsd,
        finishReason,
        succeeded: true,
        contentLength: assistantText.length,
        runId,
      },
    })
    .returning({ id: eventLogsTable.id });

  sseSend(res, "done", {
    messageId: assistantTurn!.id,
    runId,
    promptVersionId,
    eventLogId: chatEvent?.id ?? null,
    primarySkill: primarySkill.slug,
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
