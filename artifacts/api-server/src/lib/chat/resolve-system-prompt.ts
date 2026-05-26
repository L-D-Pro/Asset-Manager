import { and, asc, eq } from "drizzle-orm";
import {
  db,
  aiChatLeverConfigTable,
  aiPromptVersionsTable,
  type AiChatLeverConfig,
  type ChatSkillMetadata,
  type MessageAttachment,
} from "@workspace/db";

import {
  IDENTITY_BLOCK,
  buildSystemPrompt,
  buildSystemPromptSections,
  type CatalogEntry,
  type LeverConfigInput,
  type PromptSection,
  type PromptSkill,
  type SystemPromptInputs,
} from "./system-prompt";
import {
  routeSkills,
  type RouterSkill,
  type RoutingDecision,
} from "./skill-router";
import {
  loadOrCreateBestPractices,
  formatBestPracticesForPrompt,
} from "../best-practices";
import { callAI, parseJsonResponse } from "../ai-client";
import { logger } from "../logger";

type RoutingMode = "none" | "auto" | "explicit" | "debug_all";

/** Narrow an arbitrary stored mode string to a valid mode (mapping legacy values). */
function asMode(raw: string): RoutingMode {
  if (raw === "all") return "debug_all";
  if (raw === "classified") return "auto";
  if (raw === "none" || raw === "auto" || raw === "explicit" || raw === "debug_all") return raw;
  return "auto";
}

/** Coerce the `metadata` JSONB column into a complete ChatSkillMetadata. */
function coerceMeta(raw: unknown): ChatSkillMetadata {
  const m = (raw ?? {}) as Partial<ChatSkillMetadata>;
  return {
    routerDescription: typeof m.routerDescription === "string" ? m.routerDescription : "",
    triggerExamples: Array.isArray(m.triggerExamples) ? m.triggerExamples : [],
    negativeTriggers: Array.isArray(m.negativeTriggers) ? m.negativeTriggers : [],
    taskTypes: Array.isArray(m.taskTypes) ? m.taskTypes : ["chat"],
    priority: typeof m.priority === "number" ? m.priority : 50,
    status: m.status === "draft" || m.status === "deprecated" ? m.status : "active",
  };
}

/**
 * Fetch the singleton Chat Control Plane config, creating the default row on
 * first call. Exactly one row of `ai_chat_lever_config` is expected.
 */
export async function getChatLeverConfig(): Promise<AiChatLeverConfig> {
  const [row] = await db.select().from(aiChatLeverConfigTable).limit(1);
  if (row) return row;
  const [created] = await db
    .insert(aiChatLeverConfigTable)
    .values({ identityText: IDENTITY_BLOCK })
    .returning();
  return created!;
}

/** Active chat skill rows, with router metadata, excluding deprecated skills. */
export async function loadActiveChatSkills(): Promise<Array<RouterSkill & { name: string }>> {
  const rows = await db
    .select()
    .from(aiPromptVersionsTable)
    .where(
      and(
        eq(aiPromptVersionsTable.taskScope, "chat"),
        eq(aiPromptVersionsTable.isActive, true),
      ),
    )
    .orderBy(asc(aiPromptVersionsTable.id));

  return rows
    .map((r) => ({
      slug: r.label,
      body: r.systemPrompt,
      name: r.roleLabel ?? r.label,
      meta: coerceMeta(r.metadata),
    }))
    .filter((s) => s.meta.status !== "deprecated");
}

const ROUTER_SYSTEM_PROMPT = `You are a skill router for a job-application assistant. Given the user's message and the available skills, decide which skill(s) — if any — should handle it.
Return ONLY valid JSON with this exact shape:
{ "selectedSkillSlugs": ["string"], "confidence": 0.0, "reason": "string" }
Rules:
- Select AT MOST 2 skills, ideally 1.
- Return an empty array if no skill clearly applies — do NOT guess.
- Never select skills that conflict (e.g. a resume skill and a cover-letter skill) unless the message explicitly asks for both.`;

interface RouterLlmResponse {
  selectedSkillSlugs: string[];
  confidence: number;
  reason: string;
}

/**
 * Production LLM classifier — resolves ambiguous routes via a cheap model.
 * Mirrors `jd-parse-preprocess`: tries the `skill_routing` task scope, falls
 * back to `chat`, and returns null on any failure (router then uses rules).
 */
