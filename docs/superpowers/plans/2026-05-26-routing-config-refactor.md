# Routing Config Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move hardcoded routing/model-behavior constants into Control Plane DB config or named code constants, with fail-closed LLM confidence handling and no fallback-to-all.

**Architecture:** New columns on `ai_chat_lever_config` hold tunable routing weights; a `RoutingConfig` interface threads them through `routeSkills`; `classifyWithLLM` fails closed on invalid confidence; non-tunable structural constants become named exports.

**Tech Stack:** Drizzle ORM (pg), Express 5, React 19, TanStack Query, Orval codegen, Zod, Vitest

---

## Hardcoded-Behavior Audit Table

| File | Hardcoded value | Controls | Classification | Destination |
|------|----------------|----------|----------------|-------------|
| `skill-router.ts` | `AUTO_THRESHOLD = 0.3` | Min score for deterministic match | Tunable behavior | Control Plane |
| `skill-router.ts` | `TRIGGER_WEIGHT = 0.3` | Score per matching trigger example | Tunable behavior | Control Plane |
| `skill-router.ts` | `NEGATIVE_WEIGHT = 0.5` | Score subtracted per negative trigger | Tunable behavior | Control Plane |
| `skill-router.ts` | `AMBIGUOUS_GAP = 0.15` | Tie-detection gap for LLM fallback | Tunable behavior | Control Plane |
| `skill-router.ts` | `HARD_MAX_SKILLS = 2` | Absolute skill injection ceiling | Structural safety | Keep in code; export as `HARD_MAX_SKILLS_CEILING`, document |
| `skill-router.ts` | boost `+0.4` tailor+job | Attachment boost for tailor slug | Tunable behavior | Control Plane |
| `skill-router.ts` | boost `+0.2` resume+job | Attachment boost for resume slug | Tunable behavior | Control Plane |
| `skill-router.ts` | boost `+0.4` audit+tailored+job | Attachment boost for audit slug | Tunable behavior | Control Plane |
| `skill-router.ts` | boost `+0.2` audit+tailored-only | Attachment boost for audit slug (no job) | Tunable behavior | Control Plane |
| `skill-router.ts` | cover signal boost `+0.3` | Cover-letter context boost | Tunable behavior | Control Plane |
| `resolve-system-prompt.ts` | `ROUTER_SYSTEM_PROMPT` string | LLM router instructions | Implementation default | **Follow-up:** seed into `ai_prompt_versions` (taskScope=skill_routing); centralize for now |
| `resolve-system-prompt.ts` | confidence fallback `0.6` | LLM confidence when missing/invalid | Bug (should fail closed) | Fix in code: return `null` → no skill |
| `stream-openrouter.ts` | `HISTORY_TURN_LIMIT = 20` | Conversation context window | Tunable behavior | Control Plane |
| `stream-openrouter.ts` | `maxTokens ?? 4096` | Per-model generation limit fallback | Implementation default | Named constant `DEFAULT_MODEL_MAX_TOKENS = 4096` |
| `output-validator.ts` | `MAX_OUTPUT_CHARS = 32_000` | Observability flag threshold | Implementation default | Named constant (already is one); add JSDoc clarifying observability-only |
| `token-budget.ts` | `4` (chars/token ratio) | Token estimation denominator | Implementation constant | Named constant `CHARS_PER_TOKEN = 4` |

---

## File Map

| File | Change type | Responsibility |
|------|------------|----------------|
| `lib/db/src/schema/ai-chat-lever-config.ts` | Modify | Add 11 new columns (`real` + `integer`) |
| `lib/db/src/schema/ai-chat-lever-presets.ts` | Modify | Add routing fields (optional) to `ChatLeverSnapshot` |
| `lib/db/migrations/routing-config.sql` | Create | Idempotent `ADD COLUMN IF NOT EXISTS` migration |
| `lib/db/apply-routing-config.mjs` | Create | Apply script mirroring `apply-skill-routing.mjs` |
| `artifacts/api-server/src/lib/chat/skill-router.ts` | Modify | `RoutingConfig`, `DEFAULT_ROUTING_CONFIG`, remove magic constants, LLM confidence filter |
| `artifacts/api-server/src/lib/chat/resolve-system-prompt.ts` | Modify | Build `RoutingConfig` from DB, fix confidence fail-closed, expose `historyTurnLimit` |
| `artifacts/api-server/src/lib/chat/stream-openrouter.ts` | Modify | Use `historyTurnLimit` from config, `DEFAULT_MODEL_MAX_TOKENS` |
| `artifacts/api-server/src/lib/chat/token-budget.ts` | Modify | `CHARS_PER_TOKEN = 4` named constant |
| `lib/api-spec/openapi.yaml` | Modify | Add 11 new fields to `ChatLeverConfig`, `UpdateChatLeverConfigBody`, `ChatLeverSnapshot` |
| `artifacts/api-server/src/routes/chat-control-plane.ts` | Modify | Preset create/update/apply include new routing fields |
| `artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx` | Modify | `RoutingCard` Advanced Routing Tuning section |
| `artifacts/api-server/src/lib/chat/__tests__/skill-router.test.ts` | Modify | 11 new tests |
| `artifacts/api-server/src/lib/chat/ROUTING_BEHAVIOR.md` | Modify | Document CP-tunable vs structural safety, fix stale wording |

---

## Task 1: DB Schema — New Columns on `ai_chat_lever_config`

**Files:**
- Modify: `lib/db/src/schema/ai-chat-lever-config.ts`

- [ ] **Step 1: Add `real` import and 11 new columns**

Replace the import line and add columns to the table. Full new content of `lib/db/src/schema/ai-chat-lever-config.ts`:

