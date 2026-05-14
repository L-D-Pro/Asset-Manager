import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { adminUsersTable } from "./admin-users";

/**
 * Conversations — persistent chat threads for in-dashboard AI assistance.
 *
 * A conversation groups a sequence of `messages` exchanged between the user and
 * the AI assistant. Conversations are owned by an admin_users row; deleting a
 * conversation cascades to its messages.
 *
 * `modelScope` ties a thread to a row in `ai_model_configs.task_scope`, so the
 * model (and prompt skills) used by a thread can be configured / rotated without
 * touching the chat code.
 */
export const conversations = pgTable(
  "conversations",
  {
    /** Auto-incrementing primary key. */
    id: serial("id").primaryKey(),

    /** Owning user. Cascade-deletes when the user is deleted. */
    userId: integer("user_id")
      .notNull()
      .references(() => adminUsersTable.id, { onDelete: "cascade" }),

    /** Human-readable title (e.g. auto-generated from first user message). */
    title: text("title").notNull().default("New chat"),

    /**
     * Maps to `ai_model_configs.task_scope`. Defaults to `'chat'` for general
     * chat threads; future surfaces could pin other scopes.
     */
    modelScope: text("model_scope").notNull().default("chat"),

    /** Soft-archive timestamp. Null = active. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("conversations_user_idx").on(table.userId, table.archivedAt, table.updatedAt),
  ],
);

/** Zod schema for inserting a conversation (omits server-managed fields). */
export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/** Type for a full conversation row as returned from the database. */
export type Conversation = typeof conversations.$inferSelect;

/** Type for a new conversation insert payload. */
export type InsertConversation = z.infer<typeof insertConversationSchema>;
