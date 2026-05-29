/**
 * Skill router — determines which skills should be injected into the system
 * prompt for a given chat turn (progressive disclosure).
 *
 * Pipeline:
 * 1. `none` → empty selection.
 * 2. `debug_all` → all active skills, skip cap/budget.
 * 3. `explicit` → the user's picked slugs, then shared cap + budget.
 * 4. `auto`:
 *    - Deterministic scoring via `scoreSkills(message, attachmentKinds, skills, config)`.
 *    - Attachment/context boosts applied before threshold check.
 *    - One clear winner at/above autoThreshold → select it, skip LLM.
 *    - Zero deterministic matches + strong attachment context → LLM routing attempt.
 *    - Zero candidates at/above threshold → empty (no fallback-to-all).
 *    - Ambiguous (≥2 candidates within ambiguousGap) → injected `classify` (LLM).
 *    - LLM results filtered by llmConfidenceThreshold — below threshold → no/fallback.
 *    - then shared cap + budget.
 * 5. Shared tail (auto + explicit): apply `maxSkills` cap, then token budget.
 */

import type { ChatSkillMetadata } from "@workspace/db";

import { estimateTokens, totalTokens, trimToBudget } from "./token-budget";

export interface RouterSkill {
  slug: string;
  body: string;
  meta: ChatSkillMetadata;
}

export interface RoutingDecision {
  selectedSlugs: string[];
  confidence: number;
  reason: string;
  candidates: Array<{ slug: string; score: number }>;
  llmUsed: boolean;
  budgetTrimmed: boolean;
  /** Estimated tokens of the finally-selected skill bodies. */
  skillPromptTokens: number;
}

/**
 * Tunable routing config. All values are Control-Plane-configurable.
 * Use `DEFAULT_ROUTING_CONFIG` as the baseline when no DB config is available.
 */
export interface RoutingConfig {
  /** Minimum deterministic score for a skill to be considered a match. */
  autoThreshold: number;
  /** Score added per matching trigger example. */
  triggerWeight: number;
  /** Score subtracted per matching negative trigger. */
  negativeTriggerWeight: number;
  /** Candidates within this gap of the top are "tied" → LLM disambiguates. */
  ambiguousGap: number;
  /** Minimum LLM confidence score to accept a selection. Below this → fail closed. */
  llmConfidenceThreshold: number;
  /** Score boost when cover signal detected (message text or attachment). */
  coverBoost: number;
  /** Score boost for tailor-slug skills when base_resume + job attached. */
  boostTailorPlusJob: number;
  /** Score boost for resume-slug skills when base_resume + job attached. */
  boostResumePlusJob: number;
  /** Score boost for audit-slug skills when tailored_resume + job attached. */
  boostAuditTailoredJob: number;
  /** Score boost for audit-slug skills when tailored_resume attached (no job). */
  boostAuditTailoredOnly: number;
}

/**
 * Defaults matching the hardcoded constants this replaced.
 * Used as the fallback when no DB config is resolved (e.g., in tests).
 */
export const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  autoThreshold: 0.3,
  triggerWeight: 0.3,
  negativeTriggerWeight: 0.5,
  ambiguousGap: 0.15,
  llmConfidenceThreshold: 0.5,
  coverBoost: 0.3,
  boostTailorPlusJob: 0.4,
  boostResumePlusJob: 0.2,
  boostAuditTailoredJob: 0.4,
  boostAuditTailoredOnly: 0.2,
};

/**
 * Absolute structural ceiling on injected skills (except `debug_all`).
 * Cannot be overridden via config. Exported so UI validation can reference it.
 * Schema and UI enforce `maxSelectedSkills ≤ HARD_MAX_SKILLS_CEILING`.
 */
export const HARD_MAX_SKILLS_CEILING = 2;

export interface RouteParams {
  userMessage: string;
  conversationSummary?: string;
  attachmentKinds: string[];
  skills: RouterSkill[];
  mode: "none" | "auto" | "explicit" | "debug_all";
  explicitSlugs?: string[];
  tokenBudget: number;
  maxSkills: number;
  /**
   * Tunable routing config. Defaults to DEFAULT_ROUTING_CONFIG when omitted.
   * Production code passes DB values; tests may inject custom configs.
   */
  routingConfig?: RoutingConfig;
  /** Injected for testing — prod impl calls `callAI({ taskType: "skill_routing" })`. */
  classify?: (
    catalog: RouterSkill[],
    message: string,
  ) => Promise<Array<{ slug: string; score: number }> | null>;
}

/**
 * Computes slug → extra score boosts based on attachment context.
 * Uses partial slug matching (e.g. "resume-tailoring" matches boost for "tailor").
 */
