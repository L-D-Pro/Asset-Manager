import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCcw } from "lucide-react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentCard } from "@/components/ui/content-card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth";

interface ResetTableSummary {
  table: string;
  rowsBefore: number;
}

interface ScopeHealthStatus {
  scope: string;
  hasActiveConfig: boolean;
  activeModelName: string | null;
  requiresFallback: boolean;
  fallbackWired: boolean;
  fallbackModelName: string | null;
  healthy: boolean;
}

interface ModelConfigHealthReport {
  healthy: boolean;
  checkedAt: string;
  scopes: ScopeHealthStatus[];
  unhealthyScopes: string[];
}

interface ResetSummary {
  mode: "app_test_data";
  resetsIdentity: boolean;
  preservedTables: string[];
  resetTables: ResetTableSummary[];
  missingTables: string[];
  totalRowsBefore: number;
  modelConfigHealth?: ModelConfigHealthReport;
}

interface ResetResult extends ResetSummary {
  resetAt: string;
  resetByAdminId: number;
}

const CONFIRMATION = "RESET";

function isConfirmed(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  return normalized === "RESET" || normalized === "RESET APP";
}

export default function AdminResetPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ResetSummary | null>(null);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/test-reset/summary", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to load reset summary");
      }
      setSummary((await response.json()) as ResetSummary);
    } catch {
      toast({
        title: "Failed to load reset summary",
        description: "Refresh the page and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const resetTablesWithRows = useMemo(
    () => summary?.resetTables.filter((row) => row.rowsBefore > 0) ?? [],
    [summary],
  );

  async function handleReset() {
    if (!isConfirmed(confirmation)) return;

    setResetting(true);
    try {
      const response = await fetch("/api/admin/test-reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "RESET APP" }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Reset failed");
      }

      const data = (await response.json()) as ResetResult;
      setResult(data);
      setSummary(data);
      setConfirmation("");
      toast({
        title: "App test data reset",
        description: `${data.totalRowsBefore} rows cleared and identity counters restarted.`,
      });
    } catch (error) {
      toast({
        title: "Reset failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setResetting(false);
    }
  }

  if (user?.role !== "admin") {
    return (
      <ContentCard>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
        </CardHeader>
      </ContentCard>
    );
  }

  return (
    <div>
      <PageHeader
        title="Admin Reset"
        subtitle="Clear testing data and restart visible counters while preserving app configuration."
        variant="admin"
      />

      <ContentCard>
        <CardHeader>
          <div>
            <div>
              <CardTitle>
                <RefreshCcw />
                Reset App Test Data
              </CardTitle>
              <p>
                This clears operational records like jobs, resumes, cover letters, wizard saves, attempts,
                applications, feedback, and run history. It also restarts their identity counters.
              </p>
            </div>
            <Badge variant="outline">Admin only</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div>
            <div>
              <AlertTriangle />
              <div>
                <p>This is destructive for app data.</p>
                <p>
                  Preserved: admin users, AI model configs, prompt versions, invite codes, usage limit settings,
                  UI shell config, best practices, job source config, site adapters, and waitlist leads.
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div>Loading reset summary...</div>
          ) : summary ? (
            <div>
              <div>
                <p>Rows to clear</p>
                <p>{summary.totalRowsBefore}</p>
              </div>
              <div>
                <p>Tables reset</p>
                <p>{summary.resetTables.length}</p>
              </div>
              <div>
                <p>Identity counters</p>
                <p>{summary.resetsIdentity ? "Restarted to 1" : "Preserved"}</p>
              </div>
            </div>
          ) : null}

          {resetTablesWithRows.length > 0 && (
            <div>
              <p>Tables currently holding data</p>
              <div>
                {resetTablesWithRows.map((row) => (
                  <div key={row.table}>
                    <span>{row.table}</span>
                    <Badge variant="secondary">{row.rowsBefore}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary?.modelConfigHealth && (
            <div>
              <div>
                {summary.modelConfigHealth.healthy ? (
                  <CheckCircle2 />
                ) : (
                  <AlertTriangle />
                )}
                <div>
                  <p>
                    {summary.modelConfigHealth.healthy
                      ? "AI model configs are healthy"
                      : `AI model config issues: ${summary.modelConfigHealth.unhealthyScopes.join(", ")}`}
                  </p>
                  {!summary.modelConfigHealth.healthy && (
                    <p>
                      After reset, model configs are re-seeded automatically. Visit AI Config to verify.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {result && (
            <div>
              <div>
                <CheckCircle2 />
                Reset completed at {new Date(result.resetAt).toLocaleString()}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="reset-confirmation">
              Type RESET to confirm
            </label>
            <div>
              <Input
                id="reset-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={CONFIRMATION}
                autoComplete="off"
              />
              <Button
                variant="destructive"
                onClick={() => void handleReset()}
                disabled={!isConfirmed(confirmation) || resetting}
              >
                {resetting ? "Resetting..." : "Reset App"}
              </Button>
            </div>
          </div>
        </CardContent>
      </ContentCard>
    </div>
  );
}
