import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Conversations — persistent chat threads for in-app AI assistance.
 *
 * A conversation groups a sequence of `messages` exchanged between the user
 * and the AI assistant. Conversations are cascade-deleted when their messages
 * are deleted; conversely, deleting a conversation cascades to its messages.
 *
 * Intended for future in-dashboard AI chat features (e.g. "Explain why this
 * claim matches this job", "Suggest a stronger phrasing for this bullet").
 */
export const conversations = pgTable("conversations", {
  /** Auto-incrementing primary key. */
  id: serial("id").primaryKey(),

  /** Human-readable title for the conversation (e.g. auto-generated from first message). */
  title: text("title").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Zod schema for inserting a conversation (omits server-managed fields). */
export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

/** Type for a full conversation row as returned from the database. */
export type Conversation = typeof conversations.$inferSelect;

/** Type for a new conversation insert payload. */
export type InsertConversation = z.infer<typeof insertConversationSchema>;
