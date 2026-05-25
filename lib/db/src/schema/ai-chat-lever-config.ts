import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Singleton config row for the Chat Control Plane.
 *
 * Holds the live state of every chat "lever": the editable identity block,
 * the master kill switches, and the skill-routing mode. Exactly one row is
 * expected — seeded on first startup, read on every chat turn.
 */
export const aiChatLeverConfigTable = pgTable("ai_chat_lever_config", {
  id: serial("id").primaryKey(),
  /** Editable identity/wrapper block — replaces the hardcoded IDENTITY_BLOCK. */
  identityText: text("identity_text").notNull(),
  /** Master kill switch for all chat skills. */
  skillsEnabled: boolean("skills_enabled").notNull().default(true),
  /** Master kill switch for the best-practices block in chat. */
  bestPracticesEnabled: boolean("best_practices_enabled")
    .notNull()
    .default(true),
  /**
   * `"all"` — load every active chat skill (legacy).
   * `"classified"` — load only the intent-classifier's matched skill (legacy).
   * `"none"` — never inject a skill body (catalog still shown).
   * `"auto"` — deterministic-first; LLM only for ambiguous cases; no fallback-to-all.
   * `"explicit"` — inject exactly the skill(s) the user picked in the composer.
   * `"debug_all"` — inject every active skill body (bypasses cap + budget).
   */
  skillRoutingMode: text("skill_routing_mode").notNull().default("auto"),
  /**
   * Max tokens of injected skill bodies in `auto`/`explicit` modes.
   * Default 1500. Ignored in `debug_all`.
   */
  skillTokenBudget: integer("skill_token_budget").notNull().default(1500),
  /**
   * Hard cap on selected skills (unless `debug_all`). Default 1, max enforced is 2.
   */
  maxSelectedSkills: integer("max_selected_skills").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAiChatLeverConfigSchema = createInsertSchema(
  aiChatLeverConfigTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export const updateAiChatLeverConfigSchema =
  insertAiChatLeverConfigSchema.partial();

export type InsertAiChatLeverConfig = z.infer<
  typeof insertAiChatLeverConfigSchema
>;
export type UpdateAiChatLeverConfig = z.infer<
  typeof updateAiChatLeverConfigSchema
>;
export type AiChatLeverConfig = typeof aiChatLeverConfigTable.$inferSelect;

/**
 * Routing modes for the skill routing refactor.
 * - `"none"` — never inject a skill body (catalog still shown).
 * - `"auto"` — deterministic-first; LLM only for ambiguous cases; no fallback-to-all.
 * - `"explicit"` — inject exactly the skill(s) the user picked in the composer.
 * - `"debug_all"` — inject every active skill body (bypasses cap + budget).
 */
export type ChatSkillRoutingMode = "none" | "auto" | "explicit" | "debug_all";
