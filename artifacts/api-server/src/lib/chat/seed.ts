import { and, eq, sql } from "drizzle-orm";
import {
  db,
  aiModelConfigsTable,
  aiPromptVersionsTable,
  aiChatLeverConfigTable,
  aiChatLeverPresetsTable,
  type ChatSkillMetadata,
  type ChatLeverSnapshot,
} from "@workspace/db";

import { logger } from "../logger";
import { loadSkills } from "./skill-loader";
import { IDENTITY_BLOCK } from "./system-prompt";

const TASK_SCOPE = "chat";

/**
 * Per-skill router metadata for the vendored skills, keyed by slug
 * (`ai_prompt_versions.label`). Trigger phrases mirror the regex patterns that
 * previously lived in `intent-classifier.ts`. Lower `priority` wins ties.
 */
const VENDORED_SKILL_METADATA: Record<string, ChatSkillMetadata> = {
  "tailored-resume-generator": {
    routerDescription:
      "Analyze a job description and generate a tailored resume highlighting relevant experience.",
    triggerExamples: [
      "tailor my resume",
      "tailored resume",
      "tailor resume",
      "customize my resume",
      "resume for this job",
      "resume for the role",
    ],
    negativeTriggers: ["cover letter"],
    taskTypes: ["resume"],
    priority: 1,
    status: "active",
  },
  "cover-letter-generator": {
    routerDescription:
      "Create personalized, compelling cover letters from a resume and job description.",
    triggerExamples: [
      "cover letter",
      "application letter",
      "write a letter",
      "letter to the hiring",
    ],
    negativeTriggers: [],
    taskTypes: ["cover_letter"],
    priority: 1,
    status: "active",
  },
  "resume-ats-optimizer": {
    routerDescription:
      "Optimize resumes for Applicant Tracking Systems (ATS), check compatibility, and analyze keyword match.",
    triggerExamples: [
      "ats",
      "applicant tracking",
      "keyword match",
      "optimize my resume",
      "resume score",
      "ats compatibility",
    ],
    negativeTriggers: ["cover letter", "tailor my resume"],
    taskTypes: ["resume"],
    priority: 2,
    status: "active",
  },
};

/** Build minimal default metadata for a custom (non-vendored) skill. */
function defaultSkillMetadata(routerDescription: string): ChatSkillMetadata {
  return {
    routerDescription,
    triggerExamples: [],
    negativeTriggers: [],
    taskTypes: ["chat"],
    priority: 50,
    status: "active",
  };
}

const SONNET_MODEL = "anthropic/claude-sonnet-4.6";
const OPUS_MODEL = "anthropic/claude-opus-4-7";

/**
 * Idempotent bootstrap for the chat MVP runtime config:
 *
 *   1. Inserts one `ai_prompt_versions` row per vendored skill (taskScope='chat',
 *      label=<slug>, systemPrompt=<full SKILL.md body>, isActive=true) if missing.
 *   2. Ensures Sonnet 4.6 + Opus 4.7 rows exist in `ai_model_configs` under
 *      `taskScope='chat'`, with Opus chained as the Sonnet fallback.
 *
 * Run this once after migrations. Safe to re-run — every operation is gated by
 * a `where(taskScope, ...)` check.
 */
