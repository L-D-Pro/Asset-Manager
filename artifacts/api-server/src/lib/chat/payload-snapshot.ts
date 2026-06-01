import { and, desc, eq } from "drizzle-orm";
import { db, eventLogsTable, messages } from "@workspace/db";

import type {
  FinalChatPayloadInspect,
  FinalChatPayloadProviderRequest,
} from "./final-payload-builder";

export const PREVIEW_REBUILD_WARNING =
  "No stored send-time payload snapshot found; this is a rebuilt preview and may differ from the actual model request.";

function dedupeWarnings(warnings: string[]): string[] {
  return [...new Set(warnings)];
}

export function asPreviewRebuild(
  payload: FinalChatPayloadInspect,
  warning?: string,
): FinalChatPayloadInspect {
  return {
    ...payload,
    payloadSource: "preview_rebuild",
    isExactModelPayload: false,
    providerRequest: null,
    createdAt: payload.createdAt ?? new Date().toISOString(),
    metadata: {
      ...payload.metadata,
      warnings: dedupeWarnings([
        ...payload.metadata.warnings,
        ...(warning ? [warning] : []),
      ]),
    },
  };
}

export function asSentSnapshot(args: {
  payload: FinalChatPayloadInspect;
  providerRequest: FinalChatPayloadProviderRequest;
  createdAt?: string;
}): FinalChatPayloadInspect {
  return {
    ...args.payload,
    payloadSource: "sent_snapshot",
    isExactModelPayload: true,
    providerRequest: args.providerRequest,
    createdAt: args.createdAt ?? new Date().toISOString(),
  };
}

function isMessageRole(value: unknown): value is "system" | "user" | "assistant" {
  return value === "system" || value === "user" || value === "assistant";
}

function isPromptSection(value: unknown): value is { lever: string; label: string; content: string } {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.lever === "string" && typeof row.label === "string" && typeof row.content === "string";
}

function isRoutingDecision(value: unknown): value is FinalChatPayloadInspect["routingDecision"] {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    Array.isArray(row.selectedSlugs) &&
    row.selectedSlugs.every((item) => typeof item === "string") &&
    typeof row.confidence === "number" &&
    typeof row.reason === "string" &&
    Array.isArray(row.candidates) &&
    typeof row.llmUsed === "boolean" &&
    typeof row.budgetTrimmed === "boolean" &&
    typeof row.skillPromptTokens === "number"
  );
}

function isProviderRequest(value: unknown): value is FinalChatPayloadProviderRequest | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.provider === "openrouter" &&
    typeof row.model === "string" &&
    (row.maxTokens === undefined || typeof row.maxTokens === "number") &&
    (row.temperature === undefined || typeof row.temperature === "number") &&
    (row.stream === undefined || typeof row.stream === "boolean")
  );
}

function isFinalChatPayloadInspect(value: unknown): value is FinalChatPayloadInspect {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const metadata = row.metadata as Record<string, unknown> | undefined;
  return (
    (row.payloadSource === "sent_snapshot" || row.payloadSource === "preview_rebuild") &&
    typeof row.isExactModelPayload === "boolean" &&
    Array.isArray(row.messages) &&
    row.messages.every((item) => {
      if (!item || typeof item !== "object") return false;
      const msg = item as Record<string, unknown>;
      return isMessageRole(msg.role) && typeof msg.content === "string";
    }) &&
    typeof row.systemPrompt === "string" &&
    Array.isArray(row.sections) &&
    row.sections.every(isPromptSection) &&
    (row.parsedJdBlock === null || typeof row.parsedJdBlock === "string") &&
    isRoutingDecision(row.routingDecision) &&
    typeof row.routingMode === "string" &&
    isProviderRequest((row.providerRequest as unknown) ?? null) &&
    typeof row.createdAt === "string" &&
    Boolean(metadata) &&
    typeof metadata?.selectedSkillCount === "number" &&
    typeof metadata?.historyMessageCount === "number" &&
    typeof metadata?.fullSkillCatalogPresent === "boolean" &&
    typeof metadata?.parsedJdPresent === "boolean" &&
    typeof metadata?.parsedJdSectioned === "boolean" &&
    typeof metadata?.bestPracticesEnabled === "boolean" &&
    (metadata?.finalMessageRole === null || isMessageRole(metadata?.finalMessageRole)) &&
    typeof metadata?.finalMessageIsUser === "boolean" &&
    (metadata?.currentUserMessageIndex === null || typeof metadata?.currentUserMessageIndex === "number") &&
    typeof metadata?.historyIsChronological === "boolean" &&
    Array.isArray(metadata?.warnings) &&
    metadata.warnings.every((item: unknown) => typeof item === "string")
  );
}

function coerceStoredSnapshot(raw: unknown): FinalChatPayloadInspect | null {
  return isFinalChatPayloadInspect(raw) ? raw : null;
}

export async function loadStoredPayloadSnapshotForAssistant(args: {
  userId: number;
  assistantMessageId?: number | null;
  conversationId?: number | null;
}): Promise<FinalChatPayloadInspect | null> {
  let assistantMessageId = args.assistantMessageId ?? null;

  if (assistantMessageId == null && args.conversationId != null) {
    const [latestAssistant] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.conversationId, args.conversationId), eq(messages.role, "assistant")))
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(1);
    assistantMessageId = latestAssistant?.id ?? null;
  }

  if (assistantMessageId == null) return null;

  const [messageRow] = await db
    .select({ id: messages.id, runId: messages.runId, conversationId: messages.conversationId })
    .from(messages)
    .where(eq(messages.id, assistantMessageId))
    .limit(1);

  if (args.conversationId != null && messageRow?.conversationId !== args.conversationId) {
    return null;
  }
  if (!messageRow?.runId) return null;

  const [eventLog] = await db
    .select({ metadata: eventLogsTable.metadata })
    .from(eventLogsTable)
    .where(
      and(
        eq(eventLogsTable.runId, messageRow.runId),
        eq(eventLogsTable.userId, args.userId),
        eq(eventLogsTable.entityType, "ai_call"),
        eq(eventLogsTable.entityId, messageRow.id),
        eq(eventLogsTable.eventType, "ai_call"),
      ),
    )
    .orderBy(desc(eventLogsTable.createdAt), desc(eventLogsTable.id))
    .limit(1);

  return coerceStoredSnapshot((eventLog?.metadata as Record<string, unknown> | undefined)?.finalPayloadSnapshot);
}
