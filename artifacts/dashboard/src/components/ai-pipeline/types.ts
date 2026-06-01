/**
 * Shared types for the AI Pipeline Hub.
 *
 * This local interface mirrors the OpenAPI contract for
 * `GET /api/ai-pipeline/overview` that the backend agent is implementing
 * in parallel. Once codegen runs against the merged OpenAPI spec, the
 * parent agent will swap consumers over to the generated
 * `AiPipelineTaskSummary` from `@workspace/api-client-react`.
 */
export interface AiPipelineTaskSummary {
  taskScope: string;
  activePromptVersionId: number | null;
  activePromptLabel: string | null;
  roleLabel: string | null;
  modelName: string | null;
  modelConfigId: number | null;
  bestPracticesEnabledCount: number;
  trainingExampleCount: number;
}

export const TASK_SCOPES = [
  "jd_parsing",
  "claim_generation",
  "gap_analysis",
  "resume_tailoring",
  "cover_letter",
  "job_research",
  "market_research",
  "proposal_drafting",
  "quality_check",
] as const;

export type TaskScope = (typeof TASK_SCOPES)[number];

/**
 * Domain mapping used by the BestPracticesTab.
 * Mirrors the conventions used in `pages/admin/best-practices` and the
 * server-side `best_practices` rows seeded for resume / cover letter / general.
 */
export function bestPracticesDomainForTask(taskScope: string): string {
  if (taskScope === "resume_tailoring") return "resume_tailoring";
  if (taskScope === "cover_letter") return "cover_letter";
  if (taskScope === "quality_check") return "quality_check";
  return "general";
}