```typescript
import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Singleton config row for the Chat Control Plane.
 *
 * Holds the live state of every chat "lever": the editable identity block,
 * the master kill switches, the skill-routing mode, and tunable routing weights.
 * Exactly one row is expected — seeded on first startup, read on every chat turn.
 */
export const aiChatLeverConfigTable = pgTable("ai_chat_lever_config", {
  id: serial("id").primaryKey(),
  /** Editable identity/wrapper block — replaces the hardcoded IDENTITY_BLOCK. */
  identityText: text("identity_text").notNull(),
  /** Master kill switch for all chat skills. */
  skillsEnabled: boolean("skills_enabled").notNull().default(true),
  /** Master kill switch for the best-practices block in chat. */
  bestPracticesEnabled: boolean("best_practices_enabled")
    .notNull()
    .default(true),
  /**
   * `"none"` — never inject a skill body (catalog still shown).
   * `"auto"` — deterministic-first; LLM only for ambiguous cases; no fallback-to-all.
   * `"explicit"` — inject exactly the skill(s) the user picked in the composer.
   * `"debug_all"` — inject every active skill body (bypasses cap + budget).
   */
  skillRoutingMode: text("skill_routing_mode").notNull().default("auto"),
  /**
   * Max tokens of injected skill bodies in `auto`/`explicit` modes.
   * Default 1500. Ignored in `debug_all`.
   */
  skillTokenBudget: integer("skill_token_budget").notNull().default(1500),
  /**
   * Hard cap on selected skills (unless `debug_all`). Default 1.
   * Code enforces an absolute ceiling of HARD_MAX_SKILLS_CEILING (2) regardless.
   */
  maxSelectedSkills: integer("max_selected_skills").notNull().default(1),

  // ── Tunable routing weights ──────────────────────────────────────────────

  /**
   * Minimum deterministic score for a skill to be considered a match.
   * Skills scoring below this are not selected without LLM fallback.
   * Default 0.3. Range [0.0, 1.0].
   */
  autoThreshold: real("auto_threshold").notNull().default(0.3),
  /**
   * Score added per matching trigger example.
   * Default 0.3. Range [0.0, 2.0].
   */
  triggerWeight: real("trigger_weight").notNull().default(0.3),
  /**
   * Score subtracted per matching negative trigger.
   * Default 0.5. Range [0.0, 2.0].
   */
  negativeTriggerWeight: real("negative_trigger_weight").notNull().default(0.5),
  /**
   * Candidates within this score gap of the top are "tied" → LLM disambiguates.
   * Default 0.15. Range [0.0, 0.5].
   */
  ambiguousGap: real("ambiguous_gap").notNull().default(0.15),
  /**
   * Minimum LLM confidence score to accept a skill selection.
   * LLM results below this threshold are treated as no-selection (fail closed).
   * Default 0.5. Range [0.0, 1.0].
   */
  llmConfidenceThreshold: real("llm_confidence_threshold").notNull().default(0.5),
  /**
   * Score boost applied to skills whose slug contains "cover" when a cover
   * signal is detected in the message or attachments.
   * Default 0.3. Range [0.0, 2.0].
   */
  coverBoost: real("cover_boost").notNull().default(0.3),
  /**
   * Score boost for slugs containing "tailor" or "tailored-resume" when
   * both base_resume and job attachments are present.
   * Default 0.4. Range [0.0, 2.0].
   */
  boostTailorPlusJob: real("boost_tailor_plus_job").notNull().default(0.4),
  /**
   * Score boost for slugs containing "resume" when base_resume + job attached.
   * Default 0.2. Range [0.0, 2.0].
   */
  boostResumePlusJob: real("boost_resume_plus_job").notNull().default(0.2),
  /**
   * Score boost for slugs containing "audit" when tailored_resume + job attached.
   * Default 0.4. Range [0.0, 2.0].
   */
  boostAuditTailoredJob: real("boost_audit_tailored_job").notNull().default(0.4),
  /**
   * Score boost for slugs containing "audit" when tailored_resume attached (no job).
   * Default 0.2. Range [0.0, 2.0].
   */
  boostAuditTailoredOnly: real("boost_audit_tailored_only").notNull().default(0.2),
  /**
   * Maximum conversation history turns fed to the model per turn.
   * Default 20. Range [1, 100].
   */
  historyTurnLimit: integer("history_turn_limit").notNull().default(20),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAiChatLeverConfigSchema = createInsertSchema(
  aiChatLeverConfigTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export const updateAiChatLeverConfigSchema =
  insertAiChatLeverConfigSchema.partial();

export type InsertAiChatLeverConfig = z.infer<
  typeof insertAiChatLeverConfigSchema
>;
export type UpdateAiChatLeverConfig = z.infer<
  typeof updateAiChatLeverConfigSchema
>;
export type AiChatLeverConfig = typeof aiChatLeverConfigTable.$inferSelect;

/**
 * Routing modes for the skill routing pipeline.
 * - `"none"` — never inject a skill body (catalog still shown).
 * - `"auto"` — deterministic-first; LLM only for ambiguous cases; no fallback-to-all.
 * - `"explicit"` — inject exactly the skill(s) the user picked in the composer.
 * - `"debug_all"` — inject every active skill body (bypasses cap + budget).
 */
export type ChatSkillRoutingMode = "none" | "auto" | "explicit" | "debug_all";
```

- [ ] **Step 2: Run `node ./node_modules/typescript/bin/tsc --build` from repo root**

Expected: no errors (libs only — downstream packages not checked yet).

```
node ./node_modules/typescript/bin/tsc --build
```

---

## Task 2: DB Schema — ChatLeverSnapshot Routing Fields

**Files:**
- Modify: `lib/db/src/schema/ai-chat-lever-presets.ts`

- [ ] **Step 1: Add optional routing fields to `ChatLeverSnapshot`**

All new fields are optional so old presets (missing these keys) remain valid. Full replacement of the `ChatLeverSnapshot` interface in that file:

```typescript
/**
 * Shape of a captured lever-state snapshot stored in `ai_chat_lever_presets`.
 * Applying a preset writes these fields back into `ai_chat_lever_config` and
 * flips `ai_prompt_versions.isActive` to match `activePromptVersionIds`.
 *
 * All routing fields are optional for backward compatibility with presets
 * saved before routing config was tunable — missing fields fall back to the
 * current live config value when applied.
 */
export interface ChatLeverSnapshot {
  identityText: string;
  skillsEnabled: boolean;
  bestPracticesEnabled: boolean;
  skillRoutingMode: string;
  skillTokenBudget: number;
  maxSelectedSkills: number;
  /** Prompt-version row ids that should be active when this preset applies. */
  activePromptVersionIds: number[];

  // ── Tunable routing weights (optional — backward compat) ─────────────────
  autoThreshold?: number;
  triggerWeight?: number;
  negativeTriggerWeight?: number;
  ambiguousGap?: number;
  llmConfidenceThreshold?: number;
  coverBoost?: number;
  boostTailorPlusJob?: number;
  boostResumePlusJob?: number;
  boostAuditTailoredJob?: number;
  boostAuditTailoredOnly?: number;
  historyTurnLimit?: number;
}
```

- [ ] **Step 2: Build libs again to confirm no errors**

```
node ./node_modules/typescript/bin/tsc --build
```

---

## Task 3: SQL Migration + Apply Script

**Files:**
- Create: `lib/db/migrations/routing-config.sql`
- Create: `lib/db/apply-routing-config.mjs`

- [ ] **Step 1: Write migration SQL**

`lib/db/migrations/routing-config.sql`:

```sql
BEGIN;

-- ── ai_chat_lever_config: tunable routing weight columns ─────────────────
ALTER TABLE "ai_chat_lever_config"
  ADD COLUMN IF NOT EXISTS "auto_threshold"            real    NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS "trigger_weight"            real    NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS "negative_trigger_weight"   real    NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS "ambiguous_gap"             real    NOT NULL DEFAULT 0.15,
  ADD COLUMN IF NOT EXISTS "llm_confidence_threshold"  real    NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS "cover_boost"               real    NOT NULL DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS "boost_tailor_plus_job"     real    NOT NULL DEFAULT 0.4,
  ADD COLUMN IF NOT EXISTS "boost_resume_plus_job"     real    NOT NULL DEFAULT 0.2,
  ADD COLUMN IF NOT EXISTS "boost_audit_tailored_job"  real    NOT NULL DEFAULT 0.4,
  ADD COLUMN IF NOT EXISTS "boost_audit_tailored_only" real    NOT NULL DEFAULT 0.2,
  ADD COLUMN IF NOT EXISTS "history_turn_limit"        integer NOT NULL DEFAULT 20;

COMMIT;
```

- [ ] **Step 2: Write apply script**

`lib/db/apply-routing-config.mjs`:

```javascript
#!/usr/bin/env node
// Apply lib/db/migrations/routing-config.sql against $DATABASE_URL.
//
// Usage (from lib/db):
//   node --env-file=../../.env apply-routing-config.mjs

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Did you forget `node --env-file=../../.env`?");
  process.exit(1);
}

function resolveSsl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    const mode = url.searchParams.get("sslmode")?.toLowerCase();
    if (mode === "require") return { rejectUnauthorized: false };
    if (mode === "verify-ca" || mode === "verify-full") return { rejectUnauthorized: true };
    return undefined;
  } catch {
    return undefined;
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(here, "migrations", "routing-config.sql");
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(process.env.DATABASE_URL),
});

try {
  await client.connect();
  console.log(`Connected. Applying ${sqlPath}…`);
  await client.query(sql);
  console.log("✓ routing-config migration applied successfully");
} catch (err) {
  console.error("✗ Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
```

- [ ] **Step 3: Apply migration to Neon DB**

Run from `lib/db`:
```
node --env-file=../../.env apply-routing-config.mjs
```

Expected output: `✓ routing-config migration applied successfully`

---

## Task 4: Centralize Non-DB Constants

**Files:**
- Modify: `artifacts/api-server/src/lib/chat/token-budget.ts`

- [ ] **Step 1: Add `CHARS_PER_TOKEN` named constant in `token-budget.ts`**

Change lines 17–21 of the file to:

```typescript
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
```

- [ ] **Step 2: Add `DEFAULT_MODEL_MAX_TOKENS` in `stream-openrouter.ts`**

After the existing imports in `stream-openrouter.ts`, add below the `HISTORY_TURN_LIMIT = 20` line (which will be removed later — add the new constant BEFORE Task 9 removes it):

We will handle `DEFAULT_MODEL_MAX_TOKENS` in Task 9 when we refactor `stream-openrouter.ts` to use `historyTurnLimit` from the DB config. Note it here for reference:

