import { useState, useEffect, useCallback } from "react";
import { Portal } from "@/components/ui/portal";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { Pencil, AlertTriangle, X } from "lucide-react";

interface UsageRecord {
  limit: {
    id: number;
    userId: number;
    weeklyLimit: number;
    weeklyUsed: number;
    totalUsed: number;
    periodStart: string;
  };
  username: string;
  email: string;
}

export default function AdminUsageLimitsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<UsageRecord | null>(null);
  const [newLimit, setNewLimit] = useState(5);
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/usage-limits", { credentials: "include" });
      if (res.ok) setUsers(await res.json() as UsageRecord[]);
    } catch {
      toast({ title: "Failed to load usage data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  async function handleSaveLimit() {
    if (!editUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/usage-limits/${editUser.limit.userId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyLimit: newLimit }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Usage limit updated" });
      void fetchUsers();
      setEditUser(null);
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    } finally {
      setSaving(false);
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

  return (
    <div className="page fade-up" style={{ maxWidth: 1240 }}>
      <div style={{ marginBottom: 22 }}>
        <div className="eyebrow">admin · quotas</div>
        <h1 className="h-display" style={{ marginTop: 4 }}>Usage limits <em>· AI quotas per user</em></h1>
      </div>

      <div className="card">
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 200px 100px 100px 120px 40px",
          alignItems: "center", gap: 14, padding: "10px 18px",
          borderBottom: "1px solid var(--line)", background: "var(--paper-2)",
          fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500,
        }}>
          <span>User</span>
          <span>Weekly usage</span>
          <span>Remaining</span>
          <span>Total used</span>
          <span>Period start</span>
          <span />
        </div>
        <div className="row-list">
          {loading && <div className="dim" style={{ padding: "32px 18px", textAlign: "center", fontSize: 13 }}>Loading…</div>}
          {!loading && users.length === 0 && (
            <div className="dim" style={{ padding: "32px 18px", textAlign: "center", fontSize: 13 }}>
              No usage limits yet. Limits are created when a user registers.
            </div>
          )}
          {users.map((row) => {
            const remaining = row.limit.weeklyLimit - row.limit.weeklyUsed;
            const pct = Math.min(100, row.limit.weeklyLimit > 0 ? (row.limit.weeklyUsed / row.limit.weeklyLimit) * 100 : 0);
            const low = remaining <= 1;
            return (
              <div key={row.limit.id} className="row" style={{ gridTemplateColumns: "1fr 200px 100px 100px 120px 40px", cursor: "default" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{row.username}</div>
                  <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>{row.email}</div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 11.5, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                    <span>{row.limit.weeklyUsed}</span>
                    <span>{row.limit.weeklyLimit}</span>
                  </div>
                  <div className="bar" style={{ height: 5 }}><i style={{ width: `${pct}%`, background: low ? "var(--red)" : undefined }} /></div>
                </div>
                <div>
                  {low ? (
                    <span className="chip warn dot" style={{ fontSize: 11 }}>
                      <AlertTriangle size={10} /> {remaining}
                    </span>
                  ) : (
                    <span className="mono" style={{ fontSize: 13 }}>{remaining}</span>
                  )}
                </div>
                <span className="mono dim" style={{ fontSize: 13 }}>{row.limit.totalUsed}</span>
                <span className="mono dim" style={{ fontSize: 12 }}>
                  {new Date(row.limit.periodStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <button className="btn ghost sm" type="button" onClick={() => { setEditUser(row); setNewLimit(row.limit.weeklyLimit); }}>
                  <Pencil size={12} strokeWidth={1.8} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {editUser && (
        <Portal>
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", padding: 24 }}
          onClick={() => setEditUser(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: 400, background: "var(--card)", border: "1px solid var(--line)",
            borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden",
          }}>
            <div className="card-h">
              <h2 className="card-title">Edit usage limit</h2>
              <button type="button" className="settings-x" onClick={() => setEditUser(null)}><X size={14} strokeWidth={2} /></button>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
                <strong>{editUser.username}</strong> <span className="dim">({editUser.email})</span>
              </div>
              <div className="field">
                <label>Weekly AI request limit</label>
                <input className="input" type="number" value={newLimit} onChange={(e) => setNewLimit(Number(e.target.value) || 0)} min={0} />
              </div>
              <div className="dim" style={{ fontSize: 12.5 }}>
                Current: {editUser.limit.weeklyUsed} used this week · {editUser.limit.totalUsed} total all time.
              </div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost sm" onClick={() => setEditUser(null)}>Cancel</button>
              <button type="button" className="btn primary sm" onClick={handleSaveLimit} disabled={saving}>
                {saving ? "Saving…" : "Save limit"}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
