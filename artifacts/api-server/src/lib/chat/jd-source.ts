/**
 * jd-source.ts — JD parse source selection and LRU cache wrapper.
 *
 * Intentionally dependency-free from context-requirements.ts to keep this
 * module decoupled. The looksLikeJd helper is duplicated locally.
 */

import { createHash } from "node:crypto";
import type { MessageAttachment } from "@workspace/db";
import type { ParsedJd } from "./context-builder";
import { parseJdText } from "./jd-parse-preprocess";

// ── JD signal detection ──────────────────────────────────────────────────────

const JD_SIGNALS = [
  "responsibilities",
  "requirements",
  "qualifications",
  "about the role",
  "job description",
  "preferred",
  "minimum",
  "salary",
  "benefits",
  "location",
];

function looksLikeJd(text: string, minHits = 2): boolean {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const sig of JD_SIGNALS) {
    if (lower.includes(sig)) hits++;
    if (hits >= minHits) return true;
  }
  return false;
}

// ── Public types ─────────────────────────────────────────────────────────────

export interface JdParseSource {
  text: string | null;
  source: "job_attachment" | "document_attachment" | "user_message" | "none";
  /** e.g. job title or document filename */
  sourceLabel?: string;
}

export interface JdParseCacheResult {
  parsedJd: ParsedJd | null;
  cacheHit: boolean;
}

// ── Source extraction ────────────────────────────────────────────────────────

/**
 * Select the best JD text source from the available context.
 *
 * Priority:
 *   1. job attachment (has jdText)
 *   2. document attachment that looks like a JD (3+ signals)
 *   3. user message > 200 chars with 2+ JD signals
 *   4. none
 */
export function extractJdParseSource(args: {
  userMessage: string;
  attachments: MessageAttachment[];
}): JdParseSource {
  const { userMessage, attachments } = args;

  // 1. Job attachment
  const jobAtt = attachments.find((a) => a.kind === "job");
  if (jobAtt) {
    const snap = jobAtt.snapshot as { jdText?: string | null; title?: string | null } | null;
    if (snap?.jdText) {
      return {
        text: snap.jdText,
        source: "job_attachment",
        sourceLabel: snap.title ?? undefined,
      };
    }
  }

  // 2. Document attachment that looks like a JD (require 3+ signals)
  const docAtt = attachments.find((a) => {
    if (a.kind !== "document") return false;
    const snap = a.snapshot as { contentText?: string | null; filename?: string | null } | null;
    if (typeof snap?.contentText !== "string") return false;
    return looksLikeJd(snap.contentText, 3);
  });
  if (docAtt) {
    const snap = docAtt.snapshot as { contentText: string; filename?: string | null };
    return {
      text: snap.contentText,
      source: "document_attachment",
      sourceLabel: snap.filename ?? undefined,
    };
  }

  // 3. User message: > 200 chars AND 2+ JD signals
  if (userMessage.length > 200 && looksLikeJd(userMessage)) {
    return { text: userMessage, source: "user_message" };
  }

  // 4. None
  return { text: null, source: "none" };
}

// ── LRU cache ────────────────────────────────────────────────────────────────

const JD_CACHE_TTL_MS = 30 * 60 * 1000;
const JD_CACHE_MAX = 100;

interface CacheEntry {
  value: ParsedJd | null;
  expiresAt: number;
}

class LruCache {
  private map = new Map<string, CacheEntry>();

  get(key: string): ParsedJd | null | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    // Move to end = most recently used
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: ParsedJd | null): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= JD_CACHE_MAX) {
      // Evict least recently used (first in Map)
      const firstKey = this.map.keys().next().value!;
      this.map.delete(firstKey);
    }
    this.map.set(key, { value, expiresAt: Date.now() + JD_CACHE_TTL_MS });
  }

  clear(): void {
    this.map.clear();
  }
}

const jdParseCache = new LruCache();

/** Clears the module-level cache. Call in test `beforeEach` to prevent cross-test pollution. */
export function resetCacheForTesting(): void {
  jdParseCache.clear();
}

// ── getCachedJdParse ─────────────────────────────────────────────────────────

/**
 * Parse JD text with an in-process LRU cache (TTL: 30 min, max 100 entries).
 * Cache key is sha256 of normalised text (trim + lowercase + collapse whitespace).
 */
export async function getCachedJdParse(
  text: string,
  userId?: number,
): Promise<JdParseCacheResult> {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  const key = createHash("sha256").update(normalized).digest("hex");

  const cached = jdParseCache.get(key);
  if (cached !== undefined) {
    return { parsedJd: cached, cacheHit: true };
  }

  const parsedJd = await parseJdText(text, userId);
  jdParseCache.set(key, parsedJd);
  return { parsedJd, cacheHit: false };
}
