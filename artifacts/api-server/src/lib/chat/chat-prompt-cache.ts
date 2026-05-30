/**
 * chat-prompt-cache.ts — Version-aware, in-process LRU cache for the chat prompt bundle.
 *
 * The cache stores the full loaded + pre-processed prompt bundle. The version key is
 * computed from the data itself — if anything in the DB changes, the key changes and
 * the cache misses, guaranteeing freshness on every Control Plane edit.
 *
 * Key invariant: Any Control Plane edit (lever config, skill body, best practices)
 * must take effect on the VERY NEXT chat turn. No stale caching is acceptable.
 */

import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  aiChatLeverConfigTable,
  aiPromptVersionsTable,
  type AiChatLeverConfig,
  type ChatSkillMetadata,
} from "@workspace/db";
import type { RouterSkill } from "./skill-router";
import { DEFAULT_ROUTING_CONFIG, type RoutingConfig } from "./skill-router";
import type { BestPracticesConfig } from "../best-practices";
import {
  loadOrCreateBestPractices,
  formatBestPracticesForPrompt,
} from "../best-practices";
import { IDENTITY_BLOCK } from "./system-prompt";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PromptBundle {
  /** Version key — changes when any Control Plane data changes. */
  versionKey: string;
  config: AiChatLeverConfig;
  /** Active chat skills with full bodies, ready for routing. */
  allSkills: Array<RouterSkill & { name: string }>;
  /** Pre-formatted best practices string (empty if disabled). */
  bestPracticesText: string;
  /** Routing config derived from lever config. */
  routingConfig: RoutingConfig;
}

// ── LRU cache ────────────────────────────────────────────────────────────────

const BUNDLE_CACHE_MAX = 10;
const BUNDLE_CACHE_TTL_MS = 5 * 60 * 1000;

interface BundleCacheEntry {
  value: PromptBundle;
  expiresAt: number;
}

class LruCache {
  private map = new Map<string, BundleCacheEntry>();

  get(key: string): PromptBundle | undefined {
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

  set(key: string, value: PromptBundle): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= BUNDLE_CACHE_MAX) {
      // Evict least recently used (first in Map)
      const firstKey = this.map.keys().next().value!;
      this.map.delete(firstKey);
    }
    this.map.set(key, { value, expiresAt: Date.now() + BUNDLE_CACHE_TTL_MS });
  }

  clear(): void {
    this.map.clear();
  }
}

const bundleCache = new LruCache();

/** Clears the module-level cache. Call in test `beforeEach` to prevent cross-test pollution. */
export function resetPromptBundleCacheForTesting(): void {
  bundleCache.clear();
}

// ── Version key ───────────────────────────────────────────────────────────────

type SkillRow = typeof aiPromptVersionsTable.$inferSelect;

function buildVersionKey(
  config: AiChatLeverConfig,
  skillRows: SkillRow[],
  bestPractices: BestPracticesConfig,
): string {
  const configPart = `${config.id}:${config.updatedAt?.toISOString() ?? config.id}`;
  // Skill key includes id + version + updatedAt per row.
  // CONTRACT: Control Plane edits to a skill body MUST bump updatedAt or version on the row
  // (Drizzle/ORM default behavior on `.update()` calls satisfies this; raw SQL bypasses it).
  const skillsPart = skillRows
    .map((r) => `${r.id}:${r.version}:${r.updatedAt?.toISOString() ?? r.id}`)
    .join(",");
  // Best practices table may lack updatedAt — hash the full JSON to detect any content change.
  const bpPart = createHash("sha256")
    .update(JSON.stringify(bestPractices.items))
    .digest("hex")
    .slice(0, 16);
  return createHash("sha256")
    .update(`${configPart}|${skillsPart}|${bpPart}`)
    .digest("hex")
    .slice(0, 32);
}

// ── Metadata coercion ────────────────────────────────────────────────────────

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

// ── Safe default bundle (first-run edge case) ────────────────────────────────

