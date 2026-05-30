import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  aiPromptVersionsTable,
  aiModelConfigsTable,
  aiTrainingExamplesTable,
  bestPracticesTable,
} from "@workspace/db";
import { GetAiPipelineOverviewResponse } from "@workspace/api-zod";
import type { JobOpsRequest } from "../lib/http-types";
import { currentUserId } from "../lib/ownership";

/**
 * Canonical AI task scopes exposed by the AI Pipeline Hub. Every entry yields
 * one row in the overview response, even when no DB rows exist for that scope.
 */
const KNOWN_TASK_SCOPES = [
  "chat",
  "skill_routing",
  "jd_parsing",
  "claim_generation",
  "gap_analysis",
  "resume_tailoring",
  "cover_letter",
  "job_research",
  "market_research",
  "proposal_drafting",
] as const;

type KnownTaskScope = (typeof KNOWN_TASK_SCOPES)[number];

/**
 * Per-task scope → best_practices.domain mapping. The hub surfaces enabled
 * counts using the same domain mapping the prompt pipeline applies at runtime.
 */
function domainForTaskScope(taskScope: KnownTaskScope): string {
  if (taskScope === "resume_tailoring") return "resume_tailoring";
  if (taskScope === "cover_letter") return "cover_letter";
  return "general";
}

interface BestPracticeItem {
  description?: string;
}

interface BestPracticesRow {
  domain: string | null;
  items: unknown;
  hardcodedGuards: unknown;
}

/**
 * Mirrors `formatBestPracticesForPrompt` filtering: items disabled by a
 * `hardcodedGuards[key] === false` entry are not counted as enabled.
 */
function countEnabledItems(row: BestPracticesRow | undefined): number {
  if (!row) return 0;
  const items = Array.isArray(row.items) ? (row.items as BestPracticeItem[]) : [];
  const guards =
    row.hardcodedGuards && typeof row.hardcodedGuards === "object"
      ? (row.hardcodedGuards as Record<string, unknown>)
      : {};
  let count = 0;
  for (const item of items) {
    const description = typeof item?.description === "string" ? item.description : "";
    const guardKey = description.slice(0, 30).toLowerCase().replace(/[^a-z0-9]/g, "_");
    if (guards[guardKey] === false) continue;
    count += 1;
  }
  return count;
}

const router: IRouter = Router();

router.get("/ai-pipeline/overview", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const [activePrompts, activeModels, bestPractices, trainingCounts] = await Promise.all([
    db
      .select({
        id: aiPromptVersionsTable.id,
        taskScope: aiPromptVersionsTable.taskScope,
        label: aiPromptVersionsTable.label,
        roleLabel: aiPromptVersionsTable.roleLabel,
      })
      .from(aiPromptVersionsTable)
      .where(eq(aiPromptVersionsTable.isActive, true)),
    db
      .select({
        id: aiModelConfigsTable.id,
        taskScope: aiModelConfigsTable.taskScope,
        modelName: aiModelConfigsTable.modelName,
        priority: aiModelConfigsTable.priority,
      })
      .from(aiModelConfigsTable)
      .where(eq(aiModelConfigsTable.isActive, true)),
    db
      .select({
        domain: bestPracticesTable.domain,
        items: bestPracticesTable.items,
        hardcodedGuards: bestPracticesTable.hardcodedGuards,
      })
      .from(bestPracticesTable),
    db
      .select({
        taskScope: aiTrainingExamplesTable.taskScope,
        count: sql<number>`count(*)::int`,
      })
      .from(aiTrainingExamplesTable)
      .where(and(eq(aiTrainingExamplesTable.userId, userId), eq(aiTrainingExamplesTable.isActive, true)))
      .groupBy(aiTrainingExamplesTable.taskScope),
  ]);

  // Build lookup maps. Active prompts: keep the first active row per scope
  // (multiple actives may exist; the prompt-router uses asc(version)).
  const promptByScope = new Map<string, (typeof activePrompts)[number]>();
  for (const row of activePrompts) {
    if (!promptByScope.has(row.taskScope)) promptByScope.set(row.taskScope, row);
  }

  // Active models: keep the lowest-priority active row per scope.
  const modelByScope = new Map<string, (typeof activeModels)[number]>();
  for (const row of activeModels) {
    const existing = modelByScope.get(row.taskScope);
    if (!existing || row.priority < existing.priority) {
      modelByScope.set(row.taskScope, row);
    }
  }

  const bestPracticesByDomain = new Map<string, BestPracticesRow>();
  for (const row of bestPractices) {
    if (row.domain) bestPracticesByDomain.set(row.domain, row);
  }

  const trainingCountByScope = new Map<string, number>();
  for (const row of trainingCounts) {
    trainingCountByScope.set(row.taskScope, Number(row.count) || 0);
  }

  const payload = KNOWN_TASK_SCOPES.map((taskScope) => {
    const prompt = promptByScope.get(taskScope);
    const model = modelByScope.get(taskScope);
    const bestPracticesRow = bestPracticesByDomain.get(domainForTaskScope(taskScope));
    return {
      taskScope,
      activePromptVersionId: prompt?.id ?? null,
      activePromptLabel: prompt?.label ?? null,
      roleLabel: prompt?.roleLabel ?? null,
      modelName: model?.modelName ?? null,
      modelConfigId: model?.id ?? null,
      bestPracticesEnabledCount: countEnabledItems(bestPracticesRow),
      trainingExampleCount: trainingCountByScope.get(taskScope) ?? 0,
    };
  });

  // Validate response shape against the generated Zod schema before sending.
  // Surfaces drift between the OpenAPI spec and the route implementation.
  const validated = GetAiPipelineOverviewResponse.parse(payload);
  res.json(validated);
});

export default router;