```typescript
/** Fallback max_tokens for model configs where maxTokens is null in the DB. */
const DEFAULT_MODEL_MAX_TOKENS = 4096;
```

---

## Task 5: Refactor `skill-router.ts` — RoutingConfig + Remove Magic Constants

**Files:**
- Modify: `artifacts/api-server/src/lib/chat/skill-router.ts`

This is the core refactor. Replace the entire file with the new version below.

Key changes:
- Add `RoutingConfig` interface + `DEFAULT_ROUTING_CONFIG`
- Export `HARD_MAX_SKILLS_CEILING = 2` (structural safety, documented)
- Add `routingConfig?: RoutingConfig` to `RouteParams`
- Thread config through `scoreSkills` and `attachmentBoosts`
- Filter LLM results by confidence threshold + validate slug membership + check for NaN/invalid scores
- Both LLM paths (ambiguous and attachment) respect `llmConfidenceThreshold`

- [ ] **Step 1: Write failing tests first (see Task 11 — write tests BEFORE implementing)**

> **TDD gate:** Write the new tests in Task 11 before completing this step. Run them and confirm they fail for the right reasons. Then continue.

- [ ] **Step 2: Replace `skill-router.ts` with the new implementation**

Full replacement content:

```typescript
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
 * NaN, Infinity, negative, or out-of-range [0,1] scores are rejected (fail closed).
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
    confidence = 1;
    reason = rawSlugs.length > 0
      ? `Explicit selection: ${rawSlugs.join(", ")}`
      : "Explicit selection matched no active skill.";
  } else {
    // 4. auto (also: explicit with no valid picks falls through to auto).
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
        reason: "No skill matched the message — catalog only.",
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
```

- [ ] **Step 3: Build libs**

```
node ./node_modules/typescript/bin/tsc --build
```

Expected: no errors.

---

## Task 6: Fix `classifyWithLLM` + Thread `RoutingConfig` in `resolve-system-prompt.ts`

**Files:**
- Modify: `artifacts/api-server/src/lib/chat/resolve-system-prompt.ts`

- [ ] **Step 1: Add `RoutingConfig` import and fix confidence fallback**

Replace the `classifyWithLLM` function body. Change lines 129–159:

```typescript
/**
 * Production LLM classifier — resolves ambiguous routes via a cheap model.
 * Mirrors `jd-parse-preprocess`: tries the `skill_routing` task scope, falls
 * back to `chat`, and returns null on any failure (router then uses rules).
 *
 * Fails closed: if the LLM returns missing, non-numeric, non-finite, or
 * out-of-range [0,1] confidence, returns null (no skill selected).
 * The caller's llmConfidenceThreshold filter applies after this.
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
```

- [ ] **Step 2: Add `RoutingConfig` import and thread from DB config**

Add `type RoutingConfig` to the import from `./skill-router`:

```typescript
import {
  routeSkills,
  type RouterSkill,
  type RoutingDecision,
  type RoutingConfig,
} from "./skill-router";
```

- [ ] **Step 3: Build routing config from DB config in `resolveChatPrompt`**

In `resolveChatPrompt`, after the destructuring of `config` values, add:

```typescript
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
```

- [ ] **Step 4: Pass `routingConfig` to `routeSkills` call**

Update the `routeSkills` call to include `routingConfig`:

```typescript
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
```

- [ ] **Step 5: Add `historyTurnLimit` to `ResolvedChatPrompt` and return it**

Update the `ResolvedChatPrompt` interface:

```typescript
export interface ResolvedChatPrompt {
  systemPrompt: string;
  sections: PromptSection[];
  decision: RoutingDecision;
  /** The routing mode actually applied (after override + skillsEnabled gating). */
  mode: RoutingMode;
  /** Maximum history turns to feed to the model — from DB lever config. */
  historyTurnLimit: number;
}
```

Update the return statement in `resolveChatPrompt`:

```typescript
  return {
    systemPrompt: buildSystemPrompt(inputs),
    sections: buildSystemPromptSections(inputs),
    decision,
    mode,
    historyTurnLimit: config.historyTurnLimit,
  };
```

- [ ] **Step 6: Build libs + typecheck api-server**

```
node ./node_modules/typescript/bin/tsc --build
cd artifacts/api-server && node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```

Expected: no errors.

---

## Task 7: Refactor `stream-openrouter.ts` — Use Dynamic `historyTurnLimit`

**Files:**
- Modify: `artifacts/api-server/src/lib/chat/stream-openrouter.ts`

- [ ] **Step 1: Add `DEFAULT_MODEL_MAX_TOKENS` constant and remove `HISTORY_TURN_LIMIT`**

Replace line 24 (`const HISTORY_TURN_LIMIT = 20;`) with:

```typescript
/**
 * Fallback max_tokens for model configs where maxTokens is null in the DB.
 * Model-level override always wins. This constant exists so the fallback is
 * visible and grep-able, not buried in an inline `?? 4096`.
 */
const DEFAULT_MODEL_MAX_TOKENS = 4096;
```

- [ ] **Step 2: Import `getChatLeverConfig` from `resolve-system-prompt.ts`**

Add `getChatLeverConfig` to the existing import from `./resolve-system-prompt`:

```typescript
import { getChatLeverConfig, resolveChatPrompt } from "./resolve-system-prompt";
```

- [ ] **Step 3: Use `config.historyTurnLimit` for history query**

After the `resolveModel` call (around line 146), add a config read:

```typescript
  // ── Lever config for history limit ─────────────────────────────────────
  const leverConfig = await getChatLeverConfig();
```

Then change the `.limit(HISTORY_TURN_LIMIT)` call (around line 164) to:

```typescript
    .limit(leverConfig.historyTurnLimit);
```

- [ ] **Step 4: Use `DEFAULT_MODEL_MAX_TOKENS` fallback**

Change line 241 (`max_tokens: m.maxTokens ?? 4096`) to:

```typescript
        max_tokens: m.maxTokens ?? DEFAULT_MODEL_MAX_TOKENS,
```

- [ ] **Step 5: Typecheck api-server**

```
cd artifacts/api-server && node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```

Expected: no errors.

---

## Task 8: Update `openapi.yaml` + Run Codegen

**Files:**
- Modify: `lib/api-spec/openapi.yaml`

- [ ] **Step 1: Add new fields to `ChatLeverConfig` schema**

Find the `ChatLeverConfig` schema (around line 5924) and add after `maxSelectedSkills`:

```yaml
        autoThreshold:
          type: number
          format: float
          minimum: 0
          maximum: 1
        triggerWeight:
          type: number
          format: float
          minimum: 0
          maximum: 2
        negativeTriggerWeight:
          type: number
          format: float
          minimum: 0
          maximum: 2
        ambiguousGap:
          type: number
          format: float
          minimum: 0
          maximum: 0.5
        llmConfidenceThreshold:
          type: number
          format: float
          minimum: 0
          maximum: 1
        coverBoost:
          type: number
          format: float
          minimum: 0
          maximum: 2
        boostTailorPlusJob:
          type: number
          format: float
          minimum: 0
          maximum: 2
        boostResumePlusJob:
          type: number
          format: float
          minimum: 0
          maximum: 2
        boostAuditTailoredJob:
          type: number
          format: float
          minimum: 0
          maximum: 2
        boostAuditTailoredOnly:
          type: number
          format: float
          minimum: 0
          maximum: 2
        historyTurnLimit:
          type: integer
          minimum: 1
          maximum: 100
```

Also add all 11 new field names to the `required` array of `ChatLeverConfig`.

- [ ] **Step 2: Add new fields to `UpdateChatLeverConfigBody` schema**

Find `UpdateChatLeverConfigBody` (around line 5959) and add after `maxSelectedSkills` (with same min/max validation):

