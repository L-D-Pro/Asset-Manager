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

interface ResetSummary {
  mode: "app_test_data";
  resetsIdentity: boolean;
  preservedTables: string[];
  resetTables: ResetTableSummary[];
  missingTables: string[];
  totalRowsBefore: number;
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
    <div className="space-y-8">
      <PageHeader
        title="Admin Reset"
        subtitle="Clear testing data and restart visible counters while preserving app configuration."
        variant="admin"
      />

      <ContentCard className="rounded-2xl">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RefreshCcw className="h-5 w-5 text-primary" />
                Reset App Test Data
              </CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                This clears operational records like jobs, resumes, cover letters, wizard saves, attempts,
                applications, feedback, and run history. It also restarts their identity counters.
              </p>
            </div>
            <Badge variant="outline">Admin only</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="space-y-2">
                <p className="font-semibold text-destructive">This is destructive for app data.</p>
                <p className="text-sm text-muted-foreground">
                  Preserved: admin users, AI model configs, prompt versions, invite codes, usage limit settings,
                  UI shell config, best practices, job source config, site adapters, and waitlist leads.
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border p-4 text-sm text-muted-foreground">Loading reset summary...</div>
          ) : summary ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Rows to clear</p>
                <p className="mt-2 text-3xl font-bold">{summary.totalRowsBefore}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tables reset</p>
                <p className="mt-2 text-3xl font-bold">{summary.resetTables.length}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Identity counters</p>
                <p className="mt-2 text-sm font-semibold">{summary.resetsIdentity ? "Restarted to 1" : "Preserved"}</p>
              </div>
            </div>
          ) : null}

          {resetTablesWithRows.length > 0 && (
            <div className="rounded-xl border p-4">
              <p className="mb-3 text-sm font-semibold">Tables currently holding data</p>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {resetTablesWithRows.map((row) => (
                  <div key={row.table} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    <span className="font-mono">{row.table}</span>
                    <Badge variant="secondary">{row.rowsBefore}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Reset completed at {new Date(result.resetAt).toLocaleString()}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label htmlFor="reset-confirmation" className="text-sm font-semibold">
              Type RESET to confirm
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
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
