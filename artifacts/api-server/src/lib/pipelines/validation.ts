import { logger } from "../logger";
import type { Claim } from "@workspace/db";
import { callAI, parseJsonResponse } from "../ai-client";

/**
 * Thrown when AI output fails quality validation — specifically when best practices
 * are violated (markdown formatting, generic filler, wrong length, etc).
 *
 * Callers should catch this to trigger a retry or store the output for debugging.
 */
export class QualityViolation extends Error {
  constructor(
    message: string,
    public readonly violations: string[],
    public readonly rawContent: string,
  ) {
    super(message);
    this.name = "QualityViolation";
  }
}

/**
 * Thrown when AI output fails truth-lock validation — specifically when zero
 * valid content items remain after filtering hallucinated claim IDs.
 *
 * Callers should catch this specifically (via `instanceof TruthLockViolation`)
 * to distinguish truth-lock failures from unexpected runtime errors, then store
 * the raw AI output in the version record for debugging.
 *
 * The `details` property contains structured context (e.g. `rawContent`, `context`)
 * that callers can log or persist.
 */
export class TruthLockViolation extends Error {
  constructor(
    message: string,
    /** Structured details for logging and storage (e.g. raw AI output, context label). */
    public readonly details: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TruthLockViolation";
  }
}

/**
 * Validates a set of claim IDs against the selected/active claims.
 * Returns a set of valid claim IDs that are a subset of the selected claims.
 * Throws TruthLockViolation if hallucinated IDs are found (IDs not in selectedClaims).
 */
export function validateClaimIds(
  returnedIds: number[],
  selectedClaims: Claim[],
  context: string,
): number[] {
  const selectedIdSet = new Set(selectedClaims.map((c) => c.id));
  const hallucinated = returnedIds.filter((id) => !selectedIdSet.has(id));

  if (hallucinated.length > 0) {
    logger.warn(
      { context, hallucinated, validIds: [...selectedIdSet] },
      "AI returned hallucinated claim IDs — dropping them",
    );
    // Drop hallucinated IDs rather than throwing — return only valid ones
    return returnedIds.filter((id) => selectedIdSet.has(id));
  }

  return returnedIds;
}

/**
 * Validates a tailored bullet:
 * - Must have non-empty text
 * - Must have at least one claimId that is in the selected claims
 * - All returned claimIds must be from selectedClaims (hallucinated ones are dropped)
 *
 * Returns null if the bullet is invalid and should be discarded.
 */
export function validateBullet(
  bullet: { text?: unknown; claimIds?: unknown; section?: unknown; isAggregated?: unknown; originalText?: unknown },
  selectedClaims: Claim[],
): { text: string; claimIds: number[]; section: string; isAggregated: boolean; originalText: string | null } | null {
  if (typeof bullet.text !== "string" || bullet.text.trim().length === 0) {
    logger.warn({ bullet }, "Bullet missing text — discarding");
    return null;
  }

  const rawIds = Array.isArray(bullet.claimIds)
    ? bullet.claimIds.filter((id): id is number => typeof id === "number")
    : [];

  if (rawIds.length === 0) {
    logger.warn({ bullet }, "Bullet has no claim IDs — discarding (truth lock)");
    return null;
  }

  const validIds = validateClaimIds(rawIds, selectedClaims, `bullet:"${bullet.text.slice(0, 50)}"`);

  if (validIds.length === 0) {
    logger.warn({ bullet }, "Bullet has no valid claim IDs after filtering hallucinations — discarding");
    return null;
  }

  return {
    text: bullet.text.trim(),
    claimIds: validIds,
    section: typeof bullet.section === "string" ? bullet.section : "experience",
    isAggregated: typeof bullet.isAggregated === "boolean" ? bullet.isAggregated : validIds.length > 1,
    originalText: typeof bullet.originalText === "string" ? bullet.originalText : null,
  };
}

/**
 * Validates a cover letter paragraph:
 * - Must have non-empty text
 * - Must have at least one claimId from the selected claims (unattributed paragraphs are allowed for opening/closing with lenient mode)
 * - All returned claimIds must be from selectedClaims (hallucinated ones are dropped)
 *
 * Returns null only if the paragraph has hallucinated IDs and no valid ones remain
 * (but text is preserved if we can drop hallucinated IDs and still have valid ones).
 */