```yaml
        autoThreshold:
          type: number
          format: float
          minimum: 0
          maximum: 1
        triggerWeight:
          type: number
          format: float
          minimum: 0
          maximum: 2
        negativeTriggerWeight:
          type: number
          format: float
          minimum: 0
          maximum: 2
        ambiguousGap:
          type: number
          format: float
          minimum: 0
          maximum: 0.5
        llmConfidenceThreshold:
          type: number
          format: float
          minimum: 0
          maximum: 1
        coverBoost:
          type: number
          format: float
          minimum: 0
          maximum: 2
        boostTailorPlusJob:
          type: number
          format: float
          minimum: 0
          maximum: 2
        boostResumePlusJob:
          type: number
          format: float
          minimum: 0
          maximum: 2
        boostAuditTailoredJob:
          type: number
          format: float
          minimum: 0
          maximum: 2
        boostAuditTailoredOnly:
          type: number
          format: float
          minimum: 0
          maximum: 2
        historyTurnLimit:
          type: integer
          minimum: 1
          maximum: 100
```

- [ ] **Step 3: Add new fields to `ChatLeverSnapshot` schema**

Find `ChatLeverSnapshot` (around line 6072) and add after `maxSelectedSkills` (all optional — no `required` for these):

```yaml
        autoThreshold:
          type: number
          format: float
        triggerWeight:
          type: number
          format: float
        negativeTriggerWeight:
          type: number
          format: float
        ambiguousGap:
          type: number
          format: float
        llmConfidenceThreshold:
          type: number
          format: float
        coverBoost:
          type: number
          format: float
        boostTailorPlusJob:
          type: number
          format: float
        boostResumePlusJob:
          type: number
          format: float
        boostAuditTailoredJob:
          type: number
          format: float
        boostAuditTailoredOnly:
          type: number
          format: float
        historyTurnLimit:
          type: integer
```

Do NOT add these to the `required` list of `ChatLeverSnapshot` — they are optional for backward compat.

- [ ] **Step 4: Run codegen**

```
pnpm --filter @workspace/api-spec run codegen
```

- [ ] **Step 5: Rebuild libs (generated types changed)**

```
node ./node_modules/typescript/bin/tsc --build
```

Expected: no errors.

---

## Task 9: Update `chat-control-plane.ts` — Preset Create/Update/Apply

**Files:**
- Modify: `artifacts/api-server/src/routes/chat-control-plane.ts`

- [ ] **Step 1: Update snapshot creation in `POST /chat/lever-presets`**

In `router.post("/chat/lever-presets", ...)`, replace the `snapshot` object (lines 163–171):

```typescript
  const snapshot: ChatLeverSnapshot = {
    identityText: config.identityText,
    skillsEnabled: config.skillsEnabled,
    bestPracticesEnabled: config.bestPracticesEnabled,
    skillRoutingMode: config.skillRoutingMode,
    skillTokenBudget: config.skillTokenBudget,
    maxSelectedSkills: config.maxSelectedSkills,
    activePromptVersionIds: activeRows.map((r) => r.id),
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
    historyTurnLimit: config.historyTurnLimit,
  };
```

- [ ] **Step 2: Update snapshot creation in `PATCH /chat/lever-presets/:id`**

Same replacement in the `router.patch("/chat/lever-presets/:id", ...)` handler (lines 204–212).

- [ ] **Step 3: Update apply in `POST /chat/lever-presets/:id/apply`**

Replace the `.set({...})` call in the apply handler (lines 265–273) to include new fields with fallback to current config for backward compat with old presets:

```typescript
    const [updated] = await db
      .update(aiChatLeverConfigTable)
      .set({
        identityText: snapshot.identityText,
        skillsEnabled: snapshot.skillsEnabled,
        bestPracticesEnabled: snapshot.bestPracticesEnabled,
        skillRoutingMode: snapshot.skillRoutingMode,
        skillTokenBudget: snapshot.skillTokenBudget,
        maxSelectedSkills: snapshot.maxSelectedSkills,
        // Routing config — fall back to current live value for old presets missing these fields.
        autoThreshold: snapshot.autoThreshold ?? config.autoThreshold,
        triggerWeight: snapshot.triggerWeight ?? config.triggerWeight,
        negativeTriggerWeight: snapshot.negativeTriggerWeight ?? config.negativeTriggerWeight,
        ambiguousGap: snapshot.ambiguousGap ?? config.ambiguousGap,
        llmConfidenceThreshold: snapshot.llmConfidenceThreshold ?? config.llmConfidenceThreshold,
        coverBoost: snapshot.coverBoost ?? config.coverBoost,
        boostTailorPlusJob: snapshot.boostTailorPlusJob ?? config.boostTailorPlusJob,
        boostResumePlusJob: snapshot.boostResumePlusJob ?? config.boostResumePlusJob,
        boostAuditTailoredJob: snapshot.boostAuditTailoredJob ?? config.boostAuditTailoredJob,
        boostAuditTailoredOnly: snapshot.boostAuditTailoredOnly ?? config.boostAuditTailoredOnly,
        historyTurnLimit: snapshot.historyTurnLimit ?? config.historyTurnLimit,
      })
      .where(eq(aiChatLeverConfigTable.id, config.id))
      .returning();
```

- [ ] **Step 4: Typecheck api-server**

```
cd artifacts/api-server && node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```

Expected: no errors.

---

## Task 10: Update Control Plane UI — Advanced Routing Tuning Section

**Files:**
- Modify: `artifacts/dashboard/src/pages/admin/ai-control-plane/index.tsx`

- [ ] **Step 1: Update `RoutingCard` props and add new state**

The `RoutingCard` currently accepts `skillRoutingMode`, `skillTokenBudget`, `maxSelectedSkills`. Add the new routing props:

```typescript
function RoutingCard({
  skillRoutingMode,
  skillTokenBudget,
  maxSelectedSkills,
  autoThreshold,
  triggerWeight,
  negativeTriggerWeight,
  ambiguousGap,
  llmConfidenceThreshold,
  coverBoost,
  boostTailorPlusJob,
  boostResumePlusJob,
  boostAuditTailoredJob,
  boostAuditTailoredOnly,
  historyTurnLimit,
  isPreview,
  onChanged,
}: {
  skillRoutingMode: string;
  skillTokenBudget: number;
  maxSelectedSkills: number;
  autoThreshold: number;
  triggerWeight: number;
  negativeTriggerWeight: number;
  ambiguousGap: number;
  llmConfidenceThreshold: number;
  coverBoost: number;
  boostTailorPlusJob: number;
  boostResumePlusJob: number;
  boostAuditTailoredJob: number;
  boostAuditTailoredOnly: number;
  historyTurnLimit: number;
  isPreview?: boolean;
  onChanged: () => void;
}) {
```

- [ ] **Step 2: Add state for new fields**

Inside `RoutingCard`, add state variables and useEffect syncs for each new field:

```typescript
  const [threshold, setThreshold] = useState(autoThreshold);
  const [trigW, setTrigW] = useState(triggerWeight);
  const [negW, setNegW] = useState(negativeTriggerWeight);
  const [gap, setGap] = useState(ambiguousGap);
  const [llmConf, setLlmConf] = useState(llmConfidenceThreshold);
  const [cover, setCover] = useState(coverBoost);
  const [bTailorJob, setBTailorJob] = useState(boostTailorPlusJob);
  const [bResumeJob, setBResumeJob] = useState(boostResumePlusJob);
  const [bAuditTailoredJob, setBauditTailoredJob] = useState(boostAuditTailoredJob);
  const [bAuditTailoredOnly, setBauditTailoredOnly] = useState(boostAuditTailoredOnly);
  const [historyLimit, setHistoryLimit] = useState(historyTurnLimit);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => { setThreshold(autoThreshold); }, [autoThreshold]);
  useEffect(() => { setTrigW(triggerWeight); }, [triggerWeight]);
  useEffect(() => { setNegW(negativeTriggerWeight); }, [negativeTriggerWeight]);
  useEffect(() => { setGap(ambiguousGap); }, [ambiguousGap]);
  useEffect(() => { setLlmConf(llmConfidenceThreshold); }, [llmConfidenceThreshold]);
  useEffect(() => { setCover(coverBoost); }, [coverBoost]);
  useEffect(() => { setBTailorJob(boostTailorPlusJob); }, [boostTailorPlusJob]);
  useEffect(() => { setBResumeJob(boostResumePlusJob); }, [boostResumePlusJob]);
  useEffect(() => { setBauditTailoredJob(boostAuditTailoredJob); }, [boostAuditTailoredJob]);
  useEffect(() => { setBauditTailoredOnly(boostAuditTailoredOnly); }, [boostAuditTailoredOnly]);
  useEffect(() => { setHistoryLimit(historyTurnLimit); }, [historyTurnLimit]);
```

