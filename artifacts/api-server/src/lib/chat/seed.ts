import { and, eq } from "drizzle-orm";
import { db, aiModelConfigsTable, aiPromptVersionsTable } from "@workspace/db";

import { logger } from "../logger";
import { loadSkills } from "./skill-loader";

const TASK_SCOPE = "chat";

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

  logger.info("chat runtime seed complete");
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