export function validateParagraph(
  para: { text?: unknown; claimIds?: unknown; role?: unknown },
  selectedClaims: Claim[],
): { text: string; claimIds: number[]; role: string } | null {
  if (typeof para.text !== "string" || para.text.trim().length === 0) {
    logger.warn({ para }, "Paragraph missing text — discarding");
    return null;
  }

  const rawIds = Array.isArray(para.claimIds)
    ? para.claimIds.filter((id): id is number => typeof id === "number")
    : [];

  const validIds = rawIds.length > 0
    ? validateClaimIds(rawIds, selectedClaims, `paragraph:${para.role}`)
    : [];

  const role = typeof para.role === "string" ? para.role : "body";

  // Opening/closing paragraphs may legitimately have no claim citations
  // Body/hook paragraphs must have at least one valid claim ID
  if (validIds.length === 0 && (role === "body" || role === "hook")) {
    logger.warn({ para, role }, "Body/hook paragraph has no valid claim IDs — discarding");
    return null;
  }

  return {
    text: para.text.trim(),
    claimIds: validIds,
    role,
  };
}

/**
 * Checks if AI output was too malformed to produce any usable content.
 * Throws TruthLockViolation so callers can store raw output for debugging.
 *
 * Called after all validation passes to catch the case where every item was discarded.
 * The thrown error carries the first 1000 characters of raw AI output for debugging.
 */
export function assertMinimumContent<T>(
  items: T[],
  rawContent: string,
  context: string,
): void {
  if (items.length === 0) {
    throw new TruthLockViolation(
      `AI output produced zero valid ${context} after truth-lock validation`,
      { rawContent: rawContent.slice(0, 1000), context },
    );
  }
}

/**
 * Strips AI-generated claim ID references (e.g. "(ID:4)", "[ID:14]") from text.
 * Also cleans up leftover whitespace and double spaces.
 */
export function stripClaimIdRefs(text: string): string {
  if (!text) return "";
  return text
    .replace(/\s*\(ID:\d+\)/gi, "")
    .replace(/\s*\[ID:\d+\]/gi, "")
    .replace(/\s+,/g, ",") // clean up leftover trailing commas
    .replace(/\s{2,}/g, " ") // collapse double-spaces
    .trim();
}

// ─── Best Practices Validation ───

const MARKDOWN_PATTERNS = [
  /\*\*.+?\*\*/,      // bold
  /\*.+?\*/,          // italic
  /^#{1,6}\s/m,       // headers
  /^\s*[-*+]\s/m,     // bullet lists
  /^\s*\d+\.\s/m,      // numbered lists
  /`[^`]+`/,          // inline code
  /```[\s\S]*?```/,   // code blocks
  /\[.+?\]\(.+?\)/,   // links
];

const GENERIC_FILLER_PHRASES = [
  "team player",
  "detail-oriented",
  "detail oriented",
  "hard worker",
  "hardworking",
  "passionate about",
  "self-starter",
  "self starter",
  "think outside the box",
  "go-getter",
  "go getter",
  "results-driven",
  "results driven",
  "synergy",
  "leverage",
  "proven track record",
  "dynamic",
  "motivated",
  "enthusiastic",
];

/**
 * Checks if text contains markdown formatting.
 * Returns array of violations found.
 */
export function checkNoMarkdown(text: string): string[] {
  const violations: string[] = [];
  for (const pattern of MARKDOWN_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`Markdown formatting detected: ${pattern.source.slice(0, 40)}`);
    }
  }
  return violations;
}

/**
 * Checks for generic filler phrases.
 * Returns array of violations found.
 */
export function checkNoGenericFiller(text: string): string[] {
  const lower = text.toLowerCase();
  const violations: string[] = [];
  for (const phrase of GENERIC_FILLER_PHRASES) {
    if (lower.includes(phrase)) {
      violations.push(`Generic filler phrase: "${phrase}"`);
    }
  }
  return violations;
}

/**
 * Checks cover letter length (250-400 words).
 * Returns violation if outside range.
 */
export function checkCoverLetterLength(text: string): string[] {
  const wordCount = text.trim().split(/\s+/).length;
  const violations: string[] = [];
  if (wordCount < 250) {
    violations.push(`Cover letter too short: ${wordCount} words (minimum 250)`);
  } else if (wordCount > 500) {
    violations.push(`Cover letter too long: ${wordCount} words (maximum 400)`);
  }
  return violations;
}

/**
 * Checks that bullets contain quantified impact (numbers, percentages, etc.).
 * Returns array of bullets that lack quantification.
 */
export function checkQuantifiedImpact(bullets: { text: string }[]): string[] {
  const violations: string[] = [];
  const numberPattern = /\d+%?|\$\d+|\d+\s*(k|K|m|M|million|thousand)|\d+\s*(years?|months?|weeks?|days?)|\d+\s*(users?|customers?|clients?|team members?)/i;

  for (const bullet of bullets) {
    if (!numberPattern.test(bullet.text)) {
      violations.push(`Bullet lacks quantified impact: "${bullet.text.slice(0, 60)}..."`);
    }
  }
  return violations;
}

/**
 * Runs all best-practices validations on resume output.
 * Throws QualityViolation if any violations found.
 */
export function validateResumeQuality(
  documentText: string,
  bullets: { text: string }[],
): void {
  const violations: string[] = [
    ...checkNoMarkdown(documentText),
    ...checkNoGenericFiller(documentText),
    ...checkQuantifiedImpact(bullets),
  ];

  if (violations.length > 0) {
    logger.warn({ violations }, "Resume quality violations detected");
    throw new QualityViolation(
      `Resume failed quality validation: ${violations.length} violations`,
      violations,
      documentText,
    );
  }
}

const SEMANTIC_QUALITY_SYSTEM_PROMPT = `You are a strict quality-control reviewer for job application documents.
Your job is to check whether a document meets the following criteria:
1. TAILORED — the document clearly targets THIS specific job, not a generic version. Look for the company name, role title, or specific JD keywords.
2. BUSINESS_PROBLEM — at least one bullet or paragraph addresses a concrete business problem the candidate solved (not just a task performed).
3. NO_HALLUCINATION — every specific claim (metric, product name, technology) reads as plausible and specific, not vague or contradictory.