async function classifyWithLLM(
  catalog: RouterSkill[],
  message: string,
  userId?: number,
): Promise<Array<{ slug: string; score: number }> | null> {
  const catalogText = catalog
    .map((s) => `- ${s.slug}: ${s.meta.routerDescription} (triggers: ${s.meta.triggerExamples.join(", ") || "—"})`)
    .join("\n");
  const userPrompt = `User message:\n${message}\n\nAvailable skills:\n${catalogText}`;
  const validSlugs = new Set(catalog.map((s) => s.slug));

  for (const taskType of ["skill_routing", "chat"]) {
    try {
      const result = await callAI({ taskType, userId, systemPrompt: ROUTER_SYSTEM_PROMPT, userPrompt });
      const parsed = parseJsonResponse<RouterLlmResponse>(result.content);
      if (!parsed) return null;
      const slugs = (parsed.selectedSkillSlugs ?? []).filter((s) => validSlugs.has(s));
      const score = typeof parsed.confidence === "number" ? parsed.confidence : 0.6;
      return slugs.map((slug) => ({ slug, score }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/no active ai model configured/i.test(msg) && taskType === "skill_routing") {
        logger.info("skill-router: no skill_routing model configured, retrying with chat scope");
        continue;
      }
      logger.warn({ err, taskType }, "skill-router: LLM classify failed, falling back to deterministic");
      return null;
    }
  }
  return null;
}

export interface ResolveChatPromptParams {
  /** The user's message text — drives routing. */
  userMessage: string;
  attachments: MessageAttachment[];
  /** Skills the user explicitly picked in the composer (explicit mode). */
  explicitSlugs?: string[];
  /** Owning user for any classifier AI call and its audit record. */
  userId?: number;
  /** Optional lever overrides — used by the inspector simulator. */
  overrides?: Partial<LeverConfigInput> & {
    skillTokenBudget?: number;
    maxSelectedSkills?: number;
  };
}

export interface ResolvedChatPrompt {
  systemPrompt: string;
  sections: PromptSection[];
  decision: RoutingDecision;
  /** The routing mode actually applied (after override + skillsEnabled gating). */
  mode: RoutingMode;
}

/**
 * Read every lever, route skills (deterministic + LLM), and assemble the chat
 * system prompt. Returns the joined string (for the model), the labeled
 * sections (for the inspector), and the routing decision (for SSE + logging).
 */
export async function resolveChatPrompt(
  params: ResolveChatPromptParams,
): Promise<ResolvedChatPrompt> {
  const o = params.overrides ?? {};

  // These three reads are independent — fetch them concurrently. Skills are
  // always loaded (cheap query) and gated below, so this stays a single round.
  const [config, allSkillsRaw, bestPractices] = await Promise.all([
    getChatLeverConfig(),
    loadActiveChatSkills(),
    loadOrCreateBestPractices(),
  ]);

  const identityText = o.identityText ?? config.identityText;
  const skillsEnabled = o.skillsEnabled ?? config.skillsEnabled;
  const bestPracticesEnabled = o.bestPracticesEnabled ?? config.bestPracticesEnabled;
  const mode: RoutingMode = skillsEnabled
    ? asMode(o.skillRoutingMode ?? config.skillRoutingMode)
    : "none";
  const tokenBudget = o.skillTokenBudget ?? config.skillTokenBudget;
  const maxSkills = o.maxSelectedSkills ?? config.maxSelectedSkills;

  const allSkills = skillsEnabled ? allSkillsRaw : [];

  const decision = await routeSkills({
    userMessage: params.userMessage,
    attachmentKinds: params.attachments.map((a) => a.kind),
    skills: allSkills,
    mode,
    explicitSlugs: params.explicitSlugs,
    tokenBudget,
    maxSkills,
    classify: (catalog, message) => classifyWithLLM(catalog, message, params.userId),
  });

  const selectedSkills: PromptSkill[] = allSkills
    .filter((s) => decision.selectedSlugs.includes(s.slug))
    .map((s) => ({ slug: s.slug, body: s.body }));

  // Catalog is shown whenever skills are enabled, except in debug_all (where
  // every full body is already injected so the catalog would be redundant).
  const catalog: CatalogEntry[] =
    skillsEnabled && mode !== "debug_all"
      ? allSkills.map((s) => ({ slug: s.slug, name: s.name, description: s.meta.routerDescription }))
      : [];

  const bestPracticesText = bestPracticesEnabled
    ? formatBestPracticesForPrompt(bestPractices)
    : "";

  const inputs: SystemPromptInputs = {
    identityText,
    catalog,
    skills: selectedSkills,
    bestPracticesText,
    attachments: params.attachments,
  };

  return {
    systemPrompt: buildSystemPrompt(inputs),
    sections: buildSystemPromptSections(inputs),
    decision,
    mode,
  };
}

/** Resolve the chat system prompt as a single string (sent to the model). */
export async function resolveChatSystemPrompt(
  params: ResolveChatPromptParams,
): Promise<string> {
  return (await resolveChatPrompt(params)).systemPrompt;
}

/** Resolve the chat system prompt as labeled sections (used by the inspector). */
export async function resolveChatSystemPromptSections(
  params: ResolveChatPromptParams,
): Promise<PromptSection[]> {
  return (await resolveChatPrompt(params)).sections;
}
