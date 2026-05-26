import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Singleton config row for the Chat Control Plane.
 *
 * Holds the live state of every chat "lever": the editable identity block,
 * the master kill switches, the skill-routing mode, and all tunable routing
 * weights. Exactly one row is expected — seeded on first startup, read on
 * every chat turn.
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
   * Hard cap on selected skills (unless `debug_all`). Default 1.
   * Code enforces an absolute ceiling of HARD_MAX_SKILLS_CEILING (2) regardless.
   */
  maxSelectedSkills: integer("max_selected_skills").notNull().default(1),
  // ── Tunable routing weights ──────────────────────────────────────────────
  /**
   * Minimum deterministic score for a skill to be considered a match.
   * Skills scoring below this are not selected without LLM fallback.
   * Default 0.3. Range [0.0, 1.0].
   */
  autoThreshold: real("auto_threshold").notNull().default(0.3),
  /**
   * Score added per matching trigger example.
   * Default 0.3. Range [0.0, 2.0].
   */
  triggerWeight: real("trigger_weight").notNull().default(0.3),
  /**
   * Score subtracted per matching negative trigger.
   * Default 0.5. Range [0.0, 2.0].
   */
  negativeTriggerWeight: real("negative_trigger_weight").notNull().default(0.5),
  /**
   * Candidates within this score gap of the top are "tied" → LLM disambiguates.
   * Default 0.15. Range [0.0, 0.5].
   */
  ambiguousGap: real("ambiguous_gap").notNull().default(0.15),
  /**
   * Minimum LLM confidence score to accept a skill selection.
   * LLM results below this threshold are treated as no-selection (fail closed).
   * Default 0.5. Range [0.0, 1.0].
   */
  llmConfidenceThreshold: real("llm_confidence_threshold").notNull().default(0.5),
  /**
   * Score boost applied to skills whose slug contains "cover" when a cover
   * signal is detected in the message or attachments.
   * Default 0.3. Range [0.0, 2.0].
   */
  coverBoost: real("cover_boost").notNull().default(0.3),
  /**
   * Score boost for slugs containing "tailor" or "tailored-resume" when
   * both base_resume and job attachments are present.
   * Default 0.4. Range [0.0, 2.0].
   */
  boostTailorPlusJob: real("boost_tailor_plus_job").notNull().default(0.4),
  /**
   * Score boost for slugs containing "resume" when base_resume + job attached.
   * Default 0.2. Range [0.0, 2.0].
   */
  boostResumePlusJob: real("boost_resume_plus_job").notNull().default(0.2),
  /**
   * Score boost for slugs containing "audit" when tailored_resume + job attached.
   * Default 0.4. Range [0.0, 2.0].
   */
  boostAuditTailoredJob: real("boost_audit_tailored_job").notNull().default(0.4),
  /**
   * Score boost for slugs containing "audit" when tailored_resume attached (no job).
   * Default 0.2. Range [0.0, 2.0].
   */
  boostAuditTailoredOnly: real("boost_audit_tailored_only").notNull().default(0.2),
  /**
   * Maximum conversation history turns fed to the model per turn.
   * Default 20. Range [1, 100].
   */
  historyTurnLimit: integer("history_turn_limit").notNull().default(20),
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