Return ONLY valid JSON:
{ "passes": boolean, "violations": ["violation 1", ...] }

If all checks pass, return { "passes": true, "violations": [] }.
If any check fails, return { "passes": false, "violations": ["Descriptive violation message", ...] }.`;

/**
 * Runs a lightweight AI self-check for semantic quality rules that regex cannot enforce.
 * Checks tailoring specificity, business-problem framing, and hallucination signals.
 * Throws QualityViolation if the AI finds violations.
 * Non-fatal on AI call failure — logs a warning and returns without throwing.
 */
export async function validateSemanticQuality(
  documentText: string,
  jobContext: string,
  jobId?: number,
): Promise<void> {
  let result;
  try {
    result = await callAI({
      taskType: "quality_check",
      systemPrompt: SEMANTIC_QUALITY_SYSTEM_PROMPT,
      userPrompt: `JOB CONTEXT:\n${jobContext.slice(0, 1000)}\n\nDOCUMENT TO REVIEW:\n${documentText.slice(0, 3000)}`,
      jobId,
    });
  } catch (err) {
    logger.warn({ err, jobId }, "Semantic quality check AI call failed — skipping");
    return;
  }

  const parsed = parseJsonResponse<{ passes: boolean; violations: string[] }>(result.content);
  if (!parsed) {
    logger.warn({ jobId, raw: result.content.slice(0, 300) }, "Semantic quality check returned unparseable response — skipping");
    return;
  }

  if (!parsed.passes && parsed.violations?.length > 0) {
    logger.warn({ jobId, violations: parsed.violations }, "Semantic quality violations detected");
    throw new QualityViolation(
      `Semantic quality check failed: ${parsed.violations.length} violations`,
      parsed.violations,
      documentText,
    );
  }
}

/**
 * Runs all best-practices validations on cover letter output.
 * Throws QualityViolation if any violations found.
 */
export function validateCoverLetterQuality(
  fullText: string,
): void {
  const violations: string[] = [
    ...checkNoMarkdown(fullText),
    ...checkNoGenericFiller(fullText),
    ...checkCoverLetterLength(fullText),
  ];

  if (violations.length > 0) {
    logger.warn({ violations }, "Cover letter quality violations detected");
    throw new QualityViolation(
      `Cover letter failed quality validation: ${violations.length} violations`,
      violations,
      fullText,
    );
  }
}