export async function seedChatRuntime(): Promise<void> {
  // ── 1. Prompt versions (one per vendored skill) ─────────────────────────
  for (const skill of loadSkills()) {
    const [existing] = await db
      .select({ id: aiPromptVersionsTable.id })
      .from(aiPromptVersionsTable)
      .where(
        and(
          eq(aiPromptVersionsTable.taskScope, TASK_SCOPE),
          eq(aiPromptVersionsTable.label, skill.slug),
        ),
      )
      .limit(1);

    if (existing) {
      logger.info({ slug: skill.slug, id: existing.id }, "chat skill prompt version already present");
      continue;
    }

    const [inserted] = await db
      .insert(aiPromptVersionsTable)
      .values({
        taskScope: TASK_SCOPE,
        label: skill.slug,
        version: 1,
        systemPrompt: skill.body,
        isActive: true,
        roleLabel: skill.name,
        skillTags: [skill.slug],
        notes: `Vendored from skills.sh on chat MVP bootstrap. Description: ${skill.description}`,
      })
      .returning({ id: aiPromptVersionsTable.id });
    logger.info({ slug: skill.slug, id: inserted!.id }, "chat skill prompt version seeded");
  }

  // ── 2. Model configs (Sonnet primary, Opus fallback) ────────────────────
  const opusId = await ensureModelConfig({
    taskScope: TASK_SCOPE,
    modelName: OPUS_MODEL,
    priority: 2,
    maxTokens: 4096,
    costPerInputToken: "0.000015",
    costPerOutputToken: "0.000075",
  });

  await ensureModelConfig({
    taskScope: TASK_SCOPE,
    modelName: SONNET_MODEL,
    priority: 1,
    fallbackModelId: opusId,
    maxTokens: 4096,
    costPerInputToken: "0.000003",
    costPerOutputToken: "0.000015",
  });

  // ── 3. Chat Control Plane lever config (singleton) ──────────────────────
  await ensureChatLeverConfig();

  // ── 4. Backfill skill metadata on existing prompt versions ──────────────
  await backfillSkillMetadata();

  // ── 5. Migrate legacy routing modes to defaults ─────────────────────────
  await migrateRoutingModes();

  logger.info("chat runtime seed complete");
}

/**
 * Populate the `metadata` JSONB column on each chat prompt version with its
 * ChatSkillMetadata. Vendored skills get curated trigger/negative phrases;
 * custom skills get a minimal default derived from their notes/role label.
 *
 * The metadata drives the skill router's deterministic + LLM classifier, so we
 * must have real per-skill values before `auto` routing can function. Idempotent:
 * rows whose metadata already carries a `routerDescription` are left untouched.
 */
async function backfillSkillMetadata(): Promise<void> {
  const rows = await db
    .select({
      id: aiPromptVersionsTable.id,
      label: aiPromptVersionsTable.label,
      roleLabel: aiPromptVersionsTable.roleLabel,
      notes: aiPromptVersionsTable.notes,
      metadata: aiPromptVersionsTable.metadata,
    })
    .from(aiPromptVersionsTable)
    .where(eq(aiPromptVersionsTable.taskScope, TASK_SCOPE));

  if (rows.length === 0) {
    logger.warn("no chat prompt versions found — skipping skill metadata backfill");
    return;
  }

  let updated = 0;
  for (const row of rows) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    if (typeof meta.routerDescription === "string" && meta.routerDescription.length > 0) {
      continue; // already backfilled
    }

    const vendored = VENDORED_SKILL_METADATA[row.label];
    const skillMeta: ChatSkillMetadata =
      vendored ?? defaultSkillMetadata(row.roleLabel ?? row.notes ?? row.label);

    await db
      .update(aiPromptVersionsTable)
      .set({ metadata: skillMeta })
      .where(eq(aiPromptVersionsTable.id, row.id));
    updated += 1;
  }

  logger.info({ updated, total: rows.length }, "skill metadata backfill complete");
}

/** Map a legacy routing-mode value to the new vocabulary. */
function mapLegacyMode(mode: string): string {
  if (mode === "classified") return "auto";
  if (mode === "all") return "debug_all";
  return mode; // none | auto | explicit | debug_all are already valid
}

/**
 * Migrate legacy routing modes to the new vocabulary, in place.
 *
 *   classified → auto      all → debug_all
 *
 * Applies to the singleton config row AND every saved preset snapshot, and
 * backfills `skillTokenBudget` / `maxSelectedSkills` where a snapshot predates
 * those fields. Idempotent — rows already on the new vocabulary are skipped.
 */