function makeDefaultBundle(): PromptBundle {
  const config = {
    id: 0,
    identityText: IDENTITY_BLOCK,
    skillsEnabled: true,
    skillRoutingMode: "auto",
    skillTokenBudget: 4000,
    maxSelectedSkills: 2,
    bestPracticesEnabled: false,
    historyTurnLimit: 20,
    autoThreshold: DEFAULT_ROUTING_CONFIG.autoThreshold,
    triggerWeight: DEFAULT_ROUTING_CONFIG.triggerWeight,
    negativeTriggerWeight: DEFAULT_ROUTING_CONFIG.negativeTriggerWeight,
    ambiguousGap: DEFAULT_ROUTING_CONFIG.ambiguousGap,
    llmConfidenceThreshold: DEFAULT_ROUTING_CONFIG.llmConfidenceThreshold,
    coverBoost: DEFAULT_ROUTING_CONFIG.coverBoost,
    boostTailorPlusJob: DEFAULT_ROUTING_CONFIG.boostTailorPlusJob,
    boostResumePlusJob: DEFAULT_ROUTING_CONFIG.boostResumePlusJob,
    boostAuditTailoredJob: DEFAULT_ROUTING_CONFIG.boostAuditTailoredJob,
    boostAuditTailoredOnly: DEFAULT_ROUTING_CONFIG.boostAuditTailoredOnly,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  } satisfies AiChatLeverConfig;

  return {
    versionKey: "default",
    config,
    allSkills: [],
    bestPracticesText: "",
    routingConfig: DEFAULT_ROUTING_CONFIG,
  };
}

// ── getCachedPromptBundle ────────────────────────────────────────────────────

/**
 * Load the prompt bundle from the DB (with version-aware in-process LRU cache).
 *
 * The version key is derived entirely from the data — if any Control Plane row
 * changes the key changes and the cache misses, so the next chat turn always
 * sees the latest config.
 */
export async function getCachedPromptBundle(): Promise<PromptBundle> {
  const [configRows, skillRows, bestPractices] = await Promise.all([
    db.select().from(aiChatLeverConfigTable).limit(1),
    db
      .select()
      .from(aiPromptVersionsTable)
      .where(
        and(
          eq(aiPromptVersionsTable.taskScope, "chat"),
          eq(aiPromptVersionsTable.isActive, true),
        ),
      )
      .orderBy(asc(aiPromptVersionsTable.id)),
    loadOrCreateBestPractices(),
  ]);

  const config = configRows[0];
  if (!config) {
    // Return a safe default bundle if no config exists (first-run edge case)
    return makeDefaultBundle();
  }

  const versionKey = buildVersionKey(config, skillRows, bestPractices);

  const cached = bundleCache.get(versionKey);
  if (cached) return cached;

  // Build the bundle
  const allSkills: Array<RouterSkill & { name: string }> = skillRows
    .map((r) => ({
      slug: r.label,
      body: r.systemPrompt,
      name: r.roleLabel ?? r.label,
      meta: coerceMeta(r.metadata),
    }))
    .filter((s) => s.meta.status !== "deprecated");

  const routingConfig: RoutingConfig = {
    autoThreshold: config.autoThreshold,
    triggerWeight: config.triggerWeight,
    negativeTriggerWeight: config.negativeTriggerWeight,
    ambiguousGap: config.ambiguousGap,
    llmConfidenceThreshold: config.llmConfidenceThreshold,
    coverBoost: config.coverBoost,
    boostTailorPlusJob: config.boostTailorPlusJob,
    boostResumePlusJob: config.boostResumePlusJob,
    boostAuditTailoredJob: config.boostAuditTailoredJob,
    boostAuditTailoredOnly: config.boostAuditTailoredOnly,
  };

  const bestPracticesText = config.bestPracticesEnabled
    ? formatBestPracticesForPrompt(bestPractices)
    : "";

  const bundle: PromptBundle = {
    versionKey,
    config,
    allSkills,
    bestPracticesText,
    routingConfig,
  };

  bundleCache.set(versionKey, bundle);
  return bundle;
}
