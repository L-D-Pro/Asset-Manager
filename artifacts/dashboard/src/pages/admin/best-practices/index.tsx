import { useState, useEffect, useCallback } from "react";
import { Portal } from "@/components/ui/portal";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Plus, Pencil, Save, X } from "lucide-react";

interface BestPracticeItem {
  description: string;
  source: "ai" | "hardcoded" | "hybrid";
  rationale?: string;
  frequency?: number;
  enabled?: boolean;
  active?: boolean;
  guardKey?: string;
}

interface BestPracticesConfig {
  domain: string;
  title: string;
  items: BestPracticeItem[];
  hardcodedGuards: Record<string, boolean>;
  lastRefreshedAt?: string;
}

function cloneConfig(config: BestPracticesConfig): BestPracticesConfig {
  return { ...config, items: config.items.map((item) => ({ ...item })) };
}

function configsEqual(a: BestPracticesConfig, b: BestPracticesConfig): boolean {
  if (a.items.length !== b.items.length) return false;
  for (let i = 0; i < a.items.length; i++) {
    const ai = a.items[i]!;
    const bi = b.items[i]!;
    if (
      ai.description !== bi.description ||
      ai.source !== bi.source ||
      ai.rationale !== bi.rationale ||
      ai.frequency !== bi.frequency ||
      ai.enabled !== bi.enabled
    ) return false;
  }
  return true;
}

const SOURCE_CHIP: Record<string, string> = {
  ai: "chip accent dot",
  hardcoded: "chip ghost dot",
  hybrid: "chip warn dot",
};

