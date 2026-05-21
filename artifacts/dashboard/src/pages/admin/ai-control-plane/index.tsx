import { useEffect, useMemo, useRef, useState } from "react";
import { Portal } from "@/components/ui/portal";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  useGetChatLeverConfig,
  useUpdateChatLeverConfig,
  useListAiPromptVersions,
  useCreateAiPromptVersion,
  useUpdateAiPromptVersion,
  useDeleteAiPromptVersion,
  useListChatLeverPresets,
  useCreateChatLeverPreset,
  useDeleteChatLeverPreset,
  useApplyChatLeverPreset,
  usePreviewChatPrompt,
  getGetChatLeverConfigQueryKey,
  getListAiPromptVersionsQueryKey,
  getListChatLeverPresetsQueryKey,
  type AiPromptVersion,
  type ChatLeverPreset,
  type PromptSection,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/auth";
import { toast } from "@/hooks/use-toast";
import { Plus, X, Save, Pencil, Camera, Trash2, Eye } from "lucide-react";

const CHAT_SCOPE = "chat";

// ── Fetch-skill helpers ───────────────────────────────────────────────────

function toRawUrl(url: string): string {
  const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
  if (url.startsWith("https://raw.githubusercontent.com/")) return url;
  throw new Error("Only GitHub blob URLs are supported.");
}

function extractLabelFromUrl(url: string): string {
  const parts = url.replace(/\?.*/, "").split("/").filter(Boolean);
  const mdIdx = parts.findIndex((p) => p.toLowerCase().endsWith(".md"));
  return mdIdx > 0 ? parts[mdIdx - 1] : parts[parts.length - 1];
}

function parseSkillMd(content: string): { roleLabel: string; body: string } {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { roleLabel: "", body: content.trim() };
  const nameMatch = m[1].match(/^name:\s*(.+)$/m);
  return { roleLabel: nameMatch?.[1]?.trim() ?? "", body: m[2].trim() };
}

export default function AiControlPlanePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: config } = useGetChatLeverConfig();
  const { data: promptVersions = [] } = useListAiPromptVersions({ taskScope: CHAT_SCOPE });
  const { data: presets = [] } = useListChatLeverPresets();
  const [previewPreset, setPreviewPreset] = useState<ChatLeverPreset | null>(null);

  const displayed = useMemo(() => {
    if (!config) return null;
    if (!previewPreset) return config;
    return {
      ...config,
      identityText: previewPreset.snapshot.identityText,
      skillsEnabled: previewPreset.snapshot.skillsEnabled,
      bestPracticesEnabled: previewPreset.snapshot.bestPracticesEnabled,
      skillRoutingMode: previewPreset.snapshot.skillRoutingMode,
    };
  }, [config, previewPreset]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetChatLeverConfigQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAiPromptVersionsQueryKey({ taskScope: CHAT_SCOPE }) });
    queryClient.invalidateQueries({ queryKey: getListChatLeverPresetsQueryKey() });
  };

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
    <div className="page fade-up" style={{ maxWidth: 1080 }}>
      <div style={{ marginBottom: 22 }}>
        <div className="eyebrow">admin · chat control plane</div>
        <h1 className="h-display" style={{ marginTop: 4 }}>
          AI Control Plane <em>· every lever the chat model reads</em>
        </h1>
        <div className="dim" style={{ fontSize: 13, marginTop: 6, maxWidth: 680 }}>
          Toggle, edit, and snapshot the levers that shape chat output. Changes are live —
          no restart. Use the inspector to see exactly what the model reads.
        </div>
      </div>

      {displayed ? (
        <>
          <PresetBar
            presets={presets}
            previewPreset={previewPreset}
            onPreviewChange={setPreviewPreset}
            onApplied={() => { setPreviewPreset(null); invalidateAll(); toast({ title: "Preset applied" }); }}
            onSaved={() => { invalidateAll(); toast({ title: "Preset saved" }); }}
            onDeleted={() => { setPreviewPreset(null); invalidateAll(); toast({ title: "Preset deleted" }); }}
          />
          <IdentityCard
            identityText={displayed.identityText}
            isPreview={!!previewPreset}
            onSaved={() => { invalidateAll(); toast({ title: "Identity updated" }); }}
          />
          <SkillsCard
            skillsEnabled={displayed.skillsEnabled}
            promptVersions={promptVersions}
            previewActiveIds={previewPreset?.snapshot.activePromptVersionIds ?? null}
            isPreview={!!previewPreset}
            onChanged={() => { invalidateAll(); }}
          />
          <BestPracticesCard
            bestPracticesEnabled={displayed.bestPracticesEnabled}
            isPreview={!!previewPreset}
            onChanged={() => { invalidateAll(); toast({ title: "Best practices lever updated" }); }}
          />
          <RoutingCard
            skillRoutingMode={displayed.skillRoutingMode}
            isPreview={!!previewPreset}
            onChanged={() => { invalidateAll(); }}
          />
          <InspectorCard />
        </>
      ) : (
        <div className="dim" style={{ padding: "32px 0", textAlign: "center", fontSize: 13 }}>Loading…</div>
      )}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const display = optimistic ?? checked;
  const resetRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Reset when server value arrives
  useEffect(() => { setOptimistic(null); clearTimeout(resetRef.current); }, [checked]);

  function handleClick() {
    setOptimistic(!checked);
    clearTimeout(resetRef.current);
    resetRef.current = setTimeout(() => setOptimistic(null), 5000); // safety reset on error
    onChange();
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={display}
      onClick={handleClick}
      disabled={disabled}
      style={{
        width: 36, height: 20, borderRadius: 99, border: "none",
        cursor: disabled ? "default" : "pointer",
        background: display ? "var(--accent)" : "var(--line)",
        position: "relative", flexShrink: 0, padding: 0, transition: "background 0.15s",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: display ? 19 : 3,
        width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.15s",
      }} />
    </button>
  );
}

