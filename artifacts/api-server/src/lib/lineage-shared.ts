export const RUN_ID_PREFIX = "run";

/**
 * Canonical run_id format used across the system.
 *
 * NOTE: This file is intentionally DB-free so it can be imported by unit tests
 * and contract code without requiring DATABASE_URL.
 */
export function isCanonicalRunId(value: unknown): value is string {
  return typeof value === "string" && /^run_[a-z0-9_-]{16,}$/i.test(value.trim());
}

export function normalizeRunId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function mintRunId(seed?: { now?: Date; random?: string }): string {
  const now = seed?.now ?? new Date();
  const random = (seed?.random ?? globalThis.crypto.randomUUID().replace(/-/g, "")).slice(0, 12);
  return `${RUN_ID_PREFIX}_${now.toISOString().replace(/[:.]/g, "").toLowerCase()}_${random}`;
}
