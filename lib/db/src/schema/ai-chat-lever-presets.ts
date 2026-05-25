import {
  pgTable,
  text,
  serial,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Shape of a captured lever-state snapshot stored in `ai_chat_lever_presets`.
 * Applying a preset writes these fields back into `ai_chat_lever_config` and
 * flips `ai_prompt_versions.isActive` to match `activePromptVersionIds`.
 */
export interface ChatLeverSnapshot {
  identityText: string;
  skillsEnabled: boolean;
  bestPracticesEnabled: boolean;
  skillRoutingMode: string;
  /**
   * Max tokens of injected skill bodies in `auto`/`explicit` modes.
   */
  skillTokenBudget: number;
  /**
   * Hard cap on selected skills (unless `debug_all`). Default 1, max enforced is 2.
   */
  maxSelectedSkills: number;
  /** Prompt-version row ids that should be active when this preset applies. */
  activePromptVersionIds: number[];
}

/**
 * Named lever-state snapshots for the Chat Control Plane — lets the developer
 * save a combination of levers (e.g. "All On", "Skills Only") and switch
 * between them with one click for A/B/C comparison.
 */
export const aiChatLeverPresetsTable = pgTable("ai_chat_lever_presets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  snapshot: jsonb("snapshot").notNull().$type<ChatLeverSnapshot>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAiChatLeverPresetSchema = createInsertSchema(
  aiChatLeverPresetsTable,
).omit({ id: true, createdAt: true });

export type InsertAiChatLeverPreset = z.infer<
  typeof insertAiChatLeverPresetSchema
>;
export type AiChatLeverPreset = typeof aiChatLeverPresetsTable.$inferSelect;