export default function BestPracticesAdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<BestPracticesConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<BestPracticesConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newRationale, setNewRationale] = useState("");

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/best-practices", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch best practices");
      const data = (await res.json()) as BestPracticesConfig;
      const mapped = { ...data, items: data.items.map((item) => ({ ...item, enabled: item.active !== false })) };
      setConfig(mapped);
      setOriginalConfig(cloneConfig(mapped));
    } catch {
      toast({ title: "Could not load best practices", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void fetchConfig(); }, [fetchConfig]);

  const hasChanges = config !== null && originalConfig !== null && !configsEqual(config, originalConfig);

  async function doSave(nextConfig: BestPracticesConfig) {
    setSaving(true);
    try {
      const itemsToSave = nextConfig.items
        .map(({ enabled, ...rest }) => ({ ...rest, active: enabled !== false }));
      const res = await fetch("/api/best-practices", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: nextConfig.domain, items: itemsToSave }),
      });
      if (!res.ok) {
        const e = (await res.json()) as { error: string };
        throw new Error(e.error ?? "Save failed");
      }
      const data = (await res.json()) as BestPracticesConfig;
      const mapped = { ...data, items: data.items.map((item) => ({ ...item, enabled: item.active !== false })) };
      setConfig(mapped);
      setOriginalConfig(cloneConfig(mapped));
      setEditingIndex(null);
      toast({ title: "Best practices saved" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/best-practices/refresh", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to refresh");
      const data = (await res.json()) as BestPracticesConfig;
      const mapped = { ...data, items: data.items.map((item) => ({ ...item, enabled: item.active !== false })) };
      setConfig(mapped);
      setOriginalConfig(cloneConfig(mapped));
      toast({ title: "Best practices refreshed from AI" });
    } catch {
      toast({ title: "Refresh failed", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  }

  function startEdit(index: number) {
    if (!config) return;
    setEditingIndex(index);
    setEditDescription(config.items[index]!.description);
  }

  function handleCancelEdit() {
    if (!originalConfig || editingIndex === null) return;
    const newItems = [...config!.items];
    newItems[editingIndex] = { ...originalConfig.items[editingIndex]! };
    setConfig({ ...config!, items: newItems });
    setEditingIndex(null);
  }

  function handleSaveEdit() {
    if (!config || editingIndex === null) return;
    const newItems = [...config.items];
    newItems[editingIndex] = { ...newItems[editingIndex]!, description: editDescription };
    const nextConfig = { ...config, items: newItems };
    setConfig(nextConfig);
    void doSave(nextConfig);
  }

  function toggleItem(index: number) {
    if (!config) return;
    const newItems = [...config.items];
    newItems[index] = { ...newItems[index]!, enabled: !newItems[index]!.enabled };
    setConfig({ ...config, items: newItems });
  }

  function handleAdd() {
    if (!newDescription.trim()) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }
    if (!config) return;
    const newItem: BestPracticeItem = {
      description: newDescription.trim(),
      source: "hybrid",
      rationale: newRationale.trim() || undefined,
      enabled: true,
    };
    const nextConfig = { ...config, items: [...config.items, newItem] };
    setConfig(nextConfig);
    setNewDescription("");
    setNewRationale("");
    setAddOpen(false);
    void doSave(nextConfig);
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
    <div className="page fade-up" style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div className="eyebrow">admin · ai quality rules</div>
          <h1 className="h-display" style={{ marginTop: 4 }}>Best practices <em>· rules the AI reads</em></h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {hasChanges && (
            <button className="btn primary sm" type="button" onClick={() => config && void doSave(config)} disabled={saving}>
              <Save size={13} strokeWidth={1.8} />
              {saving ? "Saving…" : "Save changes"}
            </button>
          )}
          <button className="btn sm" type="button" onClick={() => void handleRefresh()} disabled={refreshing}>
            <RefreshCw size={13} strokeWidth={1.8} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            {refreshing ? "Refreshing…" : "Refresh from AI"}
          </button>
          <button className="btn accent sm" type="button" onClick={() => setAddOpen(true)}>
            <Plus size={13} strokeWidth={2} />
            Add rule
          </button>
        </div>
      </div>

      {config?.lastRefreshedAt && (
        <div className="dim mono" style={{ fontSize: 11.5, marginBottom: 14 }}>
          Last refreshed · {new Date(config.lastRefreshedAt).toLocaleString()}
        </div>
      )}

      <div className="card">
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 90px 80px 90px",
          alignItems: "center", gap: 14, padding: "10px 18px",
          borderBottom: "1px solid var(--line)", background: "var(--paper-2)",
          fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500,
        }}>
          <span>Rule</span><span>Source</span><span>Freq</span><span>Active</span>
        </div>
        <div className="row-list">
          {loading && (
            <div className="dim" style={{ padding: "32px 18px", textAlign: "center", fontSize: 13 }}>Loading…</div>
          )}
          {!loading && config && config.items.length === 0 && (
            <div className="dim" style={{ padding: "32px 18px", textAlign: "center", fontSize: 13 }}>
              No rules yet. Add one or refresh from AI.
            </div>
          )}
          {config?.items.map((item, index) => {
            const isEditing = editingIndex === index;
            const isOff = item.enabled === false;
            return (
              <div
                key={index}
                className="row"
                style={{
                  gridTemplateColumns: "1fr 90px 80px 90px",
                  alignItems: "flex-start",
                  opacity: isOff ? 0.5 : 1,
                  cursor: "default",
                }}
              >
                <div style={{ minWidth: 0, paddingTop: 2 }}>
                  {isEditing ? (
                    <textarea
                      className="input"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      style={{ width: "100%", marginBottom: 8, resize: "vertical", fontFamily: "var(--font-ui)" }}
                    />
                  ) : (
                    <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.55 }}>{item.description}</div>
                  )}
                  {item.rationale && !isEditing && (
                    <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>{item.rationale}</div>
                  )}
                  {isEditing && (
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <button className="btn ghost sm" type="button" onClick={handleCancelEdit} disabled={saving}>
                        <X size={12} strokeWidth={2} /> Cancel
                      </button>
                      <button className="btn primary sm" type="button" onClick={handleSaveEdit} disabled={saving}>
                        <Save size={12} strokeWidth={2} /> {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ paddingTop: 2 }}>
                  <span className={SOURCE_CHIP[item.source] ?? "chip ghost"} style={{ fontSize: 10.5 }}>
                    {item.source}
                  </span>
                </div>
                <span className="mono dim" style={{ fontSize: 12, paddingTop: 2 }}>
                  {item.frequency != null ? `×${item.frequency}` : "—"}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 2 }}>
                  <ToggleSwitch
                    checked={item.enabled !== false}
                    onChange={() => toggleItem(index)}
                    disabled={isEditing}
                  />
                  {!isEditing && (
                    <button
                      className="btn ghost sm"
                      type="button"
                      style={{ padding: "3px 6px" }}
                      onClick={() => startEdit(index)}
                      disabled={editingIndex !== null || saving}
                    >
                      <Pencil size={11} strokeWidth={1.8} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {config?.hardcodedGuards && Object.keys(config.hardcodedGuards).length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-h">
            <h2 className="card-title" style={{ fontSize: 14 }}>Hardcoded guards</h2>
            <span className="dim mono" style={{ fontSize: 11 }}>always enforced · not editable</span>
          </div>
          <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(config.hardcodedGuards).map(([key, value]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{key}</span>
                <span className={value ? "chip success dot" : "chip danger dot"} style={{ fontSize: 10.5 }}>
                  {value ? "ON" : "OFF"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {addOpen && (
        <Portal>
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", padding: 24 }}
          onClick={() => setAddOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 480, background: "var(--card)", border: "1px solid var(--line)",
              borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden",
            }}
          >
            <div className="card-h">
              <h2 className="card-title">Add new rule</h2>
              <button type="button" className="settings-x" onClick={() => setAddOpen(false)}>
                <X size={14} strokeWidth={2} />
              </button>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field">
                <label>Description</label>
                <textarea
                  className="input"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Enter rule description…"
                  rows={3}
                  style={{ resize: "vertical", fontFamily: "var(--font-ui)" }}
                />
              </div>
              <div className="field">
                <label>Rationale <span className="dim">(optional)</span></label>
                <textarea
                  className="input"
                  value={newRationale}
                  onChange={(e) => setNewRationale(e.target.value)}
                  placeholder="Why is this rule important?"
                  rows={2}
                  style={{ resize: "vertical", fontFamily: "var(--font-ui)" }}
                />
              </div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn ghost sm" onClick={() => setAddOpen(false)}>Cancel</button>
              <button type="button" className="btn primary sm" onClick={handleAdd}>Add rule</button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      style={{
        width: 32, height: 18, borderRadius: 99, border: "none", cursor: disabled ? "default" : "pointer",
        background: checked ? "var(--accent)" : "var(--line)",
        transition: "background 0.2s",
        position: "relative", flexShrink: 0, padding: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: checked ? 16 : 2,
        width: 14, height: 14, borderRadius: 99,
        background: "#fff", transition: "left 0.15s",
        display: "block",
      }} />
    </button>
  );
}
