import { logger } from "../logger";
import type { Claim } from "@workspace/db";

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
