import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Save, X } from "lucide-react";
import { bestPracticesDomainForTask } from "../types";
import { AI_PIPELINE_OVERVIEW_QUERY_KEY } from "../useAiPipelineOverview";

interface BestPracticeItem {
  description: string;
  source: "ai" | "hardcoded" | "hybrid";
  rationale?: string;
  frequency?: number;
  enabled?: boolean;
}

interface BestPracticesConfig {
  domain: string;
  title: string;
  items: BestPracticeItem[];
  hardcodedGuards: Record<string, boolean>;
  lastRefreshedAt?: string;
}

function withEnabledFlag(config: BestPracticesConfig): BestPracticesConfig {
  return { ...config, items: config.items.map((item) => ({ ...item, enabled: true })) };
}

const SOURCE_CHIP: Record<string, string> = {
  ai: "chip accent dot",
  hardcoded: "chip ghost dot",
  hybrid: "chip warn dot",
};

export function BestPracticesTab({ taskScope }: { taskScope: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const domain = bestPracticesDomainForTask(taskScope);

  const [config, setConfig] = useState<BestPracticesConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDescription, setEditDescription] = useState("");

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/best-practices?domain=${encodeURIComponent(domain)}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setConfig(withEnabledFlag((await res.json()) as BestPracticesConfig));
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Could not load best practices", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [domain, toast]);

  useEffect(() => { void fetchConfig(); }, [fetchConfig]);

  async function persist(next: BestPracticesConfig) {
    setSaving(true);
    try {
      const payloadItems = next.items
        .filter((item) => item.enabled !== false)
        .map(({ enabled: _e, ...rest }) => rest);
      const res = await fetch("/api/best-practices", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: next.domain, items: payloadItems }),
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try { const e = (await res.json()) as { error?: string }; detail = e.error ?? detail; } catch { /* ignore */ }
        throw new Error(detail);
      }
      setConfig(withEnabledFlag((await res.json()) as BestPracticesConfig));
      setEditingIndex(null);
      toast({ title: "Best practices saved" });
      queryClient.invalidateQueries({ queryKey: AI_PIPELINE_OVERVIEW_QUERY_KEY });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="dim" style={{ fontSize: 13 }}>Loading best practices…</div>;
  if (!config) return <div className="dim" style={{ fontSize: 13 }}>Failed to load best practices.</div>;

  function toggleItem(index: number) {
    const next = { ...config!, items: config!.items.map((item, i) => i === index ? { ...item, enabled: !(item.enabled !== false) } : item) };
    setConfig(next);
    void persist(next);
  }

  function startEdit(index: number) {
    setEditingIndex(index);
    setEditDescription(config!.items[index]?.description ?? "");
  }

  function cancelEdit() { setEditingIndex(null); setEditDescription(""); }

  function saveEdit() {
    if (editingIndex === null) return;
    void persist({ ...config!, items: config!.items.map((item, i) => i === editingIndex ? { ...item, description: editDescription } : item) });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="dim" style={{ fontSize: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Domain: <span className="mono">{config.domain}</span> · {config.items.length} rules</span>
        <Link to="/admin/best-practices" style={{ fontSize: 12, color: "var(--accent)" }}>
          Open in Admin →
        </Link>
      </div>

      <div className="card flat" style={{ overflow: "hidden" }}>
        <div className="row-list">
          {config.items.length === 0 && (
            <div className="dim" style={{ padding: "20px 16px", fontSize: 12.5, textAlign: "center" }}>
              No rules yet. Add rules in Admin → Best Practices.
            </div>
          )}
          {config.items.map((item, index) => {
            const isEditing = editingIndex === index;
            return (
              <div
                key={index}
                className="row"
                style={{
                  gridTemplateColumns: "1fr auto auto",
                  alignItems: "flex-start",
                  opacity: item.enabled === false ? 0.5 : 1,
                  cursor: "default",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                    <span className={SOURCE_CHIP[item.source] ?? "chip ghost"} style={{ fontSize: 10 }}>
                      {item.source}
                    </span>
                    {item.frequency != null && (
                      <span className="mono dim" style={{ fontSize: 10.5 }}>×{item.frequency}</span>
                    )}
                  </div>
                  {isEditing ? (
                    <textarea
                      className="input"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      style={{ width: "100%", marginBottom: 6, resize: "vertical", fontFamily: "var(--font-ui)" }}
                    />
                  ) : (
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{item.description}</div>
                  )}
                  {item.rationale && !isEditing && (
                    <div className="dim" style={{ fontSize: 11.5, marginTop: 3 }}>{item.rationale}</div>
                  )}
                  {isEditing && (
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <button className="btn ghost sm" type="button" onClick={cancelEdit} disabled={saving}>
                        <X size={11} strokeWidth={2} /> Cancel
                      </button>
                      <button className="btn primary sm" type="button" onClick={saveEdit} disabled={saving}>
                        <Save size={11} strokeWidth={2} /> {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.enabled !== false}
                  onClick={() => toggleItem(index)}
                  disabled={isEditing || saving}
                  style={{
                    width: 28, height: 16, borderRadius: 99, border: "none",
                    cursor: isEditing || saving ? "default" : "pointer",
                    background: item.enabled !== false ? "var(--accent)" : "var(--line)",
                    position: "relative", flexShrink: 0, padding: 0, marginTop: 2,
                  }}
                >
                  <span style={{
                    position: "absolute", top: 2, left: item.enabled !== false ? 13 : 2,
                    width: 12, height: 12, borderRadius: 99, background: "#fff",
                    transition: "left 0.15s", display: "block",
                  }} />
                </button>
                {!isEditing && (
                  <button
                    type="button"
                    className="btn ghost sm"
                    style={{ padding: "3px 5px", marginTop: 1 }}
                    onClick={() => startEdit(index)}
                    disabled={editingIndex !== null || saving}
                  >
                    <Pencil size={10} strokeWidth={1.8} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
