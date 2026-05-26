/**
 * Skill router — determines which skills should be injected into the system
 * prompt for a given chat turn (progressive disclosure).
 *
 * Pipeline:
 * 1. `none` → empty selection (catalog only).
 * 2. `debug_all` → all active skills, skip cap/budget.
 * 3. `explicit` → the user's picked slugs, then shared cap + budget.
 * 4. `auto`:
 *    - Deterministic scoring via `scoreSkills(message, attachmentKinds, skills)`.
 *    - 4b. Attachment/context boosts applied to deterministic scores before threshold check.
 *    - One clear winner at/above threshold → select it, skip LLM.
 *    - 4c. Zero deterministic matches + strong attachment context → LLM routing attempt.
 *    - Zero candidates at/above threshold → empty (no fallback-to-all).
 *    - Ambiguous (≥2 candidates within the gap) → injected `classify` (LLM).
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

export interface RouteParams {
  userMessage: string;
  conversationSummary?: string;
  attachmentKinds: string[];
  skills: RouterSkill[];
  mode: "none" | "auto" | "explicit" | "debug_all";
  explicitSlugs?: string[];
  tokenBudget: number;
  maxSkills: number;
  /** Injected for testing — prod impl calls `callAI({ taskType: "skill_routing" })`. */
  classify?: (
    catalog: RouterSkill[],
    message: string,
  ) => Promise<Array<{ slug: string; score: number }> | null>;
}

/** A single matching trigger is enough to select a skill in `auto`. */
const AUTO_THRESHOLD = 0.3;
const TRIGGER_WEIGHT = 0.3;
const NEGATIVE_WEIGHT = 0.5;
/** Candidates within this score gap of the top are "tied" → LLM disambiguates. */
const AMBIGUOUS_GAP = 0.15;
/** Hard cap on selected skills regardless of config (except `debug_all`). */
const HARD_MAX_SKILLS = 2;

/**
 * Computes slug → extra score boosts based on attachment context.
 * Uses partial slug matching (e.g. "resume-tailoring" matches boost for "tailor").
 */
function attachmentBoosts(
  attachmentKinds: string[],
  skills: RouterSkill[],
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
        addBoost(slug, 0.4);
      }
      if (slug.includes("resume")) {
        addBoost(slug, 0.2);
      }
    }

    // tailored_resume + job → audit boost
    if (hasTailoredResume && hasJob) {
      if (slug.includes("audit") || slug.includes("resume-audit")) {
        addBoost(slug, 0.4);
      }
    }

    // tailored_resume only (no job) → audit boost
    if (hasTailoredResume && !hasJob) {
      if (slug.includes("audit")) {
        addBoost(slug, 0.2);
      }
    }
  }

  return boosts;
}

/**
 * Deterministic scorer — generalizes the old `intent-classifier` regexes into a
 * metadata-driven score: +per positive trigger, − per negative trigger.
 * Also applies attachment-context boosts.
 */
function scoreSkills(
  message: string,
  attachmentKinds: string[],
  skills: RouterSkill[],
): Array<{ slug: string; score: number }> {
  const text = message.toLowerCase();
  const hasCover =
    attachmentKinds.some((k) => k.toLowerCase().includes("cover")) ||
    text.includes("cover");
  const boosts = attachmentBoosts(attachmentKinds, skills);

  return skills.map((skill) => {
    let score = 0;
    for (const ex of skill.meta.triggerExamples ?? []) {
      if (ex && text.includes(ex.toLowerCase())) score += TRIGGER_WEIGHT;
    }
    for (const neg of skill.meta.negativeTriggers ?? []) {
      if (neg && text.includes(neg.toLowerCase())) score -= NEGATIVE_WEIGHT;
    }
    score += boosts.get(skill.slug) ?? 0;
    if (hasCover && skill.slug.includes("cover")) {
      score += 0.3;
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
  const cap = Math.max(1, Math.min(maxSkills, HARD_MAX_SKILLS));
  const capped = selectedSlugs.slice(0, cap);
  const selected = skills.filter((s) => capped.includes(s.slug));
  const { result, budgetTrimmed } = trimToBudget(selected, tokenBudget);
  return {
    slugs: result.map((s) => s.slug),
    budgetTrimmed,
    skillPromptTokens: totalTokens(result),
  };
}

export async function routeSkills(params: RouteParams): Promise<RoutingDecision> {
  const { userMessage, attachmentKinds, skills, mode, explicitSlugs, tokenBudget, maxSkills, classify } = params;
  const candidates = scoreSkills(userMessage, attachmentKinds, skills);

  // 1. none → no skills selected (catalog still shown by the prompt builder).
  if (mode === "none") {
    return {
      selectedSlugs: [],
      confidence: 0,
      reason: "Routing mode is none — catalog only.",
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
    confidence = 1;
    reason = rawSlugs.length > 0
      ? `Explicit selection: ${rawSlugs.join(", ")}`
      : "Explicit selection matched no active skill.";
  } else {
    // 4. auto (also: explicit with no valid picks falls through to auto).
    const above = candidates.filter((c) => c.score >= AUTO_THRESHOLD);

    if (above.length === 0) {
      // 4c. Zero deterministic matches: try LLM if strong attachment context exists.
      const strongAttachment =
        attachmentKinds.includes("base_resume") ||
        attachmentKinds.includes("tailored_resume") ||
        attachmentKinds.includes("job");

      if (strongAttachment && classify) {
        const llm = await classify(skills, userMessage);
        if (llm && llm.length > 0) {
          rawSlugs = llm.map((r) => r.slug);
          confidence = Math.max(...llm.map((r) => r.score));
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
      }

      return {
        selectedSlugs: [],
        confidence: 0,
        reason: "No skill matched the message — catalog only.",
        candidates,
        llmUsed: false,
        budgetTrimmed: false,
        skillPromptTokens: 0,
      };
    }

    const topScore = Math.max(...above.map((c) => c.score));
    const tied = above.filter((c) => c.score >= topScore - AMBIGUOUS_GAP);

    if (tied.length >= 2 && classify) {
      const llm = await classify(skills, userMessage);
      if (llm && llm.length > 0) {
        rawSlugs = llm.map((r) => r.slug);
        confidence = Math.max(...llm.map((r) => r.score));
        reason = `LLM resolved ambiguity among: ${tied.map((c) => c.slug).join(", ")}`;
        llmUsed = true;
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
