/**
 * Token budgeting utilities for skill body injection.
 *
 * Uses a rough character-to-token ratio (4:1) to estimate token counts so the
 * router can enforce a configurable budget without calling an external API.
 */

/** Minimum shape `trimToBudget` needs — anything with a body and optional priority. */
export interface BudgetableSkill {
  slug: string;
  body: string;
  meta?: { priority?: number };
}

/**
 * Rough chars-to-token ratio for markdown/instruction text.
 * Conservative estimate — skill bodies are instructions, not prose.
 * Named constant so tooling can grep for it if the ratio is ever revisited.
 */
export const CHARS_PER_TOKEN = 4;

/**
 * Rough token estimator — 1 token ≈ CHARS_PER_TOKEN characters.
 */
export function estimateTokens(body: string): number {
  return Math.ceil(body.length / CHARS_PER_TOKEN);
}

/** Sum estimated tokens across a list of skill bodies. */
export function totalTokens(skills: Array<{ body: string }>): number {
  return skills.reduce((sum, s) => sum + estimateTokens(s.body), 0);
}

/**
 * Trim selected skills to fit within `budget` tokens.
 *
 * Sorts by priority (lower number = higher priority), keeps the top skill,
 * then fills remaining budget with the next-highest-priority skills. A skill
 * that doesn't fit is dropped (not partially injected — half a skill body is
 * worse than none). Returns a flag so callers know trimming happened.
 */
export function trimToBudget<T extends BudgetableSkill>(
  selected: T[],
  budget: number,
): { result: T[]; budgetTrimmed: boolean } {
  if (totalTokens(selected) <= budget) {
    return { result: selected, budgetTrimmed: false };
  }

  const sorted = [...selected].sort(
    (a, b) => (a.meta?.priority ?? 999) - (b.meta?.priority ?? 999),
  );

  const keep: T[] = [];
  let remaining = budget;
  for (const skill of sorted) {
    const tokens = estimateTokens(skill.body);
    if (keep.length === 0 || tokens <= remaining) {
      keep.push(skill);
      remaining -= tokens;
    }
    // else: drop — budget exhausted for this lower-priority skill.
  }

  return { result: keep, budgetTrimmed: true };
}
