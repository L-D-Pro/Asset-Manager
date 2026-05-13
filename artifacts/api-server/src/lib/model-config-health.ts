import { eq, and } from "drizzle-orm";
import { db, aiModelConfigsTable } from "@workspace/db";

export interface ScopeHealthStatus {
  scope: string;
  hasActiveConfig: boolean;
  activeModelName: string | null;
  requiresFallback: boolean;
  fallbackWired: boolean;
  fallbackModelName: string | null;
  healthy: boolean;
}

export interface ModelConfigHealthReport {
  healthy: boolean;
  checkedAt: string;
  scopes: ScopeHealthStatus[];
  unhealthyScopes: string[];
}

const MANAGED_SCOPES = [
  "resume_tailoring",
  "cover_letter",
  "claim_generation",
  "jd_parsing",
  "default",
] as const;

const SCOPES_REQUIRING_FALLBACK = new Set(["resume_tailoring", "cover_letter"]);

export async function checkModelConfigHealth(): Promise<ModelConfigHealthReport> {
  const allRows = await db.select().from(aiModelConfigsTable);

  const scopes: ScopeHealthStatus[] = [];

  for (const scope of MANAGED_SCOPES) {
    const scopeRows = allRows.filter((r) => r.taskScope === scope);
    const activeRows = scopeRows.filter((r) => r.isActive);

    const fallbackTargets = new Set(
      activeRows
        .map((r) => r.fallbackModelId)
        .filter((id): id is number => typeof id === "number"),
    );
    const rootCandidates = activeRows.filter((r) => !fallbackTargets.has(r.id));
    const sorted = (rootCandidates.length > 0 ? rootCandidates : activeRows).sort(
      (a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.id - b.id,
    );
    const primaryActive = sorted[0] ?? null;

    const hasActiveConfig = primaryActive !== null;
    const activeModelName = primaryActive?.modelName ?? null;
    const requiresFallback = SCOPES_REQUIRING_FALLBACK.has(scope);

    let fallbackWired = false;
    let fallbackModelName: string | null = null;

    if (requiresFallback && primaryActive?.fallbackModelId != null) {
      const fallbackRow = allRows.find(
        (r) => r.id === primaryActive.fallbackModelId && r.isActive,
      );
      if (fallbackRow) {
        fallbackWired = true;
        fallbackModelName = fallbackRow.modelName;
      }
    }

    const healthy =
      hasActiveConfig && (!requiresFallback || fallbackWired);

    scopes.push({
      scope,
      hasActiveConfig,
      activeModelName,
      requiresFallback,
      fallbackWired,
      fallbackModelName,
      healthy,
    });
  }

  const unhealthyScopes = scopes.filter((s) => !s.healthy).map((s) => s.scope);

  return {
    healthy: unhealthyScopes.length === 0,
    checkedAt: new Date().toISOString(),
    scopes,
    unhealthyScopes,
  };
}