- [ ] **Step 3: Add `saveAdvanced` handler and dirty check**

```typescript
  const advancedDirty =
    threshold !== autoThreshold ||
    trigW !== triggerWeight ||
    negW !== negativeTriggerWeight ||
    gap !== ambiguousGap ||
    llmConf !== llmConfidenceThreshold ||
    cover !== coverBoost ||
    bTailorJob !== boostTailorPlusJob ||
    bResumeJob !== boostResumePlusJob ||
    bAuditTailoredJob !== boostAuditTailoredJob ||
    bAuditTailoredOnly !== boostAuditTailoredOnly ||
    historyLimit !== historyTurnLimit;

  async function saveAdvanced() {
    if (isPreview) return;
    try {
      await update.mutateAsync({
        data: {
          autoThreshold: threshold,
          triggerWeight: trigW,
          negativeTriggerWeight: negW,
          ambiguousGap: gap,
          llmConfidenceThreshold: llmConf,
          coverBoost: cover,
          boostTailorPlusJob: bTailorJob,
          boostResumePlusJob: bResumeJob,
          boostAuditTailoredJob: bAuditTailoredJob,
          boostAuditTailoredOnly: bAuditTailoredOnly,
          historyTurnLimit: historyLimit,
        },
      });
      onChanged();
      toast({ title: "Advanced routing tuning saved" });
    } catch (err) {
      toast({ title: "Update failed", description: (err as Error).message, variant: "destructive" });
    }
  }
```

- [ ] **Step 4: Add Advanced Routing Tuning section to RoutingCard JSX**

Inside the existing `<LeverCard>` div, after the "Save limits" button section, add:

```tsx
        {/* ── Advanced Routing Tuning ─────────────────────────────────────── */}
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 4, paddingTop: 10 }}>
          <button
            type="button"
            className="btn ghost sm"
            style={{ fontSize: 11 }}
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            {advancedOpen ? "▲" : "▼"} Advanced Routing Tuning
          </button>
          {advancedOpen && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="dim" style={{ fontSize: 11, maxWidth: 560 }}>
                These weights control how the deterministic scorer and LLM fallback behave.
                Changes take effect immediately on the next chat turn.
                See <code>ROUTING_BEHAVIOR.md</code> for what each value controls.
              </div>

              {/* Scoring thresholds */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                {([
                  ["Auto threshold", threshold, setThreshold, 0, 1, 0.05] as const,
                  ["Trigger weight", trigW, setTrigW, 0, 2, 0.05] as const,
                  ["Neg. trigger weight", negW, setNegW, 0, 2, 0.05] as const,
                  ["Ambiguous gap", gap, setGap, 0, 0.5, 0.05] as const,
                  ["LLM confidence min.", llmConf, setLlmConf, 0, 1, 0.05] as const,
                  ["Cover boost", cover, setCover, 0, 2, 0.05] as const,
                ]).map(([label, val, setter, min, max, step]) => (
                  <label key={label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span className="label" style={{ fontSize: 10 }}>{label}</span>
                    <input
                      type="number"
                      className="input"
                      min={min}
                      max={max}
                      step={step}
                      value={val}
                      disabled={isPreview}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v >= min && v <= max) setter(v as never);
                      }}
                      style={{ width: "100%", fontSize: 12 }}
                    />
                  </label>
                ))}
              </div>

              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", marginTop: 2 }}>
                Attachment boosts
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
                {([
                  ["Tailor+job boost", bTailorJob, setBTailorJob] as const,
                  ["Resume+job boost", bResumeJob, setBResumeJob] as const,
                  ["Audit+tailored+job", bAuditTailoredJob, setBauditTailoredJob] as const,
                  ["Audit+tailored only", bAuditTailoredOnly, setBauditTailoredOnly] as const,
                ]).map(([label, val, setter]) => (
                  <label key={label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span className="label" style={{ fontSize: 10 }}>{label}</span>
                    <input
                      type="number"
                      className="input"
                      min={0}
                      max={2}
                      step={0.05}
                      value={val}
                      disabled={isPreview}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v >= 0 && v <= 2) setter(v as never);
                      }}
                      style={{ width: "100%", fontSize: 12 }}
                    />
                  </label>
                ))}
                <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span className="label" style={{ fontSize: 10 }}>History turns</span>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={100}
                    step={1}
                    value={historyLimit}
                    disabled={isPreview}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 1 && v <= 100) setHistoryLimit(v);
                    }}
                    style={{ width: "100%", fontSize: 12 }}
                  />
                </label>
              </div>

              {!isPreview && (
                <button
                  type="button"
                  className="btn primary sm"
                  style={{ alignSelf: "flex-start" }}
                  disabled={!advancedDirty || update.isPending}
                  onClick={saveAdvanced}
                >
                  <Save size={12} strokeWidth={1.8} /> Save routing tuning
                </button>
              )}
            </div>
          )}
        </div>
```

- [ ] **Step 5: Pass new props from parent to `RoutingCard`**

Update the `<RoutingCard>` usage in `AiControlPlanePage` (around line 187) to pass all new fields:

```tsx
          <RoutingCard
            skillRoutingMode={displayed.skillRoutingMode}
            skillTokenBudget={displayed.skillTokenBudget}
            maxSelectedSkills={displayed.maxSelectedSkills}
            autoThreshold={displayed.autoThreshold}
            triggerWeight={displayed.triggerWeight}
            negativeTriggerWeight={displayed.negativeTriggerWeight}
            ambiguousGap={displayed.ambiguousGap}
            llmConfidenceThreshold={displayed.llmConfidenceThreshold}
            coverBoost={displayed.coverBoost}
            boostTailorPlusJob={displayed.boostTailorPlusJob}
            boostResumePlusJob={displayed.boostResumePlusJob}
            boostAuditTailoredJob={displayed.boostAuditTailoredJob}
            boostAuditTailoredOnly={displayed.boostAuditTailoredOnly}
            historyTurnLimit={displayed.historyTurnLimit}
            isPreview={!!previewPreset}
            onChanged={() => { invalidateAll(); }}
          />
```

- [ ] **Step 6: Update the `displayed` computed value to include new fields**

In the `useMemo` for `displayed` (around line 115), add new fields from preset snapshot:

```typescript
  const displayed = useMemo(() => {
    if (!config) return null;
    if (!previewPreset) return config;
    return {
      ...config,
      identityText: previewPreset.snapshot.identityText,
      skillsEnabled: previewPreset.snapshot.skillsEnabled,
      bestPracticesEnabled: previewPreset.snapshot.bestPracticesEnabled,
      skillRoutingMode: previewPreset.snapshot.skillRoutingMode,
      skillTokenBudget: previewPreset.snapshot.skillTokenBudget ?? config.skillTokenBudget,
      maxSelectedSkills: previewPreset.snapshot.maxSelectedSkills ?? config.maxSelectedSkills,
      autoThreshold: previewPreset.snapshot.autoThreshold ?? config.autoThreshold,
      triggerWeight: previewPreset.snapshot.triggerWeight ?? config.triggerWeight,
      negativeTriggerWeight: previewPreset.snapshot.negativeTriggerWeight ?? config.negativeTriggerWeight,
      ambiguousGap: previewPreset.snapshot.ambiguousGap ?? config.ambiguousGap,
      llmConfidenceThreshold: previewPreset.snapshot.llmConfidenceThreshold ?? config.llmConfidenceThreshold,
      coverBoost: previewPreset.snapshot.coverBoost ?? config.coverBoost,
      boostTailorPlusJob: previewPreset.snapshot.boostTailorPlusJob ?? config.boostTailorPlusJob,
      boostResumePlusJob: previewPreset.snapshot.boostResumePlusJob ?? config.boostResumePlusJob,
      boostAuditTailoredJob: previewPreset.snapshot.boostAuditTailoredJob ?? config.boostAuditTailoredJob,
      boostAuditTailoredOnly: previewPreset.snapshot.boostAuditTailoredOnly ?? config.boostAuditTailoredOnly,
      historyTurnLimit: previewPreset.snapshot.historyTurnLimit ?? config.historyTurnLimit,
    };
  }, [config, previewPreset]);
```

