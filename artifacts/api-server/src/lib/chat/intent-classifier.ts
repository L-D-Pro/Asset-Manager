import type { LoadedSkill } from "./skill-loader";

/**
 * Skill slug attributed to a chat turn for variant-stats purposes.
 *
 * Both vendored skills are always loaded into the system prompt — the
 * classifier only picks the *primary* skill so the `event_logs` /
 * `ai_run_evaluations` row attributes the turn to one specific
 * `ai_prompt_versions` row in the existing learning loop.
 *
 * `"general"` means we couldn't confidently route — we still attribute to the
 * first vendored skill (resume ATS optimizer) for accounting purposes.
 */
export type PrimarySkillSlug =
  | "resume-ats-optimizer"
  | "cover-letter-generator"
  | "tailored-resume-generator"
  | "general";

const COVER_LETTER_PATTERNS = [
  /\bcover[\s-]?letter\b/i,
  /\bapplication letter\b/i,
  /\bletter (?:for|to)\b/i,
  /write (?:me )?a letter\b/i,
];

// "Tailor my resume", "create a tailored resume for this JD", "customize my resume" — these
// route to the tailored-resume-generator skill. We test these BEFORE the ATS patterns so a
// request that includes both "resume" and "tailor"/"customize" routes here, not to ATS.
const TAILORED_RESUME_PATTERNS = [
  /\btailor(?:ed|ing)?\b.*\bresume\b/i,
  /\bresume\b.*\btailor(?:ed|ing)?\b/i,
  /\bcustomize\b.*\bresume\b/i,
  /\bresume\b.*\bfor (?:this|the) (?:job|role|position|jd)\b/i,
  /\btailored resume\b/i,
];

const RESUME_PATTERNS = [
  /\bats\b/i,
  /applicant tracking/i,
  /\bresume\b/i,
  /\bcv\b/i,
  /keyword(?:s)?/i,
  /optimize.*(?:resume|cv|application)/i,
  /(?:not|aren'?t|isn'?t|haven'?t been) getting (?:interviews|responses|callbacks)/i,
];

/**
 * Picks the primary skill slug for a given user message. Used purely for
 * variant attribution — both skills remain available in the system prompt
 * regardless of the classification.
 */
export function classifyIntent(userMessage: string): PrimarySkillSlug {
  const text = userMessage.toLowerCase();
  const coverHit = COVER_LETTER_PATTERNS.some((p) => p.test(text));
  const tailorHit = TAILORED_RESUME_PATTERNS.some((p) => p.test(text));
  const resumeHit = RESUME_PATTERNS.some((p) => p.test(text));

  // Tailored resume requests beat the more generic ATS / resume signals so a
  // message like "tailor my resume for this JD" doesn't get attributed to the
  // ATS skill.
  if (tailorHit && !coverHit) return "tailored-resume-generator";
  if (coverHit && !resumeHit && !tailorHit) return "cover-letter-generator";
  if (resumeHit && !coverHit && !tailorHit) return "resume-ats-optimizer";
  if (coverHit && (resumeHit || tailorHit)) {
    // Tie-breaker: cover letter signals are the most specific.
    return "cover-letter-generator";
  }
  return "general";
}

/**
 * Resolves a primary skill classification to the actual loaded skill record.
 * `general` falls back to the first vendored skill.
 */
export function resolvePrimarySkill(skills: LoadedSkill[], slug: PrimarySkillSlug): LoadedSkill {
  if (slug === "general") {
    if (skills.length === 0) {
      throw new Error("No chat skills loaded");
    }
    return skills[0]!;
  }
  const found = skills.find((s) => s.slug === slug);
  if (!found) {
    throw new Error(`Primary skill slug not loaded: ${slug}`);
  }
  return found;
}
