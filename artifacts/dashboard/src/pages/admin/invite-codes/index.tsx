import { useState, useEffect, useCallback } from "react";
import { Portal } from "@/components/ui/portal";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Copy, CheckCircle, XCircle, Clock, X } from "lucide-react";

interface InviteCode {
  id: number;
  code: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
}

export default function AdminInviteCodesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [maxUses, setMaxUses] = useState(50);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  const fetchCodes = useCallback(async () => {
    try {
      const res = await fetch("/api/invite-codes", { credentials: "include" });
      if (res.ok) setCodes(await res.json() as InviteCode[]);
    } catch {
      toast({ title: "Failed to load invite codes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void fetchCodes(); }, [fetchCodes]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/invite-codes", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxUses, expiresInDays }),
      });
      if (!res.ok) { const e = await res.json() as { error: string }; throw new Error(e.error ?? "Generation failed"); }
      const code = await res.json() as InviteCode;
      setNewCode(code.code);
      toast({ title: "Invite code created" });
      void fetchCodes();
      setShowGenerate(false);
    } catch (err) {
      toast({ title: "Failed to generate", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(id: number) {
    try {
      const res = await fetch(`/api/invite-codes/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Invite code revoked" });
      void fetchCodes();
    } catch {
      toast({ title: "Failed to revoke", variant: "destructive" });
    }
  }

  function copyCode(code: string) {
    void navigator.clipboard.writeText(code).then(() => toast({ title: "Copied to clipboard" }));
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
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div className="eyebrow">admin · access control</div>
          <h1 className="h-display" style={{ marginTop: 4 }}>Invite codes <em>· registration gates</em></h1>
        </div>
        <button className="btn primary" type="button" onClick={() => setShowGenerate(true)} disabled={codes.length >= 10}>
          <Plus size={13} strokeWidth={1.8} /> Generate code
        </button>
      </div>

      {newCode && (
        <div className="card" style={{ background: "var(--accent-bg)", borderColor: "var(--accent-line)", marginBottom: 18, padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
            <div>
              <div className="label" style={{ marginBottom: 4, color: "var(--accent-ink)" }}>New invite code</div>
              <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--accent-ink)", letterSpacing: "0.06em" }}>{newCode}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn sm" type="button" onClick={() => copyCode(newCode)}>
                <Copy size={12} strokeWidth={1.8} /> Copy
              </button>
              <button className="btn ghost sm" type="button" onClick={() => setNewCode(null)}>Dismiss</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 100px 140px 110px 80px",
          alignItems: "center", gap: 14, padding: "10px 18px",
          borderBottom: "1px solid var(--line)", background: "var(--paper-2)",
          fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500,
        }}>
          <span>Code</span>
          <span>Uses</span>
          <span>Expires</span>
          <span>Status</span>
          <span />
        </div>
        <div className="row-list">
          {loading && <div className="dim" style={{ padding: "32px 18px", textAlign: "center", fontSize: 13 }}>Loading…</div>}
          {!loading && codes.length === 0 && <div className="dim" style={{ padding: "32px 18px", textAlign: "center", fontSize: 13 }}>No invite codes yet. Generate one to get started.</div>}
          {codes.map((code) => {
            const expired = new Date(code.expiresAt) <= new Date();
            const active = code.isActive && !expired;
            return (
              <div key={code.id} className="row" style={{ gridTemplateColumns: "1fr 100px 140px 110px 80px", cursor: "default" }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 500, letterSpacing: "0.05em" }}>{code.code}</span>
                <span className="mono dim" style={{ fontSize: 12.5 }}>{code.usedCount} / {code.maxUses}</span>
                <span className="mono dim" style={{ fontSize: 12 }}>
                  {new Date(code.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className={`chip ${active ? "success dot" : "warn dot"}`} style={{ fontSize: 11 }}>
                  {active ? <CheckCircle size={10} /> : expired ? <Clock size={10} /> : <XCircle size={10} />}
                  {active ? "active" : expired ? "expired" : "revoked"}
                </span>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <button className="btn ghost sm" type="button" onClick={() => copyCode(code.code)}>
                    <Copy size={12} strokeWidth={1.8} />
                  </button>
                  {code.isActive && (
                    <button className="btn ghost sm" type="button" onClick={() => handleRevoke(code.id)}>
                      <Trash2 size={12} strokeWidth={1.8} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showGenerate && (
        <Portal>
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", padding: 24 }}
          onClick={() => setShowGenerate(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: 400, background: "var(--card)", border: "1px solid var(--line)",
            borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden",
          }}>
            <div className="card-h">
              <h2 className="card-title">Generate invite code</h2>
              <button type="button" className="settings-x" onClick={() => setShowGenerate(false)}><X size={14} strokeWidth={2} /></button>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field">
                <label>Max uses</label>
                <input className="input" type="number" value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value) || 1)} min={1} />
              </div>
              <div className="field">
                <label>Expires in (days)</label>
                <input className="input" type="number" value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value) || 1)} min={1} />
              </div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost sm" onClick={() => setShowGenerate(false)}>Cancel</button>
              <button type="button" className="btn primary sm" onClick={handleGenerate} disabled={generating}>
                {generating ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