function LeverCard({ title, subtitle, right, children }: {
  title: string; subtitle?: string; right?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-h">
        <div>
          <h2 className="card-title" style={{ fontSize: 15 }}>{title}</h2>
          {subtitle && <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      {children && <div className="card-body" style={{ padding: 14 }}>{children}</div>}
    </div>
  );
}

// ── Preset bar ────────────────────────────────────────────────────────────

function PresetBar({ presets, previewPreset, onPreviewChange, onApplied, onSaved, onDeleted }: {
  presets: ChatLeverPreset[];
  previewPreset: ChatLeverPreset | null;
  onPreviewChange: (p: ChatLeverPreset | null) => void;
  onApplied: () => void; onSaved: () => void; onDeleted: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const apply = useApplyChatLeverPreset();
  const create = useCreateChatLeverPreset();
  const del = useDeleteChatLeverPreset();

  function handleSelect(id: number | "") {
    setSelectedId(id);
    const preset = id === "" ? null : presets.find((p) => p.id === id) ?? null;
    onPreviewChange(preset);
  }

  async function handleApply() {
    if (selectedId === "") return;
    try { await apply.mutateAsync({ id: Number(selectedId) }); onApplied(); }
    catch (err) { toast({ title: "Apply failed", description: (err as Error).message, variant: "destructive" }); }
  }
  async function handleSave() {
    if (!newName.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    try {
      await create.mutateAsync({ data: { name: newName.trim() } });
      setNewName(""); setSaveOpen(false); onSaved();
    } catch (err) { toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" }); }
  }
  async function handleDelete() {
    if (selectedId === "") return;
    try { await del.mutateAsync({ id: Number(selectedId) }); handleSelect(""); onDeleted(); }
    catch (err) { toast({ title: "Delete failed", description: (err as Error).message, variant: "destructive" }); }
  }

  return (
    <div className="card flat" style={{ marginBottom: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span className="label">Presets</span>
        <select
          className="input"
          value={selectedId}
          onChange={(e) => handleSelect(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ width: 220, fontSize: 12.5 }}
        >
          <option value="">— select a preset —</option>
          {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button type="button" className="btn sm" disabled={selectedId === "" || apply.isPending} onClick={handleApply}>
          Apply
        </button>
        <button type="button" className="btn ghost sm" disabled={selectedId === ""} onClick={handleDelete}>
          <Trash2 size={12} strokeWidth={1.8} /> Delete
        </button>
        <span style={{ flex: 1 }} />
        {saveOpen ? (
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              className="input" autoFocus value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Preset name…" style={{ width: 160, fontSize: 12.5 }}
            />
            <button type="button" className="btn accent sm" disabled={create.isPending} onClick={handleSave}>Save</button>
            <button type="button" className="btn ghost sm" onClick={() => setSaveOpen(false)}><X size={12} strokeWidth={2} /></button>
          </span>
        ) : (
          <button type="button" className="btn accent sm" onClick={() => setSaveOpen(true)}>
            <Camera size={12} strokeWidth={1.8} /> Save current as preset
          </button>
        )}
      </div>
      {previewPreset && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
          background: "var(--accent-bg)", border: "1px solid var(--accent-line)",
          borderRadius: 6, fontSize: 12, color: "var(--accent-ink, var(--ink-2))",
        }}>
          <Eye size={12} strokeWidth={1.8} />
          <span>Previewing <strong>{previewPreset.name}</strong> — values shown below. Click <strong>Apply</strong> to make this the live config.</span>
          <button type="button" className="btn ghost sm" style={{ marginLeft: "auto", padding: "2px 6px", fontSize: 11 }} onClick={() => handleSelect("")}>
            <X size={10} strokeWidth={2} /> Clear
          </button>
        </div>
      )}
    </div>
  );
}

// ── Identity card ─────────────────────────────────────────────────────────

function IdentityCard({ identityText, isPreview, onSaved }: { identityText: string; isPreview?: boolean; onSaved: () => void }) {
  const [text, setText] = useState(identityText);
  const update = useUpdateChatLeverConfig();
  const dirty = text !== identityText;

  useEffect(() => { setText(identityText); }, [identityText]);

  async function handleSave() {
    try { await update.mutateAsync({ data: { identityText: text } }); onSaved(); }
    catch (err) { toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" }); }
  }

  return (
    <LeverCard
      title="Identity / wrapper"
      subtitle="The opening framing block — always sent, first in the prompt."
      right={
        !isPreview ? (
          <button type="button" className="btn primary sm" disabled={!dirty || update.isPending} onClick={handleSave}>
            <Save size={12} strokeWidth={1.8} /> {update.isPending ? "Saving…" : "Save"}
          </button>
        ) : null
      }
    >
      <textarea
        className="input"
        value={text}
        onChange={(e) => { if (!isPreview) setText(e.target.value); }}
        readOnly={isPreview}
        rows={4}
        style={{ resize: "vertical", fontFamily: "var(--font-ui)", fontSize: 13, lineHeight: 1.5, opacity: isPreview ? 0.75 : 1 }}
      />
    </LeverCard>
  );
}

// ── Skills card ───────────────────────────────────────────────────────────

/** Latest prompt-version row per skill label. */
function latestPerLabel(rows: AiPromptVersion[]): AiPromptVersion[] {
  const byLabel = new Map<string, AiPromptVersion>();
  for (const r of rows) {
    const cur = byLabel.get(r.label);
    if (!cur || r.version > cur.version) byLabel.set(r.label, r);
  }
  return [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function SkillsCard({ skillsEnabled, promptVersions, previewActiveIds, isPreview, onChanged }: {
  skillsEnabled: boolean;
  promptVersions: AiPromptVersion[];
  previewActiveIds?: number[] | null;
  isPreview?: boolean;
  onChanged: () => void;
}) {
  const updateConfig = useUpdateChatLeverConfig();
  const updateVersion = useUpdateAiPromptVersion();
  const deleteVersion = useDeleteAiPromptVersion();
  const [editing, setEditing] = useState<AiPromptVersion | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<AiPromptVersion | null>(null);
  const [fetchOpen, setFetchOpen] = useState(false);
  const [skillPrefill, setSkillPrefill] = useState<{ label: string; roleLabel: string; body: string } | null>(null);

  const skills = useMemo(() => latestPerLabel(promptVersions), [promptVersions]);
  const activeSet = useMemo(
    () => previewActiveIds != null ? new Set(previewActiveIds) : null,
    [previewActiveIds],
  );

  async function toggleMaster() {
    if (isPreview) return;
    try { await updateConfig.mutateAsync({ data: { skillsEnabled: !skillsEnabled } }); onChanged(); }
    catch (err) { toast({ title: "Toggle failed", description: (err as Error).message, variant: "destructive" }); }
  }
  async function toggleSkill(v: AiPromptVersion) {
    if (isPreview) return;
    try { await updateVersion.mutateAsync({ id: v.id, data: { isActive: !v.isActive } }); onChanged(); }
    catch (err) { toast({ title: "Toggle failed", description: (err as Error).message, variant: "destructive" }); }
  }
  async function removeSkill(v: AiPromptVersion) {
    if (isPreview) return;
    try {
      await deleteVersion.mutateAsync({ id: v.id });
      setConfirmRemove(null);
      onChanged();
      toast({ title: `Skill "${v.label}" removed` });
    }
    catch (err) { toast({ title: "Remove failed", description: (err as Error).message, variant: "destructive" }); }
  }

  return (
    <LeverCard
      title="Skills"
      subtitle="Active skill bodies injected after the identity block. Each is a versioned prompt."
      right={
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!isPreview && (
            <>
              <button type="button" className="btn ghost sm" onClick={() => setFetchOpen(true)}>
                Fetch from URL
              </button>
              <button type="button" className="btn ghost sm" onClick={() => setAdding(true)}>
                <Plus size={12} strokeWidth={1.8} /> Add skill
              </button>
            </>
          )}
          <span className="dim" style={{ fontSize: 11 }}>{skillsEnabled ? "ON" : "OFF"}</span>
          <Toggle checked={skillsEnabled} onChange={toggleMaster} disabled={isPreview} />
        </span>
      }
    >
      <div style={{ opacity: skillsEnabled ? 1 : 0.45, display: "flex", flexDirection: "column", gap: 8 }}>
        {skills.length === 0 && (
          <div className="dim" style={{ fontSize: 12.5, textAlign: "center", padding: "8px 0" }}>
            No chat skills yet. Add one or run the chat seed.
          </div>
        )}
        {skills.map((v) => {
          const effectiveActive = activeSet != null ? activeSet.has(v.id) : v.isActive;
          return (
            <div key={v.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", border: "1px solid var(--line-soft)", borderRadius: 8,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{v.roleLabel ?? v.label}</div>
                <div className="dim mono" style={{ fontSize: 11, marginTop: 2 }}>{v.label} · v{v.version}</div>
              </div>
              {!isPreview && (
                confirmRemove?.id === v.id ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="dim" style={{ fontSize: 11.5 }}>Remove?</span>
                    <button type="button" className="btn danger sm" style={{ padding: "3px 7px" }} disabled={deleteVersion.isPending} onClick={() => removeSkill(v)}>
                      Yes
                    </button>
                    <button type="button" className="btn ghost sm" style={{ padding: "3px 7px" }} onClick={() => setConfirmRemove(null)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <>
                    <button type="button" className="btn ghost sm" style={{ padding: "3px 7px" }} onClick={() => setEditing(v)}>
                      <Pencil size={11} strokeWidth={1.8} /> Edit
                    </button>
                    <button type="button" className="btn ghost sm" style={{ padding: "3px 7px", color: "var(--danger, #d73a49)" }} onClick={() => setConfirmRemove(v)}>
                      <Trash2 size={11} strokeWidth={1.8} />
                    </button>
                  </>
                )
              )}
              <Toggle checked={effectiveActive} onChange={() => toggleSkill(v)} disabled={isPreview || !skillsEnabled} />
            </div>
          );
        })}
      </div>

      {editing && (
        <SkillEditorModal
          mode="edit"
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); toast({ title: "Skill updated — new version active" }); }}
        />
      )}
      {adding && (
        <SkillEditorModal
          mode="add"
          prefill={skillPrefill ?? undefined}
          onClose={() => { setAdding(false); setSkillPrefill(null); }}
          onSaved={() => { setAdding(false); setSkillPrefill(null); onChanged(); toast({ title: "Skill added" }); }}
        />
      )}
      {fetchOpen && (
        <FetchSkillModal
          onClose={() => setFetchOpen(false)}
          onFetched={(prefill) => {
            setSkillPrefill(prefill);
            setFetchOpen(false);
            setAdding(true);
          }}
        />
      )}
    </LeverCard>
  );
}

function FetchSkillModal({ onFetched, onClose }: {
  onFetched: (prefill: { label: string; roleLabel: string; body: string }) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    setError(null);
    if (!url.trim()) { setError("Enter a URL."); return; }
    setLoading(true);
    try {
      const rawUrl = toRawUrl(url.trim());
      const res = await fetch(rawUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} — check the URL and try again.`);
      const content = await res.text();
      const { roleLabel, body } = parseSkillMd(content);
      if (!body) throw new Error("SKILL.md body is empty.");
      const label = extractLabelFromUrl(url.trim());
      onFetched({ label, roleLabel, body });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Portal>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", padding: 24 }}
        onClick={onClose}
      >
        <div
          style={{ width: 540, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="card-h">
            <h2 className="card-title">Fetch skill from GitHub</h2>
            <button type="button" className="settings-x" onClick={onClose}><X size={14} strokeWidth={2} /></button>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <label className="label" style={{ display: "block", marginBottom: 2 }}>SKILL.md URL</label>
            <input
              className="input"
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleFetch(); }}
              placeholder="https://github.com/owner/repo/blob/main/skills/my-skill/SKILL.md"
              style={{ fontSize: 12.5 }}
            />
            {error && (
              <div style={{ fontSize: 12, color: "var(--danger, #d73a49)", marginTop: 2 }}>{error}</div>
            )}
          </div>
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn ghost sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn primary sm" disabled={loading} onClick={handleFetch}>
              {loading ? "Fetching…" : "Fetch"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function SkillEditorModal({ mode, existing, prefill, onClose, onSaved }: {
  mode: "edit" | "add";
  existing?: AiPromptVersion;
  prefill?: { label: string; roleLabel: string; body: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(prefill?.label ?? existing?.label ?? "");
  const [roleLabel, setRoleLabel] = useState(prefill?.roleLabel ?? existing?.roleLabel ?? "");
  const [body, setBody] = useState(prefill?.body ?? existing?.systemPrompt ?? "");
  const create = useCreateAiPromptVersion();
  const update = useUpdateAiPromptVersion();

  async function handleSave() {
    if (!label.trim()) { toast({ title: "Slug required", variant: "destructive" }); return; }
    if (!body.trim()) { toast({ title: "Body required", variant: "destructive" }); return; }
    try {
      if (mode === "edit" && existing) {
        // Immutable versioning: insert v+1 active, deactivate the prior version.
        await create.mutateAsync({
          data: {
            taskScope: CHAT_SCOPE,
            label: existing.label,
            version: existing.version + 1,
            systemPrompt: body,
            isActive: true,
            roleLabel: roleLabel || existing.label,
          },
        });
        await update.mutateAsync({ id: existing.id, data: { isActive: false } });
      } else {
        await create.mutateAsync({
          data: {
            taskScope: CHAT_SCOPE,
            label: label.trim(),
            version: 1,
            systemPrompt: body,
            isActive: true,
            roleLabel: roleLabel || label.trim(),
          },
        });
      }
      onSaved();
    } catch (err) {
      toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" });
    }
  }

  const busy = create.isPending || update.isPending;

  return (
    <Portal>
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ width: 600, maxHeight: "85vh", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-h">
          <h2 className="card-title">{mode === "edit" ? `Edit skill · ${existing?.label}` : "Add skill"}</h2>
          <button type="button" className="settings-x" onClick={onClose}><X size={14} strokeWidth={2} /></button>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
          {mode === "add" && (
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5 }}>Slug</label>
              <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. resume-ats-optimizer" />
            </div>
          )}
          <div>
            <label className="label" style={{ display: "block", marginBottom: 5 }}>Display name</label>
            <input className="input" value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} placeholder="e.g. Resume ATS Optimizer" />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 5 }}>Skill body</label>
            <textarea
              className="input" value={body} onChange={(e) => setBody(e.target.value)} rows={14}
              style={{ resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.5 }}
            />
            {mode === "edit" && (
              <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
                Saving creates v{(existing?.version ?? 1) + 1} and deactivates v{existing?.version}.
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn ghost sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary sm" disabled={busy} onClick={handleSave}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

// ── Best practices card ───────────────────────────────────────────────────

function BestPracticesCard({ bestPracticesEnabled, isPreview, onChanged }: {
  bestPracticesEnabled: boolean; isPreview?: boolean; onChanged: () => void;
}) {
  const update = useUpdateChatLeverConfig();
  async function toggle() {
    if (isPreview) return;
    try { await update.mutateAsync({ data: { bestPracticesEnabled: !bestPracticesEnabled } }); onChanged(); }
    catch (err) { toast({ title: "Toggle failed", description: (err as Error).message, variant: "destructive" }); }
  }
  return (
    <LeverCard
      title="Best practices"
      subtitle="The quality-rules block appended after the skills."
      right={
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link to="/admin/best-practices" className="btn ghost sm">Manage rules →</Link>
          <span className="dim" style={{ fontSize: 11 }}>{bestPracticesEnabled ? "ON" : "OFF"}</span>
          <Toggle checked={bestPracticesEnabled} onChange={toggle} disabled={isPreview} />
        </span>
      }
    />
  );
}

// ── Routing card ──────────────────────────────────────────────────────────

function RoutingCard({ skillRoutingMode, isPreview, onChanged }: { skillRoutingMode: string; isPreview?: boolean; onChanged: () => void }) {
  const update = useUpdateChatLeverConfig();
  const [savedMode, setSavedMode] = useState<string | null>(null);

  async function setMode(mode: "all" | "classified") {
    if (mode === skillRoutingMode || isPreview) return;
    try {
      await update.mutateAsync({ data: { skillRoutingMode: mode } });
      onChanged();
      setSavedMode(mode);
      setTimeout(() => setSavedMode(null), 2000);
    }
    catch (err) { toast({ title: "Update failed", description: (err as Error).message, variant: "destructive" }); }
  }

  return (
    <LeverCard
      title="Skill routing"
      subtitle="How many skills load per turn — exposes the intent classifier as a lever."
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {([["all", "Load all active skills"], ["classified", "Route by intent classifier"]] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            className={`btn sm${skillRoutingMode === mode ? " accent" : " ghost"}`}
            disabled={update.isPending || isPreview}
            onClick={() => setMode(mode)}
          >
            {label}
          </button>
        ))}
        {savedMode && !isPreview && (
          <span style={{ fontSize: 11.5, color: "var(--success, #2da44e)", display: "flex", alignItems: "center", gap: 4 }}>
            ✓ {savedMode === "all" ? "Loading all skills" : "Intent routing active"}
          </span>
        )}
      </div>
    </LeverCard>
  );
}

// ── Inspector ─────────────────────────────────────────────────────────────

const LEVER_COLOR: Record<string, string> = {
  identity: "var(--accent)",
  skill: "var(--info, var(--accent))",
  best_practices: "var(--warn)",
  attachments: "var(--success)",
};

function InspectorCard() {
  const [sample, setSample] = useState("Help me tailor my resume for this job.");
  const [sections, setSections] = useState<PromptSection[] | null>(null);
  const preview = usePreviewChatPrompt();

  async function run() {
    if (!sample.trim()) return;
    try {
      const result = await preview.mutateAsync({ data: { sampleMessage: sample.trim() } });
      setSections(result as PromptSection[]);
    } catch (err) {
      toast({ title: "Preview failed", description: (err as Error).message, variant: "destructive" });
    }
  }

  return (
    <LeverCard
      title="Prompt inspector"
      subtitle="See exactly what the model reads, given the current lever state."
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          className="input"
          value={sample}
          onChange={(e) => setSample(e.target.value)}
          placeholder="A sample user message…"
        />
        <button type="button" className="btn primary sm" disabled={preview.isPending} onClick={run}>
          <Eye size={12} strokeWidth={1.8} /> {preview.isPending ? "…" : "Preview"}
        </button>
      </div>
      {sections && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sections.length === 0 && (
            <div className="dim" style={{ fontSize: 12.5 }}>Empty prompt — every lever is off.</div>
          )}
          {sections.map((s, i) => (
            <div key={i} style={{ border: "1px solid var(--line-soft)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                background: "var(--paper-2)", borderBottom: "1px solid var(--line-soft)",
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: LEVER_COLOR[s.lever] ?? "var(--ink-4)" }} />
                <span className="mono" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3)" }}>
                  {s.lever}
                </span>
                <span className="dim" style={{ fontSize: 11.5 }}>{s.label}</span>
              </div>
              <pre style={{
                margin: 0, padding: "10px 12px", fontSize: 11.5, lineHeight: 1.5,
                whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--font-mono)",
                maxHeight: 240, overflowY: "auto",
              }}>
                {s.content}
              </pre>
            </div>
          ))}
        </div>
      )}
    </LeverCard>
  );
}