- [ ] **Step 7: Typecheck dashboard**

```
cd artifacts/dashboard && node ./node_modules/vite/bin/vite.js build 2>&1 | head -50
```

Expected: no TypeScript errors. Build warnings about bundle size are OK.

---

## Task 11: Write Tests

**Files:**
- Modify: `artifacts/api-server/src/lib/chat/__tests__/skill-router.test.ts`

> **Write these tests BEFORE completing Task 5 Step 1 (the implementation).** Run them to confirm they fail, then implement.

- [ ] **Step 1: Add `DEFAULT_ROUTING_CONFIG` import**

```typescript
import { routeSkills, type RouterSkill, DEFAULT_ROUTING_CONFIG } from "../skill-router.js";
```

- [ ] **Step 2: Add test suite for tunable routing config**

Append to the test file:

```typescript
describe("routeSkills — routing config (tunable behavior)", () => {
  it("lower autoThreshold selects a marginal skill; higher rejects it", async () => {
    // "marginal topic" matches one trigger → score = triggerWeight (0.3 by default)
    // Threshold 0.3 → selected; threshold 0.5 → not selected.
    const skill: RouterSkill = {
      slug: "marginal",
      body: "Marginal skill",
      meta: defaultMeta({ triggerExamples: ["marginal topic"], priority: 1 }),
    };

    const selected = await routeSkills({
      ...baseParams([skill]),
      userMessage: "marginal topic",
      mode: "auto",
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, autoThreshold: 0.3, triggerWeight: 0.3 },
    });
    expect(selected.selectedSlugs).toContain("marginal");

    const notSelected = await routeSkills({
      ...baseParams([skill]),
      userMessage: "marginal topic",
      mode: "auto",
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, autoThreshold: 0.5, triggerWeight: 0.3 },
    });
    expect(notSelected.selectedSlugs).toEqual([]);
  });

  it("lower triggerWeight keeps score below threshold", async () => {
    const skill: RouterSkill = {
      slug: "test-skill",
      body: "Test skill",
      meta: defaultMeta({ triggerExamples: ["keyword"], priority: 1 }),
    };
    // triggerWeight=0.1, autoThreshold=0.3 → score 0.1 < 0.3 → not selected
    const decision = await routeSkills({
      ...baseParams([skill]),
      userMessage: "keyword",
      mode: "auto",
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, triggerWeight: 0.1, autoThreshold: 0.3 },
    });
    expect(decision.selectedSlugs).toEqual([]);
    expect(decision.candidates[0]?.score).toBeCloseTo(0.1, 5);
  });

  it("higher negativeTriggerWeight suppresses a skill that has a matching trigger", async () => {
    // score = triggerWeight(0.3) - negativeTriggerWeight(1.0) = -0.7 → below threshold
    const skill: RouterSkill = {
      slug: "mixed-skill",
      body: "Mixed skill",
      meta: defaultMeta({
        triggerExamples: ["good phrase"],
        negativeTriggers: ["bad phrase"],
        priority: 1,
      }),
    };
    const decision = await routeSkills({
      ...baseParams([skill]),
      userMessage: "good phrase bad phrase",
      mode: "auto",
      routingConfig: {
        ...DEFAULT_ROUTING_CONFIG,
        triggerWeight: 0.3,
        negativeTriggerWeight: 1.0,
        autoThreshold: 0.3,
      },
    });
    expect(decision.selectedSlugs).toEqual([]);
    expect(decision.candidates[0]?.score).toBeCloseTo(0.3 - 1.0, 5);
  });

  it("larger ambiguousGap causes LLM to be called for non-equal scores", async () => {
    // x has 2 triggers (score 0.6), y has 1 (score 0.3). Gap = 0.3.
    // ambiguousGap=0.4 → y is within gap (topScore - gap = 0.2, y=0.3 > 0.2) → tied → LLM called.
    const skills: RouterSkill[] = [
      { slug: "x", body: "X", meta: defaultMeta({ triggerExamples: ["alpha", "beta"], priority: 1 }) },
      { slug: "y", body: "Y", meta: defaultMeta({ triggerExamples: ["alpha"], priority: 2 }) },
    ];
    let llmCalled = false;
    await routeSkills({
      ...baseParams(skills),
      userMessage: "alpha beta",
      mode: "auto",
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, ambiguousGap: 0.4 },
      classify: async () => { llmCalled = true; return [{ slug: "x", score: 0.9 }]; },
    });
    expect(llmCalled).toBe(true);
  });

  it("smaller ambiguousGap prevents LLM from being called for non-equal scores", async () => {
    // Same setup: x=0.6, y=0.3, gap=0.1.
    // ambiguousGap=0.1 → topScore - gap = 0.5, y=0.3 < 0.5 → not tied → no LLM.
    const skills: RouterSkill[] = [
      { slug: "x", body: "X", meta: defaultMeta({ triggerExamples: ["alpha", "beta"], priority: 1 }) },
      { slug: "y", body: "Y", meta: defaultMeta({ triggerExamples: ["alpha"], priority: 2 }) },
    ];
    let llmCalled = false;
    await routeSkills({
      ...baseParams(skills),
      userMessage: "alpha beta",
      mode: "auto",
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, ambiguousGap: 0.1 },
      classify: async () => { llmCalled = true; return [{ slug: "x", score: 0.9 }]; },
    });
    expect(llmCalled).toBe(false);
  });

  it("zeroing boostTailorPlusJob prevents attachment routing for tailor slug", async () => {
    const skill: RouterSkill = {
      slug: "tailor-resume",
      body: "Tailor",
      meta: defaultMeta({ triggerExamples: [], priority: 1 }),
    };
    // With boost=0: score 0 < threshold → not selected
    const notSelected = await routeSkills({
      ...baseParams([skill]),
      userMessage: "help me out",
      attachmentKinds: ["base_resume", "job"],
      mode: "auto",
      routingConfig: {
        ...DEFAULT_ROUTING_CONFIG,
        boostTailorPlusJob: 0.0,
        boostResumePlusJob: 0.0,
        autoThreshold: 0.3,
      },
    });
    expect(notSelected.selectedSlugs).toEqual([]);
  });

  it("raising boostTailorPlusJob above threshold selects tailor skill for vague message", async () => {
    const skill: RouterSkill = {
      slug: "tailor-resume",
      body: "Tailor",
      meta: defaultMeta({ triggerExamples: [], priority: 1 }),
    };
    // With boost=0.5 >= threshold 0.3 → selected
    const selected = await routeSkills({
      ...baseParams([skill]),
      userMessage: "help me out",
      attachmentKinds: ["base_resume", "job"],
      mode: "auto",
      routingConfig: {
        ...DEFAULT_ROUTING_CONFIG,
        boostTailorPlusJob: 0.5,
        boostResumePlusJob: 0.0,
        autoThreshold: 0.3,
      },
    });
    expect(selected.selectedSlugs).toContain("tailor-resume");
  });

  it("LLM confidence above threshold selects skill (ambiguous path)", async () => {
    const ambiguous: RouterSkill[] = [
      { slug: "x", body: "X", meta: defaultMeta({ triggerExamples: ["report"], priority: 1 }) },
      { slug: "y", body: "Y", meta: defaultMeta({ triggerExamples: ["report"], priority: 2 }) },
    ];
    const decision = await routeSkills({
      ...baseParams(ambiguous),
      userMessage: "draft a report",
      mode: "auto",
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, llmConfidenceThreshold: 0.5 },
      classify: async () => [{ slug: "x", score: 0.8 }],
    });
    expect(decision.selectedSlugs).toContain("x");
    expect(decision.llmUsed).toBe(true);
  });

  it("LLM confidence below threshold falls back to top deterministic (ambiguous path)", async () => {
    const ambiguous: RouterSkill[] = [
      { slug: "x", body: "X", meta: defaultMeta({ triggerExamples: ["report"], priority: 1 }) },
      { slug: "y", body: "Y", meta: defaultMeta({ triggerExamples: ["report"], priority: 2 }) },
    ];
    const decision = await routeSkills({
      ...baseParams(ambiguous),
      userMessage: "draft a report",
      mode: "auto",
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, llmConfidenceThreshold: 0.9 },
      classify: async () => [{ slug: "x", score: 0.3 }], // below 0.9 threshold
    });
    // Falls back to top deterministic — still selects one skill, doesn't select nothing
    expect(decision.selectedSlugs).toHaveLength(1);
    expect(decision.reason).toContain("below confidence threshold");
    expect(decision.llmUsed).toBe(true);
  });

  it("LLM confidence below threshold selects no skill (zero-match attachment path)", async () => {
    const neutralSkill: RouterSkill[] = [
      {
        slug: "neutral",
        body: "Neutral",
        meta: defaultMeta({ triggerExamples: ["very specific phrase"], priority: 1 }),
      },
    ];
    // Zero deterministic matches → attachment LLM path → LLM score below threshold → no skill
    const decision = await routeSkills({
      ...baseParams(neutralSkill),
      userMessage: "help me out",
      attachmentKinds: ["base_resume", "job"],
      mode: "auto",
      routingConfig: { ...DEFAULT_ROUTING_CONFIG, llmConfidenceThreshold: 0.9 },
      classify: async () => [{ slug: "neutral", score: 0.3 }], // below 0.9
    });
    expect(decision.selectedSlugs).toEqual([]);
  });

  it("NaN score from classify fails closed — no skill selected", async () => {
    const neutralSkill: RouterSkill[] = [
      {
        slug: "neutral",
        body: "Neutral",
        meta: defaultMeta({ triggerExamples: ["very specific phrase"], priority: 1 }),
      },
    ];
    const decision = await routeSkills({
      ...baseParams(neutralSkill),
      userMessage: "help me out",
      attachmentKinds: ["base_resume"],
      mode: "auto",
      classify: async () => [{ slug: "neutral", score: NaN }],
    });
    expect(decision.selectedSlugs).toEqual([]);
  });

  it("unknown LLM slug is filtered out and falls back to deterministic top", async () => {
    const realSkills: RouterSkill[] = [
      { slug: "real-a", body: "A", meta: defaultMeta({ triggerExamples: ["report"], priority: 1 }) },
      { slug: "real-b", body: "B", meta: defaultMeta({ triggerExamples: ["report"], priority: 2 }) },
    ];
    const decision = await routeSkills({
      ...baseParams(realSkills),
      userMessage: "draft a report",
      mode: "auto",
      classify: async () => [{ slug: "phantom-unknown-slug", score: 0.99 }],
    });
    // Unknown slug filtered → no confident results → falls back to top deterministic
    expect(decision.selectedSlugs).not.toContain("phantom-unknown-slug");
    expect(decision.selectedSlugs).toHaveLength(1);
  });

  it("existing default behavior is preserved (no regression)", async () => {
    // All existing tests continue to pass with DEFAULT_ROUTING_CONFIG as the implicit config.
    // This test uses defaults explicitly to document the contract.
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "tailor my resume for this job",
      mode: "auto",
      routingConfig: DEFAULT_ROUTING_CONFIG,
    });
    expect(decision.selectedSlugs).toEqual(["tailored-resume"]);
    expect(decision.reason).toContain("Deterministic match");
  });

  it("no fallback-to-all in auto mode regardless of config", async () => {
    const decision = await routeSkills({
      ...baseParams(mockSkills),
      userMessage: "what is the meaning of life",
      attachmentKinds: [],
      mode: "auto",
      routingConfig: DEFAULT_ROUTING_CONFIG,
    });
    expect(decision.selectedSlugs.length).toBeLessThan(mockSkills.length);
  });
});
```

