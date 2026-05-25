import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { conversations } from "./conversations";

/**
 * Chat routing decisions — observability store for every skill-route evaluation.
 *
 * One row per chat turn capturing:
 * - The lineage key (`runId`) so a decision joins to `event_logs` /
 *   `ai_run_evaluations` / `feedback_signals` exactly like every other AI call.
 * - The input that was evaluated (conversation_id, message_id or null).
 * - Which skills were considered and which were selected.
 * - Why the router chose them (deterministic vs LLM classifier vs manual).
 * - Token budget impact so we can audit progressive-disclosure behaviour.
 */
export const chatRoutingDecisionsTable = pgTable(
  "chat_routing_decisions",
  {
    id: serial("id").primaryKey(),
    /** Canonical AI-lineage key — joins to event_logs.run_id. */
    runId: text("run_id"),
    /** Foreign key to conversations.id. */
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    /** Associated assistant message id (null until the message row exists). */
    messageId: integer("message_id"),
    /** Active routing mode (`none` | `auto` | `explicit` | `debug_all`). */
    routingMode: text("routing_mode").notNull(),
    /** Candidate skills with deterministic scores — `[{ slug, score }]`. */
    candidates: jsonb("candidates").notNull().default(sql`'[]'`),
    /** Selected skill slugs (up to maxSelectedSkills). */
    selectedSkills: text("selected_skills").array().notNull().default(sql`'{}'`),
    /** Classifier that produced the decision — `deterministic` | `llm` | `manual` | `none`. */
    classifierType: text("classifier_type").notNull(),
    /** Router confidence (0–1). */
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    /** Whether the LLM classifier leg ran. */
    llmUsed: boolean("llm_used").notNull().default(false),
    /** Human-readable rationale for the routing choice. */
    rationale: text("rationale"),
    /** Estimated tokens consumed by injected skill bodies this turn. */
    skillPromptTokens: integer("skill_prompt_tokens").notNull().default(0),
    /** True when token-budget trimming dropped or compressed a skill. */
    budgetTrimmed: boolean("budget_trimmed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chat_routing_decisions_run_idx").on(table.runId),
    index("chat_routing_decisions_conversation_idx").on(table.conversationId),
    index("chat_routing_decisions_created_idx").on(table.createdAt),
  ],
);

export const insertChatRoutingDecisionSchema = createInsertSchema(
  chatRoutingDecisionsTable,
).omit({
  id: true,
  createdAt: true,
});

export type InsertChatRoutingDecision = z.infer<
  typeof insertChatRoutingDecisionSchema
>;
export type ChatRoutingDecision = typeof chatRoutingDecisionsTable.$inferSelect;
