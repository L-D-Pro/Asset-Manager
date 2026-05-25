import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCcw } from "lucide-react";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";

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

function isConfirmed(value: string): boolean {
  const n = value.trim().toUpperCase();
  return n === "RESET" || n === "RESET APP";
}

export default function AdminResetPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [summary, setSummary] = useState<ResetSummary | null>(null);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/test-reset/summary", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load reset summary");
      setSummary((await res.json()) as ResetSummary);
    } catch {
      toast({ title: "Failed to load reset summary", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void fetchSummary(); }, [fetchSummary]);

  const resetTablesWithRows = useMemo(
    () => summary?.resetTables.filter((row) => row.rowsBefore > 0) ?? [],
    [summary],
  );

  async function handleReset() {
    if (!isConfirmed(confirmation)) return;
    setResetting(true);
    try {
      const res = await fetch("/api/admin/test-reset", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "RESET APP" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Reset failed");
      }
      const data = (await res.json()) as ResetResult;
      setResult(data);
      setConfirmation("");
      toast({ title: `Reset complete · ${data.totalRowsBefore} rows cleared` });
      void fetchSummary();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Reset failed", variant: "destructive" });
    } finally {
      setResetting(false);
    }
  }

  if (user?.role !== "admin") {
    return (
      <div className="page fade-up">
        <div className="card flat" style={{ padding: 32, textAlign: "center" }}>
          <div className="dim" style={{ fontSize: 13 }}>Access denied.</div>
        </div>
      </div>
    );
  }

  const canReset = isConfirmed(confirmation);

  return (
    <div className="page fade-up" style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 22 }}>
        <div className="eyebrow">admin · danger zone</div>
        <h1 className="h-display" style={{ marginTop: 4 }}>Reset <em>· clear app test data</em></h1>
      </div>

      {/* Warning banner */}
      <div className="card flat" style={{
        borderColor: "var(--warn)", background: "color-mix(in oklch, var(--warn) 8%, var(--card))",
        padding: "14px 18px", marginBottom: 14, display: "flex", gap: 12, alignItems: "flex-start",
      }}>
        <AlertTriangle size={16} strokeWidth={2} style={{ color: "var(--warn)", flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--warn)", marginBottom: 4 }}>Destructive action</div>
          <div className="dim" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            Clears jobs, resumes, cover letters, wizard saves, attempts, applications, feedback, and run history.
            Restarts identity counters. Preserved: admin users, AI configs, prompt versions, invite codes,
            usage limit settings, best practices, job source config, site adapters, and waitlist leads.
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-h">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RefreshCcw size={14} strokeWidth={2} style={{ color: "var(--ink-3)" }} />
            <h2 className="card-title">Reset app test data</h2>
          </div>
          <span className="chip ghost" style={{ fontSize: 10.5 }}>Admin only</span>
        </div>
        <div style={{ padding: "14px 18px" }}>
          {loading ? (
            <div className="dim" style={{ fontSize: 13 }}>Loading summary…</div>
          ) : summary ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
              <Stat label="Rows to clear" value={summary.totalRowsBefore.toLocaleString()} />
              <Stat label="Tables reset" value={String(summary.resetTables.length)} />
              <Stat label="Identity counters" value={summary.resetsIdentity ? "Restarted" : "Preserved"} />
            </div>
          ) : null}

          {resetTablesWithRows.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div className="label" style={{ marginBottom: 8 }}>Tables currently holding data</div>
              <div className="card flat" style={{ overflow: "hidden" }}>
                <div className="row-list">
                  {resetTablesWithRows.map((row) => (
                    <div key={row.table} className="row" style={{ gridTemplateColumns: "1fr 80px", cursor: "default" }}>
                      <span className="mono" style={{ fontSize: 12.5 }}>{row.table}</span>
                      <span className="mono dim" style={{ fontSize: 12 }}>{row.rowsBefore} rows</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {summary?.modelConfigHealth && (
            <div style={{
              display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px",
              borderRadius: "var(--r-lg)",
              background: summary.modelConfigHealth.healthy
                ? "color-mix(in oklch, var(--success) 8%, var(--paper-2))"
                : "color-mix(in oklch, var(--warn) 8%, var(--paper-2))",
              marginBottom: 14,
            }}>
              {summary.modelConfigHealth.healthy ? (
                <CheckCircle2 size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 1 }} />
              ) : (
                <AlertTriangle size={14} style={{ color: "var(--warn)", flexShrink: 0, marginTop: 1 }} />
              )}
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>
                  {summary.modelConfigHealth.healthy
                    ? "AI model configs are healthy"
                    : `AI config issues: ${summary.modelConfigHealth.unhealthyScopes.join(", ")}`}
                </div>
                {!summary.modelConfigHealth.healthy && (
                  <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
                    After reset, model configs are re-seeded automatically. Visit AI Config to verify.
                  </div>
                )}
              </div>
            </div>
          )}

          {result && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
              borderRadius: "var(--r-lg)", background: "color-mix(in oklch, var(--success) 8%, var(--paper-2))",
              marginBottom: 14,
            }}>
              <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
              <span style={{ fontSize: 12.5 }}>
                Reset completed · {new Date(result.resetAt).toLocaleString()}
              </span>
            </div>
          )}

          {/* Confirm + action */}
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Type RESET to confirm</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="RESET"
                autoComplete="off"
                style={{ maxWidth: 180 }}
              />
              <button
                type="button"
                className="btn"
                style={{
                  background: canReset ? "var(--red, #e53e3e)" : undefined,
                  color: canReset ? "#fff" : undefined,
                  borderColor: canReset ? "var(--red, #e53e3e)" : undefined,
                  opacity: !canReset || resetting ? 0.5 : 1,
                  cursor: !canReset || resetting ? "default" : "pointer",
                }}
                onClick={() => void handleReset()}
                disabled={!canReset || resetting}
              >
                {resetting ? "Resetting…" : "Reset app"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card flat" style={{ padding: "12px 14px" }}>
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      <div className="h-display" style={{ fontSize: 22 }}>{value}</div>
    </div>
  );
}