async function migrateRoutingModes(): Promise<void> {
  // ── Config row ──────────────────────────────────────────────────────────
  const [config] = await db
    .select({ id: aiChatLeverConfigTable.id, routingMode: aiChatLeverConfigTable.skillRoutingMode })
    .from(aiChatLeverConfigTable)
    .limit(1);

  if (config) {
    const mapped = mapLegacyMode(config.routingMode);
    if (mapped !== config.routingMode) {
      await db
        .update(aiChatLeverConfigTable)
        .set({ skillRoutingMode: mapped })
        .where(eq(aiChatLeverConfigTable.id, config.id));
      logger.info({ id: config.id, from: config.routingMode, to: mapped }, "config routing mode migrated");
    }
  }

  // ── Preset snapshots ────────────────────────────────────────────────────
  const presets = await db
    .select({ id: aiChatLeverPresetsTable.id, snapshot: aiChatLeverPresetsTable.snapshot })
    .from(aiChatLeverPresetsTable);

  let migrated = 0;
  for (const preset of presets) {
    const snap = preset.snapshot;
    const mappedMode = mapLegacyMode(snap.skillRoutingMode);
    const needsMode = mappedMode !== snap.skillRoutingMode;
    const needsBudget = snap.skillTokenBudget == null;
    const needsMax = snap.maxSelectedSkills == null;
    if (!needsMode && !needsBudget && !needsMax) continue;

    const next: ChatLeverSnapshot = {
      ...snap,
      skillRoutingMode: mappedMode,
      skillTokenBudget: snap.skillTokenBudget ?? 1500,
      maxSelectedSkills: snap.maxSelectedSkills ?? 1,
    };
    await db
      .update(aiChatLeverPresetsTable)
      .set({ snapshot: next })
      .where(eq(aiChatLeverPresetsTable.id, preset.id));
    migrated += 1;
  }

  if (migrated > 0) logger.info({ migrated, total: presets.length }, "preset snapshots migrated");
}

/**
 * Ensure the singleton `ai_chat_lever_config` row exists, seeded with the
 * default identity block and all levers enabled.
 */
async function ensureChatLeverConfig(): Promise<void> {
  const [existing] = await db
    .select({ id: aiChatLeverConfigTable.id })
    .from(aiChatLeverConfigTable)
    .limit(1);

  if (existing) {
    logger.info({ id: existing.id }, "chat lever config already present");
    return;
  }

  const [inserted] = await db
    .insert(aiChatLeverConfigTable)
    .values({ identityText: IDENTITY_BLOCK })
    .returning({ id: aiChatLeverConfigTable.id });
  logger.info({ id: inserted!.id }, "chat lever config seeded");
}

interface EnsureModelConfigArgs {
  taskScope: string;
  modelName: string;
  priority: number;
  fallbackModelId?: number;
  maxTokens: number;
  costPerInputToken: string;
  costPerOutputToken: string;
}

async function ensureModelConfig(args: EnsureModelConfigArgs): Promise<number> {
  const [existing] = await db
    .select({ id: aiModelConfigsTable.id })
    .from(aiModelConfigsTable)
    .where(
      and(
        eq(aiModelConfigsTable.taskScope, args.taskScope),
        eq(aiModelConfigsTable.modelName, args.modelName),
      ),
    )
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const [inserted] = await db
    .insert(aiModelConfigsTable)
    .values({
      taskScope: args.taskScope,
      provider: "openrouter",
      modelName: args.modelName,
      isActive: true,
      priority: args.priority,
      fallbackModelId: args.fallbackModelId ?? null,
      maxTokens: args.maxTokens,
      costPerInputToken: args.costPerInputToken,
      costPerOutputToken: args.costPerOutputToken,
    })
    .returning({ id: aiModelConfigsTable.id });

  logger.info(
    { taskScope: args.taskScope, modelName: args.modelName, id: inserted!.id },
    "chat model config seeded",
  );
  return inserted!.id;
}