function attachmentBoosts(
  attachmentKinds: string[],
  skills: RouterSkill[],
  config: RoutingConfig,
): Map<string, number> {
  const boosts = new Map<string, number>();
  const hasBaseResume = attachmentKinds.includes("base_resume");
  const hasTailoredResume = attachmentKinds.includes("tailored_resume");
  const hasJob = attachmentKinds.includes("job");

  const addBoost = (slug: string, amount: number) => {
    boosts.set(slug, (boosts.get(slug) ?? 0) + amount);
  };

  for (const skill of skills) {
    const slug = skill.slug;

    // base_resume + job → tailor boost
    if (hasBaseResume && hasJob) {
      if (slug.includes("tailor") || slug.includes("tailored-resume")) {
        addBoost(slug, config.boostTailorPlusJob);
      }
      if (slug.includes("resume")) {
        addBoost(slug, config.boostResumePlusJob);
      }
    }

    // tailored_resume + job → audit boost
    if (hasTailoredResume && hasJob) {
      if (slug.includes("audit") || slug.includes("resume-audit")) {
        addBoost(slug, config.boostAuditTailoredJob);
      }
    }

    // tailored_resume only (no job) → smaller audit boost
    if (hasTailoredResume && !hasJob) {
      if (slug.includes("audit")) {
        addBoost(slug, config.boostAuditTailoredOnly);
      }
    }
  }

  return boosts;
}

/**
 * Deterministic scorer — metadata-driven score: +per positive trigger, −per negative trigger.
 * Also applies attachment-context boosts and cover signal boost.
 */
function scoreSkills(
  message: string,
  attachmentKinds: string[],
  skills: RouterSkill[],
  config: RoutingConfig,
): Array<{ slug: string; score: number }> {
  const text = message.toLowerCase();
  const hasCover =
    attachmentKinds.some((k) => k.toLowerCase().includes("cover")) ||
    text.includes("cover");
  const boosts = attachmentBoosts(attachmentKinds, skills, config);

  return skills.map((skill) => {
    let score = 0;
    for (const ex of skill.meta.triggerExamples ?? []) {
      if (ex && text.includes(ex.toLowerCase())) score += config.triggerWeight;
    }
    for (const neg of skill.meta.negativeTriggers ?? []) {
      if (neg && text.includes(neg.toLowerCase())) score -= config.negativeTriggerWeight;
    }
    score += boosts.get(skill.slug) ?? 0;
    if (hasCover && skill.slug.includes("cover")) {
      score += config.coverBoost;
    }
    return { slug: skill.slug, score };
  });
}

/** Apply the maxSkills cap then the token budget; compute final token count. */
function finalizeSelection(
  selectedSlugs: string[],
  skills: RouterSkill[],
  maxSkills: number,
  tokenBudget: number,
): { slugs: string[]; budgetTrimmed: boolean; skillPromptTokens: number } {
  const cap = Math.max(1, Math.min(maxSkills, HARD_MAX_SKILLS_CEILING));
  const capped = selectedSlugs.slice(0, cap);
  const selected = skills.filter((s) => capped.includes(s.slug));
  const { result, budgetTrimmed } = trimToBudget(selected, tokenBudget);
  return {
    slugs: result.map((s) => s.slug),
    budgetTrimmed,
    skillPromptTokens: totalTokens(result),
  };
}

/**
 * Filter LLM results: keep only valid scores >= threshold and known skill slugs.
 * NaN, Infinity, negative, or non-numeric scores are rejected (fail closed).
 */
function applyConfidenceFilter(
  results: Array<{ slug: string; score: number }>,
  threshold: number,
  validSlugs: Set<string>,
): Array<{ slug: string; score: number }> {
  return results.filter(
    (r) =>
      validSlugs.has(r.slug) &&
      typeof r.score === "number" &&
      isFinite(r.score) &&
      r.score >= 0 &&
      r.score >= threshold,
  );
}

