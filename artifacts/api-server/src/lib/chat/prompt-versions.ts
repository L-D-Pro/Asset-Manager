import { and, eq } from "drizzle-orm";
import { db, aiPromptVersionsTable } from "@workspace/db";

import { logger } from "../logger";

const TASK_SCOPE = "chat";

/**
 * Resolve the `ai_prompt_versions.id` to attribute a chat turn to, based on the
 * primary skill slug determined by the intent classifier.
 *
 * Falls back to `null` when no row exists yet (e.g. seed not run) — the
 * assistant message still persists, just without variant-stats attribution.
 */
export async function resolveChatPromptVersionId(skillSlug: string): Promise<number | null> {
  const [row] = await db
    .select({ id: aiPromptVersionsTable.id })
    .from(aiPromptVersionsTable)
    .where(
      and(
        eq(aiPromptVersionsTable.taskScope, TASK_SCOPE),
        eq(aiPromptVersionsTable.label, skillSlug),
        eq(aiPromptVersionsTable.isActive, true),
      ),
    )
    .limit(1);

  if (!row) {
    logger.warn(
      { skillSlug, taskScope: TASK_SCOPE },
      "No active ai_prompt_versions row for chat skill — run chat seed",
    );
    return null;
  }
  return row.id;
}
