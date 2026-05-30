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
import { callAI, parseJsonResponse } from "../ai-client";
import { getCachedPromptBundle } from "./chat-prompt-cache";
import { logger } from "../logger";

type RoutingMode = "none" | "auto" | "explicit" | "debug_all";

/** Narrow an arbitrary stored mode string to a valid mode (mapping legacy values). */
function asMode(raw: string): RoutingMode {
  if (raw === "all") return "debug_all";
  if (raw === "classified") return "auto";
  if (raw === "none" || raw === "auto" || raw === "explicit" || raw === "debug_all") return raw;
  return "auto";
}

/**
 * Guard against debug_all in production.
 * Returns the mode unchanged unless NODE_ENV is "production" and mode is "debug_all",
 * in which case downgrades to "auto" and logs a warning.
 */
function guardDebugMode(mode: RoutingMode): RoutingMode {
  if (mode === "debug_all" && process.env.NODE_ENV === "production") {
    // Import logger is already at top of file
    logger.warn(
      "debug_all routing mode is not allowed in production — downgrading to auto. " +
      "This mode injects all skill bodies and bypasses budget controls. Use only in development.",
    );
    return "auto";
  }
  return mode;
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

      // Fail closed on invalid confidence — do not invent a default.
      const rawConfidence = parsed.confidence;
      if (
        typeof rawConfidence !== "number" ||
        !isFinite(rawConfidence) ||
        rawConfidence < 0 ||
        rawConfidence > 1
      ) {
        logger.warn({ taskType, rawConfidence }, "skill-router: LLM returned invalid confidence — failing closed");
        return null;
      }
      const score = rawConfidence;

      const slugs = (parsed.selectedSkillSlugs ?? []).filter((s) => validSlugs.has(s));
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
  /** Maximum history turns to feed to the model — from DB lever config. */
  historyTurnLimit: number;
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

  // Load the prompt bundle from the version-aware cache (3 parallel DB reads,
  // skipped on cache hit). Any Control Plane edit changes the version key and
  // causes a cache miss — so the VERY NEXT turn sees the latest config.
  const bundle = await getCachedPromptBundle();
  const config = bundle.config;
  const allSkillsRaw = bundle.allSkills;

  const identityText = o.identityText ?? config.identityText;
  const skillsEnabled = o.skillsEnabled ?? config.skillsEnabled;
  const bestPracticesEnabled = o.bestPracticesEnabled ?? config.bestPracticesEnabled;
  const mode: RoutingMode = skillsEnabled
    ? guardDebugMode(asMode(o.skillRoutingMode ?? config.skillRoutingMode))
    : "none";
  const tokenBudget = o.skillTokenBudget ?? config.skillTokenBudget;
  const maxSkills = o.maxSelectedSkills ?? config.maxSelectedSkills;

  const routingConfig = bundle.routingConfig;

  const allSkills = skillsEnabled ? allSkillsRaw : [];

  const decision = await routeSkills({
    userMessage: params.userMessage,
    attachmentKinds: params.attachments.map((a) => a.kind),
    skills: allSkills,
    mode,
    explicitSlugs: params.explicitSlugs,
    tokenBudget,
    maxSkills,
    routingConfig,
    classify: (catalog, message) => classifyWithLLM(catalog, message, params.userId),
  });

  const selectedSkills: PromptSkill[] = allSkills
    .filter((s) => decision.selectedSlugs.includes(s.slug))
    .map((s) => ({ slug: s.slug, body: s.body }));

  // Catalog is NOT included in the final generation prompt — the router sees
  // skill metadata internally but the main model only sees selected skill bodies.
  // An empty catalog array causes buildSystemPromptSections to skip that section.
  const catalog: CatalogEntry[] = [];

  const bestPracticesText = bestPracticesEnabled ? bundle.bestPracticesText : "";

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
    historyTurnLimit: config.historyTurnLimit,
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
