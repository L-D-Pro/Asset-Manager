import { and, eq } from "drizzle-orm";
import { db, aiPromptVersionsTable } from "@workspace/db";
import { logger } from "./logger";

export interface ResolvedPrompt {
  systemPrompt: string;
  userPrompt: string;
  promptVersionId: number | null;
  promptLabel: string | null;
}

/**
 * Applies the active prompt version for a task when present.
 *
 * `userPromptTemplate` supports a single `{{userPrompt}}` placeholder. If the
 * placeholder is missing, the template is prepended as extra instruction so
 * existing pipeline prompts still provide the runtime context.
 */
export async function resolvePromptForTask(
  taskScope: string,
  fallbackSystemPrompt: string,
  fallbackUserPrompt: string,
): Promise<ResolvedPrompt> {
  let row;

  try {
    [row] = await db
      .select()
      .from(aiPromptVersionsTable)
      .where(
        and(
          eq(aiPromptVersionsTable.taskScope, taskScope),
          eq(aiPromptVersionsTable.isActive, true),
        ),
      )
      .orderBy(aiPromptVersionsTable.version)
      .limit(1);
  } catch (error) {
    logger.warn(
      { taskScope, error: error instanceof Error ? error.message : String(error) },
      "Prompt version lookup failed; using fallback prompt",
    );

    return {
      systemPrompt: fallbackSystemPrompt,
      userPrompt: fallbackUserPrompt,
      promptVersionId: null,
      promptLabel: null,
    };
  }

  if (!row) {
    return {
      systemPrompt: fallbackSystemPrompt,
      userPrompt: fallbackUserPrompt,
      promptVersionId: null,
      promptLabel: null,
    };
  }

  logger.debug(
    { taskScope, promptVersionId: row.id, promptLabel: row.label },
    "Using active prompt version",
  );

  const template = row.userPromptTemplate?.trim();
  const userPrompt = template
    ? template.includes("{{userPrompt}}")
      ? template.replaceAll("{{userPrompt}}", fallbackUserPrompt)
      : `${template}\n\n${fallbackUserPrompt}`
    : fallbackUserPrompt;

  return {
    systemPrompt: row.systemPrompt,
    userPrompt,
    promptVersionId: row.id,
    promptLabel: row.label,
  };
}