- [ ] **Step 3: Run tests to confirm new tests fail for the right reasons (before implementing)**

```
cd artifacts/api-server && node --env-file-if-exists=../../.env ./node_modules/.bin/vitest run src/lib/chat/__tests__/skill-router.test.ts
```

Expected: new tests fail (TS compile error — `routingConfig` not on `RouteParams`, `DEFAULT_ROUTING_CONFIG` not exported). This confirms we're doing TDD correctly.

- [ ] **Step 4: After Task 5 implementation, run tests again to confirm all pass**

```
cd artifacts/api-server && node --env-file-if-exists=../../.env ./node_modules/.bin/vitest run src/lib/chat/__tests__/skill-router.test.ts
```

Expected: all tests pass including new suite.

---

## Task 12: Update `ROUTING_BEHAVIOR.md`

**Files:**
- Modify: `artifacts/api-server/src/lib/chat/ROUTING_BEHAVIOR.md`

- [ ] **Step 1: Replace the file with updated content**

```markdown
# Chat Skill Routing Behavior

Reference document for the chat skill-routing pipeline implemented in
`skill-router.ts` and orchestrated by `resolve-system-prompt.ts`.

---

## Routing Modes

| Mode | Behavior |
|---|---|
| `none` | No skill injected. Prompt contains identity + best practices + attachments only. |
| `auto` | Deterministic scoring first; LLM disambiguates if needed. No fallback-to-all. |
| `explicit` | Exactly the skill(s) the user pinned in the chat composer. Falls through to `auto` if no valid slugs. |
| `debug_all` | **Development only.** Injects every active skill body; bypasses cap and token budget. Blocked in production. |

**Unknown/legacy mode strings** are mapped before use:

- `"all"` → `debug_all`
- `"classified"` → `auto`
- anything else unknown → `auto` (safe default)

`debug_all` is additionally guarded by `guardDebugMode()`: if `NODE_ENV === "production"`,
it is downgraded to `auto` and a warning is logged.

---

## Routing Priority Order (auto mode)

```
1. Explicit selection (mode === "explicit" with valid slugs) → wins immediately
2. Deterministic scoring (triggers + attachment boosts) → single clear winner ≥ autoThreshold → wins
3. Ambiguous deterministic (≥2 candidates within ambiguousGap of top) → LLM disambiguates
4. Zero deterministic matches + strong attachment context → LLM routing attempt
5. Zero deterministic matches + no strong context → no skill selected
```

---

## Control-Plane-Tunable Values

The following routing values are stored in `ai_chat_lever_config` and editable
via the Control Plane **Advanced Routing Tuning** section. Changes take effect
on the next chat turn with no restart.

| Field | Default | Range | Controls |
|---|---|---|---|
| `autoThreshold` | 0.3 | [0.0, 1.0] | Min score for a deterministic match |
| `triggerWeight` | 0.3 | [0.0, 2.0] | Score added per matching trigger example |
| `negativeTriggerWeight` | 0.5 | [0.0, 2.0] | Score subtracted per negative trigger |
| `ambiguousGap` | 0.15 | [0.0, 0.5] | Gap within which candidates are "tied" → LLM called |
| `llmConfidenceThreshold` | 0.5 | [0.0, 1.0] | Min LLM confidence to accept a selection |
| `coverBoost` | 0.3 | [0.0, 2.0] | Boost when cover signal detected |
| `boostTailorPlusJob` | 0.4 | [0.0, 2.0] | Boost for tailor-slugs with base_resume+job |
| `boostResumePlusJob` | 0.2 | [0.0, 2.0] | Boost for resume-slugs with base_resume+job |
| `boostAuditTailoredJob` | 0.4 | [0.0, 2.0] | Boost for audit-slugs with tailored_resume+job |
| `boostAuditTailoredOnly` | 0.2 | [0.0, 2.0] | Boost for audit-slugs with tailored_resume (no job) |
| `historyTurnLimit` | 20 | [1, 100] | Conversation history turns fed to model per turn |
| `skillTokenBudget` | 1500 | [0, ∞) | Max tokens of injected skill bodies |
| `maxSelectedSkills` | 1 | [1, 2] | Max skills injected (UI/schema validated) |

---

## Structural Safety Constants (code-only, non-tunable)

| Constant | Value | Purpose |
|---|---|---|
| `HARD_MAX_SKILLS_CEILING` | 2 | Absolute ceiling — cannot be exceeded via config; exported from `skill-router.ts` so UI validation can reference it |
| `CHARS_PER_TOKEN` | 4 | Token estimation denominator for skill budget; in `token-budget.ts` |
| `DEFAULT_MODEL_MAX_TOKENS` | 4096 | Fallback max_tokens when a model config row has null maxTokens; in `stream-openrouter.ts` |

---

## Deterministic Scoring

`scoreSkills(message, attachmentKinds, skills, config)` returns a score per skill:

```
score = Σ triggerWeight for each triggerExample present in message (case-insensitive substring)
      − Σ negativeTriggerWeight for each negativeTrigger present in message
      + attachmentBoost (see Attachment Boosts table)
