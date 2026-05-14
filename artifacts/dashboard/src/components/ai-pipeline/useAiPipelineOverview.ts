import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { AiPipelineTaskSummary } from "./types";

export const AI_PIPELINE_OVERVIEW_QUERY_KEY = ["ai-pipeline-overview"] as const;

/**
 * Fetches the unified per-task AI pipeline summary.
 *
 * If the backend route is not yet deployed (404), resolves to an empty
 * array so the page renders an empty state rather than throwing. Any
 * other failure is propagated so React Query can surface it.
 */
async function fetchAiPipelineOverview(signal?: AbortSignal): Promise<AiPipelineTaskSummary[]> {
  const response = await fetch("/api/ai-pipeline/overview", {
    credentials: "include",
    headers: { accept: "application/json" },
    signal,
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(`Failed to load AI pipeline overview (HTTP ${response.status})`);
  }

  const data = (await response.json()) as AiPipelineTaskSummary[];
  if (!Array.isArray(data)) {
    throw new Error("AI pipeline overview returned an unexpected payload shape");
  }
  return data;
}

export function useAiPipelineOverview(): UseQueryResult<AiPipelineTaskSummary[]> {
  return useQuery({
    queryKey: AI_PIPELINE_OVERVIEW_QUERY_KEY,
    queryFn: ({ signal }) => fetchAiPipelineOverview(signal),
    staleTime: 30_000,
  });
}
