import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { conversations } from "./conversations";
import { aiPromptVersionsTable } from "./ai-prompt-versions";

/**
 * Attachment snapshot kinds.
 *
 * Snapshots are captured into a user message at send time so re-running an old
 * thread sees the same context the assistant originally saw.
 */
export const messageAttachmentKinds = ["base_resume", "job", "claims"] as const;
export type MessageAttachmentKind = (typeof messageAttachmentKinds)[number];

/**
 * The discriminated shape of an entry in `messages.attachments`. Stored as
 * jsonb; the snapshot key holds the captured content (markdown, JD text, the
 * verified-status of selected claims, etc.).
 */
export interface MessageAttachment {
  kind: MessageAttachmentKind;
  /** Originating row id in the source table, when applicable. */
  refId?: number;
  /** Frozen snapshot at send time. Shape depends on `kind`. */
  snapshot: Record<string, unknown>;
}

/**
 * Messages — individual turns within a conversation.
 *
 * For `role='assistant'` rows produced through the chat runtime, the AI lineage
 * fields (`runId`, `promptVersionId`, `modelName`, `promptTokens`,
 * `completionTokens`) are populated so the existing learning loop can score the
 * turn through `event_logs` + `ai_run_evaluations`.
 *
 * For `role='user'` rows, `attachments` may hold snapshots of context the user
 * explicitly attached (base resume, job, claims selection).
 */
export const messages = pgTable(
  "messages",
  {
    /** Auto-incrementing primary key. */
    id: serial("id").primaryKey(),

    /** Parent conversation. Cascade-deletes with the conversation. */
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),

    /**
     * Sender role. Follows OpenAI message role convention.
     * Values: `"user"`, `"assistant"`, `"system"`, `"tool"`.
     */
    role: text("role").notNull(),

    /** Text content of the message. */
    content: text("content").notNull(),

    /** Array of attachment snapshots captured at send time. See `MessageAttachment`. */
    attachments: jsonb("attachments")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<MessageAttachment[]>(),

    /** Canonical AI lineage id — matches `event_logs.runId` for assistant turns. */
    runId: text("run_id"),

    /** Primary skill attributed to this turn (for variant stats). */
    promptVersionId: integer("prompt_version_id").references(
      () => aiPromptVersionsTable.id,
      { onDelete: "set null" },
    ),

    /** OpenRouter model that produced an assistant turn. */
    modelName: text("model_name"),

    /** Input tokens consumed by the call that produced this turn. */
    promptTokens: integer("prompt_tokens"),

    /** Output tokens consumed by the call that produced this turn. */
    completionTokens: integer("completion_tokens"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("messages_conversation_idx").on(table.conversationId, table.createdAt),
    index("messages_run_id_idx").on(table.runId),
  ],
);

/** Zod schema for inserting a message (omits server-managed fields). */
export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

/** Type for a full message row as returned from the database. */
export type Message = typeof messages.$inferSelect;

/** Type for a new message insert payload. */
export type InsertMessage = z.infer<typeof insertMessageSchema>;