```

**Winner logic:**
- Filter candidates where `score >= autoThreshold`
- If 0 candidates → see attachment-context path below
- If 1 candidate above threshold → select it (no LLM)
- If ≥2 candidates within `ambiguousGap` of the top → LLM disambiguates
- Otherwise top candidate wins

---

## Attachment Boosts

Applied deterministically before the threshold check. Boosts are based on
attachment kinds present in the current turn. All boost amounts are tunable
via the Control Plane.

| Attachment combo | Slug condition | Boost field |
|---|---|---|
| `base_resume` + `job` | slug contains `"tailor"` or `"tailored-resume"` | `boostTailorPlusJob` (default 0.4) |
| `base_resume` + `job` | slug contains `"resume"` | `boostResumePlusJob` (default 0.2) |
| `tailored_resume` + `job` | slug contains `"audit"` or `"resume-audit"` | `boostAuditTailoredJob` (default 0.4) |
| `tailored_resume` only | slug contains `"audit"` | `boostAuditTailoredOnly` (default 0.2) |
| "cover" in message text or attachments | slug contains `"cover"` | `coverBoost` (default 0.3) |

---

## LLM Router

The cheap LLM router (`classifyWithLLM`) is called when:

1. Deterministic candidates are ambiguous (≥2 within `ambiguousGap` of top score)
2. Zero deterministic matches **and** strong attachment context exists:
   `attachmentKinds` includes `base_resume`, `tailored_resume`, or `job`

**Strong attachment** = any of `["base_resume", "tailored_resume", "job"]` present.
`claims` and `document` attachments do **not** qualify as strong context.

**Fail-closed confidence handling:**
- If the LLM returns a confidence value that is missing, non-numeric, `NaN`, `Infinity`,
  negative, or > 1.0, `classifyWithLLM` returns `null` (no skill selected).
- If `classifyWithLLM` returns results, `routeSkills` additionally filters by
  `llmConfidenceThreshold`: any result with score below the threshold is dropped.
- In the **ambiguous path**: if all LLM results are below threshold, falls back to
  top deterministic match (not no-skill).
- In the **zero-match attachment path**: if all LLM results are below threshold,
  returns no-skill (no fallback).

**Unknown slugs**: LLM results with slugs not in the active skill set are silently
filtered both in `classifyWithLLM` (server-side) and in `routeSkills` (defense-in-depth).

**Router system prompt (`ROUTER_SYSTEM_PROMPT`):**
Currently hardcoded in `resolve-system-prompt.ts`. It governs what the LLM returns.
_Follow-up:_ Seed into `ai_prompt_versions` under `taskScope=skill_routing` so it is
editable via the Control Plane. `classifyWithLLM` already tries `skill_routing` scope
first, so the migration path is low-risk.

---

## No-Fallback-to-All Rule

**This is a hard invariant.** No code path in `auto`, `explicit`, or `none` mode
can inject all active skills. The only path that injects all skills is `debug_all`,
and that is blocked in production.

If you see all skills injected in a non-debug run, that is a bug.

---

## Max Selected Skills

- Config: `maxSelectedSkills` (DB lever, default 1, range [1, 2])
- Structural ceiling: `HARD_MAX_SKILLS_CEILING = 2` (code constant, exported from `skill-router.ts`)
- Schema validation (`openapi.yaml`): `maximum: 2` on `UpdateChatLeverConfigBody.maxSelectedSkills`
- UI validation: `max={2}` on the Control Plane input
- `debug_all` bypasses both limits

---

## Skill Catalog in Prompt

**No catalog is injected.** The comment "catalog only" in routing reasons refers to
the system prompt having no skill body — the model sees identity + best practices +
attachment context. The router accesses skill metadata internally, but the main model
never sees a skill catalog listing. `catalog = []` always.

---

## Production Behavior

| Scenario | Result |
|---|---|
| `debug_all` in dev | All skill bodies injected, cap/budget bypassed |
| `debug_all` in prod (`NODE_ENV=production`) | Downgraded to `auto`, warning logged |
| Unknown routing mode string in DB | `asMode()` maps to `auto` |
| LLM returns invalid/missing confidence | `classifyWithLLM` returns `null` → no skill (fail closed) |
| LLM returns slug not in active skill set | Filtered out at both `classifyWithLLM` and `routeSkills` |
| LLM confidence below `llmConfidenceThreshold` | Filtered: ambiguous path falls back to deterministic; attachment path → no skill |
| Skill catalog in prompt | Never — `catalog = []` always; router sees metadata, model sees only selected bodies |
```

---

## Task 13: Run Full Verification Gate

- [ ] **Step 1: Build all libs**

```
node ./node_modules/typescript/bin/tsc --build
```

- [ ] **Step 2: Typecheck api-server**

```
cd artifacts/api-server && node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```

- [ ] **Step 3: Run all api-server tests**

```
cd artifacts/api-server && node --env-file-if-exists=../../.env ./node_modules/.bin/vitest run
```

Expected: all tests pass including the 12+ new tests in the routing config suite.

- [ ] **Step 4: Build dashboard**

```
cd artifacts/dashboard && node ./node_modules/vite/bin/vite.js build
```

Expected: no TypeScript errors; build succeeds.

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat(routing): move hardcoded routing values to Control Plane config

- Add 11 tunable columns to ai_chat_lever_config (autoThreshold, triggerWeight,
  negativeTriggerWeight, ambiguousGap, llmConfidenceThreshold, coverBoost,
  4 attachment boost fields, historyTurnLimit)
- RoutingConfig interface + DEFAULT_ROUTING_CONFIG in skill-router.ts
- routingConfig passed from DB through resolveChatPrompt to routeSkills
- classifyWithLLM fails closed on missing/invalid confidence (was: fallback 0.6)
- applyConfidenceFilter validates scores + slug membership in both LLM paths
- HARD_MAX_SKILLS_CEILING exported + documented; CHARS_PER_TOKEN named constant
- DEFAULT_MODEL_MAX_TOKENS named constant replaces inline 4096
- historyTurnLimit read from DB in streamChatCompletion
- Preset save/apply/update include all new routing fields (backward compat)
- RoutingCard: Advanced Routing Tuning collapsible section with validation
- 12 new tests; all existing tests continue to pass
- ROUTING_BEHAVIOR.md updated: CP-tunable vs structural safety tables,
  fail-closed docs, no-fallback-to-all, stale catalog wording removed"
```

---

## Remaining Risks and Follow-ups

| Item | Risk | Follow-up |
|---|---|---|
| `ROUTER_SYSTEM_PROMPT` still hardcoded | Low — can't be tuned via Control Plane | Seed into `ai_prompt_versions` (taskScope=skill_routing). `classifyWithLLM` already tries that scope first, so migration is a seed + remove the explicit `systemPrompt` arg from `callAI`. |
| `MAX_OUTPUT_CHARS = 32_000` in output-validator | Low — observability-only, non-blocking | Add a `maxOutputCharsWarning` lever if needed. Currently a named constant. |
| `real` DB type returns JS float32 precision | Low — weights are display values, not computed sums | Use `numeric(5,3)` if precision becomes an issue. |
| Old presets missing new routing fields | Safe — apply handler falls back to current config via `?? config.field` | No action needed; document in preset notes UI if desired. |
| `historyTurnLimit` adds a second lever config read per chat turn | Negligible — singleton SELECT on indexed primary key | Cache in `resolveChatPrompt` response if profiling shows concern. |