export async function routeSkills(params: RouteParams): Promise<RoutingDecision> {
  const config = params.routingConfig ?? DEFAULT_ROUTING_CONFIG;
  const { userMessage, attachmentKinds, skills, mode, explicitSlugs, tokenBudget, maxSkills, classify } = params;
  const candidates = scoreSkills(userMessage, attachmentKinds, skills, config);
  const validSlugs = new Set(skills.map((s) => s.slug));

  // 1. none → no skills selected.
  if (mode === "none") {
    return {
      selectedSlugs: [],
      confidence: 0,
      reason: "Routing mode is none — no skill injected.",
      candidates,
      llmUsed: false,
      budgetTrimmed: false,
      skillPromptTokens: 0,
    };
  }

  // 2. debug_all → every skill body, bypassing cap + budget.
  if (mode === "debug_all") {
    const all = skills.map((s) => s.slug);
    return {
      selectedSlugs: all,
      confidence: 1,
      reason: "Debug mode — all skills injected (cap/budget bypassed).",
      candidates,
      llmUsed: false,
      budgetTrimmed: false,
      skillPromptTokens: totalTokens(skills),
    };
  }

  // Resolve a raw selection for explicit / auto, then share the cap+budget tail.
  let rawSlugs: string[];
  let confidence: number;
  let reason: string;
  let llmUsed = false;

  if (mode === "explicit" && explicitSlugs && explicitSlugs.length > 0) {
    // 3. explicit → exactly the user's picks that exist among active skills.
    rawSlugs = skills.filter((s) => explicitSlugs.includes(s.slug)).map((s) => s.slug);
    // confidence=0 when no active skill matched (e.g. slug was deleted from DB).
    confidence = rawSlugs.length > 0 ? 1 : 0;
    reason = rawSlugs.length > 0
      ? `Explicit selection: ${rawSlugs.join(", ")}`
      : "Explicit selection matched no active skill.";
  } else {
    // 4. auto (explicit with empty explicitSlugs also runs auto).
    const above = candidates.filter((c) => c.score >= config.autoThreshold);

    if (above.length === 0) {
      // 4c. Zero deterministic matches: try LLM if strong attachment context exists.
      const strongAttachment =
        attachmentKinds.includes("base_resume") ||
        attachmentKinds.includes("tailored_resume") ||
        attachmentKinds.includes("job");

      if (strongAttachment && classify) {
        const llm = await classify(skills, userMessage);
        if (llm && llm.length > 0) {
          const confident = applyConfidenceFilter(llm, config.llmConfidenceThreshold, validSlugs);
          if (confident.length > 0) {
            rawSlugs = confident.map((r) => r.slug);
            confidence = Math.max(...confident.map((r) => r.score));
            reason = "No deterministic match; LLM routing from attachment context";
            llmUsed = true;

            const { slugs, budgetTrimmed, skillPromptTokens } = finalizeSelection(
              rawSlugs,
              skills,
              maxSkills,
              tokenBudget,
            );
            return {
              selectedSlugs: slugs,
              confidence,
              reason,
              candidates,
              llmUsed,
              budgetTrimmed,
              skillPromptTokens,
            };
          }
          // LLM returned results but all below threshold — fall through to no-skill.
        }
      }

      return {
        selectedSlugs: [],
        confidence: 0,
        reason: "No skill matched the message.",
        candidates,
        llmUsed: false,
        budgetTrimmed: false,
        skillPromptTokens: 0,
      };
    }

    const topScore = Math.max(...above.map((c) => c.score));
    const tied = above.filter((c) => c.score >= topScore - config.ambiguousGap);

    if (tied.length >= 2 && classify) {
      const llm = await classify(skills, userMessage);
      if (llm && llm.length > 0) {
        const confident = applyConfidenceFilter(llm, config.llmConfidenceThreshold, validSlugs);
        if (confident.length > 0) {
          rawSlugs = confident.map((r) => r.slug);
          confidence = Math.max(...confident.map((r) => r.score));
          reason = `LLM resolved ambiguity among: ${tied.map((c) => c.slug).join(", ")}`;
          llmUsed = true;
        } else {
          // LLM ran but all results below threshold — fall back to top deterministic.
          const top = above.reduce((a, b) => (b.score > a.score ? b : a));
          rawSlugs = [top.slug];
          confidence = top.score;
          reason = `LLM results below confidence threshold; fell back to top deterministic match: ${top.slug}`;
          llmUsed = true;
        }
      } else {
        const top = above.reduce((a, b) => (b.score > a.score ? b : a));
        rawSlugs = [top.slug];
        confidence = top.score;
        reason = `LLM returned empty; fell back to top deterministic match: ${top.slug}`;
        llmUsed = true;
      }
    } else {
      const top = above.reduce((a, b) => (b.score > a.score ? b : a));
      rawSlugs = [top.slug];
      confidence = top.score;
      reason = `Deterministic match: ${top.slug}`;
    }
  }

  // 5. Shared tail: cap + token budget.
  const { slugs, budgetTrimmed, skillPromptTokens } = finalizeSelection(
    rawSlugs,
    skills,
    maxSkills,
    tokenBudget,
  );

  return {
    selectedSlugs: slugs,
    confidence,
    reason,
    candidates,
    llmUsed,
    budgetTrimmed,
    skillPromptTokens,
  };
}

export { estimateTokens };
