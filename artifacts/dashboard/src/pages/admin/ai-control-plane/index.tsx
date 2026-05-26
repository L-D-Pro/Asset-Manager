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
  usePreviewChatRoute,
  getGetChatLeverConfigQueryKey,
  getListAiPromptVersionsQueryKey,
  getListChatLeverPresetsQueryKey,
  type AiPromptVersion,
  type ChatLeverPreset,
  type PromptSection,
  type RoutingDecision,
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

interface ParsedSkillMd {
  roleLabel: string;
  body: string;
  routerDescription: string;
  triggerExamples: string[];
  negativeTriggers: string[];
  priority: number | null;
  status: string;
}

function parseSkillMd(content: string): ParsedSkillMd {
  const empty: ParsedSkillMd = {
    roleLabel: "", body: content.trim(), routerDescription: "",
    triggerExamples: [], negativeTriggers: [], priority: null, status: "active",
  };
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return empty;

  // Minimal YAML parser — handles scalars and block/inline arrays.
  const fm: Record<string, string | string[]> = {};
  const lines = m[1]!.split(/\r?\n/);
  let curKey: string | null = null;
  let curArr: string[] | null = null;

  for (const line of lines) {
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && curKey && curArr) { curArr.push(item[1]!.trim()); continue; }
    if (curKey && curArr) { fm[curKey] = curArr; curKey = null; curArr = null; }
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    if (!key) continue;
    let val = line.slice(colon + 1).trim();
    if (!val) { curKey = key; curArr = []; continue; }
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (val.startsWith("[") && val.endsWith("]")) {
      fm[key] = val.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      fm[key] = val;
    }
  }
  if (curKey && curArr) fm[curKey] = curArr;

  const str = (k: string) => (typeof fm[k] === "string" ? (fm[k] as string) : "");
  const arr = (...keys: string[]) => {
    for (const k of keys) { if (Array.isArray(fm[k])) return fm[k] as string[]; }
    return [];
  };

  return {
    roleLabel: str("name"),
    body: m[2]!.trimStart(),
    routerDescription: str("description"),
    triggerExamples: arr("trigger_examples", "triggers"),
    negativeTriggers: arr("negative_triggers"),
    priority: fm["priority"] != null ? (Number(fm["priority"]) || null) : null,
    status: str("status") || "active",
  };
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
      skillTokenBudget: previewPreset.snapshot.skillTokenBudget ?? config.skillTokenBudget,
      maxSelectedSkills: previewPreset.snapshot.maxSelectedSkills ?? config.maxSelectedSkills,
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
            promptVersions={promptVersions}
            previewPreset={previewPreset}
            onPreviewChange={setPreviewPreset}
            onApplied={() => { setPreviewPreset(null); invalidateAll(); toast({ title: "Preset applied" }); }}
            onSaved={() => { invalidateAll(); }}
            onDeleted={() => { setPreviewPreset(null); invalidateAll(); toast({ title: "Preset deleted" }); }}
            onUpdated={() => { invalidateAll(); }}
          />
          <IdentityCard
            identityText={displayed.identityText}
            isPreview={!!previewPreset}
            onSaved={() => { invalidateAll(); toast({ title: "Identity saved" }); }}
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
            onChanged={() => { invalidateAll(); toast({ title: "Best practices updated" }); }}
          />
          <RoutingCard
            skillRoutingMode={displayed.skillRoutingMode}
            skillTokenBudget={displayed.skillTokenBudget}
            maxSelectedSkills={displayed.maxSelectedSkills}
            isPreview={!!previewPreset}
            onChanged={() => { invalidateAll(); }}
          />
          <InspectorCard promptVersions={promptVersions} />
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

function PresetBar({ presets, promptVersions, previewPreset, onPreviewChange, onApplied, onSaved, onDeleted, onUpdated }: {
  presets: ChatLeverPreset[];
  promptVersions: AiPromptVersion[];
  previewPreset: ChatLeverPreset | null;
  onPreviewChange: (p: ChatLeverPreset | null) => void;
  onApplied: () => void; onSaved: () => void; onDeleted: () => void; onUpdated: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [newPresetOpen, setNewPresetOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [updating, setUpdating] = useState(false);
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
  async function handleUpdate() {
    if (selectedId === "") return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/chat/lever-presets/${selectedId}`, { method: "PATCH", credentials: "include" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Update failed");
      onUpdated();
      toast({ title: "Preset overwritten" });
    } catch (err) {
      toast({ title: "Update failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  }
  async function handleSave() {
    if (!newName.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    try {
      await create.mutateAsync({ data: { name: newName.trim() } });
      setNewName(""); setSaveOpen(false);
      onSaved();
      toast({ title: "Preset saved" });
    } catch (err) { toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" }); }
  }
  async function handleDelete() {
    if (selectedId === "") return;
    try { await del.mutateAsync({ id: Number(selectedId) }); handleSelect(""); onDeleted(); }
    catch (err) { toast({ title: "Delete failed", description: (err as Error).message, variant: "destructive" }); }
  }

  function handleCreated(created: ChatLeverPreset) {
    setNewPresetOpen(false);
    setSelectedId(created.id);
    onPreviewChange(created);
    onSaved();
    toast({ title: "Preset created" });
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
        <button
          type="button"
          className="btn ghost sm"
          disabled={selectedId === "" || updating}
          onClick={handleUpdate}
          title="Re-snapshot the current live state into this preset"
        >
          <Save size={12} strokeWidth={1.8} /> {updating ? "Saving…" : "Overwrite"}
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
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button type="button" className="btn ghost sm" onClick={() => setNewPresetOpen(true)}>
              <Plus size={12} strokeWidth={1.8} /> New preset
            </button>
            <button type="button" className="btn accent sm" onClick={() => setSaveOpen(true)}>
              <Camera size={12} strokeWidth={1.8} /> Save current as preset
            </button>
          </span>
        )}
      </div>
      {previewPreset && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
          background: "var(--accent-bg)", border: "1px solid var(--accent-line)",
          borderRadius: 6, fontSize: 12, color: "var(--accent-ink, var(--ink-2))",
        }}>
          <Eye size={12} strokeWidth={1.8} />
          <span style={{ lineHeight: 1.5 }}>
            Previewing <strong>{previewPreset.name}</strong>.{" "}
            Cards below show this preset's values — editing them updates the{" "}
            <em>live config</em>, not the preset. To save live edits back into this preset, click{" "}
            <strong>Overwrite</strong>.
          </span>
          <button type="button" className="btn ghost sm" style={{ marginLeft: "auto", padding: "2px 6px", fontSize: 11 }} onClick={() => handleSelect("")}>
            <X size={10} strokeWidth={2} /> Clear
          </button>
        </div>
      )}
      {newPresetOpen && (
        <NewPresetModal
          promptVersions={promptVersions}
          onClose={() => setNewPresetOpen(false)}
          onCreated={handleCreated}
        />
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

/** Small priority + status badges derived from a skill's router metadata. */
function SkillMetaBadges({ metadata }: { metadata: unknown }) {
  const m = (metadata ?? {}) as { priority?: number; status?: string };
  const status = m.status ?? "active";
  const chip = (text: string, color: string) => (
    <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color, border: `1px solid ${color}`, borderRadius: 4, padding: "0 4px" }}>{text}</span>
  );
  return (
    <>
      {typeof m.priority === "number" && chip(`P${m.priority}`, "var(--ink-4)")}
      {status === "draft" && chip("draft", "var(--warn)")}
      {status === "deprecated" && chip("deprecated", "var(--danger, #d73a49)")}
    </>
  );
}

function TriggerSummary({ metadata }: { metadata: unknown }) {
  const m = (metadata ?? {}) as { triggerExamples?: string[]; negativeTriggers?: string[] };
  const triggers = m.triggerExamples ?? [];
  const negatives = m.negativeTriggers ?? [];
  if (triggers.length === 0 && negatives.length === 0) return null;
  return (
    <div className="dim" style={{ fontSize: 10.5, marginTop: 3, lineHeight: 1.4 }}>
      {triggers.length > 0 && <span>triggers: {triggers.slice(0, 2).join(", ")}{triggers.length > 2 ? ` +${triggers.length - 2} more` : ""}</span>}
      {negatives.length > 0 && <span style={{ marginLeft: 8 }}>negatives: {negatives.slice(0, 2).join(", ")}{negatives.length > 2 ? ` +${negatives.length - 2} more` : ""}</span>}
    </div>
  );
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
  const [skillPrefill, setSkillPrefill] = useState<ParsedSkillMd & { label: string } | null>(null);

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
        {isPreview && skills.length > 0 && (
          <div className="dim" style={{ fontSize: 11.5, padding: "4px 2px" }}>
            Skills are system-wide. This preset controls which ones are active — toggles are disabled in preview mode.
          </div>
        )}
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
                <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  {v.roleLabel ?? v.label}
                  <SkillMetaBadges metadata={v.metadata} />
                </div>
                <div className="dim mono" style={{ fontSize: 11, marginTop: 2 }}>{v.label} · v{v.version}</div>
                <TriggerSummary metadata={v.metadata} />
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
  onFetched: (prefill: ParsedSkillMd & { label: string }) => void;
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
      const parsed = parseSkillMd(content);
      if (!parsed.body) throw new Error("SKILL.md body is empty.");
      const label = extractLabelFromUrl(url.trim());
      onFetched({ ...parsed, label });
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
  prefill?: ParsedSkillMd & { label: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const existingMeta = (existing?.metadata ?? {}) as {
    routerDescription?: string; triggerExamples?: string[]; negativeTriggers?: string[];
    taskTypes?: string[]; priority?: number; status?: string;
  };
  const [label, setLabel] = useState(prefill?.label ?? existing?.label ?? "");
  const [roleLabel, setRoleLabel] = useState(prefill?.roleLabel ?? existing?.roleLabel ?? "");
  const [body, setBody] = useState(prefill?.body ?? existing?.systemPrompt ?? "");
  const [routerDescription, setRouterDescription] = useState(existingMeta.routerDescription || prefill?.routerDescription || "");
  const [triggers, setTriggers] = useState(existingMeta.triggerExamples?.join("\n") || prefill?.triggerExamples?.join("\n") || "");
  const [negatives, setNegatives] = useState(existingMeta.negativeTriggers?.join("\n") || prefill?.negativeTriggers?.join("\n") || "");
  const [taskTypesStr, setTaskTypesStr] = useState((existingMeta.taskTypes ?? ["chat"]).join(", "));
  const [priority, setPriority] = useState(existingMeta.priority ?? prefill?.priority ?? 50);
  const [status, setStatus] = useState(existingMeta.status || prefill?.status || "active");
  const create = useCreateAiPromptVersion();
  const update = useUpdateAiPromptVersion();

  function buildMeta() {
    const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
    return {
      routerDescription: routerDescription.trim(),
      triggerExamples: lines(triggers),
      negativeTriggers: lines(negatives),
      taskTypes: taskTypesStr.split(",").map((x) => x.trim()).filter(Boolean),
      priority: Number(priority) || 50,
      status,
    };
  }

  async function handleSave() {
    if (!label.trim()) { toast({ title: "Slug required", variant: "destructive" }); return; }
    if (!body.trim()) { toast({ title: "Body required", variant: "destructive" }); return; }
    const metadata = buildMeta();
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
            metadata,
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
            metadata,
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
              className="input" value={body} onChange={(e) => setBody(e.target.value)} rows={12}
              style={{ resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.5 }}
            />
            {mode === "edit" && (
              <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
                Saving creates v{(existing?.version ?? 1) + 1} and deactivates v{existing?.version}.
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 12 }}>
            <div className="label" style={{ marginBottom: 8 }}>Router metadata</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 4, fontSize: 11 }}>Router description</label>
                <input
                  className="input" value={routerDescription} onChange={(e) => setRouterDescription(e.target.value)}
                  placeholder="One line the router + catalog use to decide when this skill applies."
                  style={{ fontSize: 12.5 }}
                />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label className="label" style={{ display: "block", marginBottom: 4, fontSize: 11 }}>Trigger examples (one per line)</label>
                  <textarea
                    className="input" value={triggers} onChange={(e) => setTriggers(e.target.value)} rows={4}
                    placeholder={"tailor my resume\nresume for this job"}
                    style={{ resize: "vertical", fontSize: 12 }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label" style={{ display: "block", marginBottom: 4, fontSize: 11 }}>Negative triggers (one per line)</label>
                  <textarea
                    className="input" value={negatives} onChange={(e) => setNegatives(e.target.value)} rows={4}
                    placeholder={"cover letter"}
                    style={{ resize: "vertical", fontSize: 12 }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <label className="label" style={{ display: "block", marginBottom: 4, fontSize: 11 }}>Task types (comma-separated)</label>
                  <input className="input" value={taskTypesStr} onChange={(e) => setTaskTypesStr(e.target.value)} style={{ fontSize: 12.5 }} />
                </div>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 4, fontSize: 11 }}>Priority</label>
                  <input
                    type="number" className="input" value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    style={{ width: 80, fontSize: 12.5 }}
                  />
                </div>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 4, fontSize: 11 }}>Status</label>
                  <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 120, fontSize: 12.5 }}>
                    <option value="active">active</option>
                    <option value="draft">draft</option>
                    <option value="deprecated">deprecated</option>
                  </select>
                </div>
              </div>
              <div className="dim" style={{ fontSize: 11 }}>
                Lower priority wins ties. Deprecated skills are excluded from routing and the catalog.
              </div>
            </div>
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

// ── New-preset modal ──────────────────────────────────────────────────────

function NewPresetModal({ promptVersions, onClose, onCreated }: {
  promptVersions: AiPromptVersion[];
  onClose: () => void;
  onCreated: (preset: ChatLeverPreset) => void;
}) {
  const [name, setName] = useState("");
  const [identityText, setIdentityText] = useState("");
  const [skillsEnabled, setSkillsEnabled] = useState(false);
  const [bestPracticesEnabled, setBestPracticesEnabled] = useState(false);
  const [skillRoutingMode, setSkillRoutingMode] = useState<string>("auto");
  const [skillTokenBudget, setSkillTokenBudget] = useState(1500);
  const [maxSelectedSkills, setMaxSelectedSkills] = useState(1);
  const skills = useMemo(() => latestPerLabel(promptVersions), [promptVersions]);
  const [activeSkillIds, setActiveSkillIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggleSkill(id: number) {
    setActiveSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/chat/lever-presets/template", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          snapshot: {
            identityText,
            skillsEnabled,
            bestPracticesEnabled,
            skillRoutingMode,
            skillTokenBudget,
            maxSelectedSkills,
            activePromptVersionIds: [...activeSkillIds],
          },
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Create failed");
      const created: ChatLeverPreset = await res.json();
      onCreated(created);
    } catch (err) {
      toast({ title: "Create failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Portal>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", padding: 24 }}
        onClick={onClose}
      >
        <div
          style={{ width: 560, maxHeight: "85vh", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden", display: "flex", flexDirection: "column" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="card-h">
            <h2 className="card-title">New preset from template</h2>
            <button type="button" className="settings-x" onClick={onClose}><X size={14} strokeWidth={2} /></button>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5 }}>Name</label>
              <input
                className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Skills on · no best-practices"
              />
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5 }}>Identity text</label>
              <textarea
                className="input" value={identityText} onChange={(e) => setIdentityText(e.target.value)} rows={3}
                placeholder="Leave blank to start with an empty identity block."
                style={{ resize: "vertical", fontFamily: "var(--font-ui)", fontSize: 13, lineHeight: 1.5 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="label">Skills enabled</span>
              <Toggle checked={skillsEnabled} onChange={() => setSkillsEnabled((v) => !v)} />
            </div>
            {skills.length > 0 && (
              <div style={{ opacity: skillsEnabled ? 1 : 0.4, display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="label" style={{ fontSize: 11 }}>Active skills in this preset</span>
                {skills.map((v) => (
                  <label key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: skillsEnabled ? "pointer" : "default", fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={activeSkillIds.has(v.id)}
                      onChange={() => toggleSkill(v.id)}
                      disabled={!skillsEnabled}
                    />
                    {v.roleLabel ?? v.label}
                    <span className="dim mono" style={{ fontSize: 11 }}>v{v.version}</span>
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="label">Best practices</span>
              <Toggle checked={bestPracticesEnabled} onChange={() => setBestPracticesEnabled((v) => !v)} />
            </div>
            <div>
              <span className="label" style={{ display: "block", marginBottom: 6 }}>Skill routing</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ROUTING_MODES.map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={`btn sm${skillRoutingMode === mode ? (mode === "debug_all" ? " destructive" : " accent") : " ghost"}`}
                    title={mode === "debug_all" ? "Development only — not for production use" : undefined}
                    onClick={() => setSkillRoutingMode(mode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="label" style={{ fontSize: 11 }}>Token budget</span>
                <input
                  type="number" className="input" min={0} step={100} value={skillTokenBudget}
                  onChange={(e) => setSkillTokenBudget(Number(e.target.value))}
                  style={{ width: 120, fontSize: 12.5 }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="label" style={{ fontSize: 11 }}>Max skills (1–2)</span>
                <input
                  type="number" className="input" min={1} max={2} value={maxSelectedSkills}
                  onChange={(e) => setMaxSelectedSkills(Math.max(1, Math.min(2, Number(e.target.value))))}
                  style={{ width: 90, fontSize: 12.5 }}
                />
              </label>
            </div>
          </div>
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn ghost sm" onClick={onClose}>Cancel</button>
            <button type="button" className="btn primary sm" disabled={saving} onClick={handleCreate}>
              {saving ? "Creating…" : "Create preset"}
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

const ROUTING_MODES = [
  ["none", "None", "Never inject a skill body — catalog only."],
  ["auto", "Auto", "Deterministic rules first; LLM resolves ambiguous cases. No fallback-to-all."],
  ["explicit", "Explicit", "Inject only the skill(s) the user picks in the chat composer."],
  ["debug_all", "⚠ Debug only", "Development only — injects ALL skill bodies and bypasses normal routing, cap, and token-budget controls. Blocked in production. Do not use in normal operation."],
] as const;

function RoutingCard({ skillRoutingMode, skillTokenBudget, maxSelectedSkills, isPreview, onChanged }: {
  skillRoutingMode: string;
  skillTokenBudget: number;
  maxSelectedSkills: number;
  isPreview?: boolean;
  onChanged: () => void;
}) {
  const update = useUpdateChatLeverConfig();
  const [budget, setBudget] = useState(skillTokenBudget);
  const [maxSkills, setMaxSkills] = useState(maxSelectedSkills);

  useEffect(() => { setBudget(skillTokenBudget); }, [skillTokenBudget]);
  useEffect(() => { setMaxSkills(maxSelectedSkills); }, [maxSelectedSkills]);

  const activeDesc = ROUTING_MODES.find(([m]) => m === skillRoutingMode)?.[2];

  async function setMode(mode: string) {
    if (mode === skillRoutingMode || isPreview) return;
    try {
      await update.mutateAsync({ data: { skillRoutingMode: mode as never } });
      onChanged();
    } catch (err) { toast({ title: "Update failed", description: (err as Error).message, variant: "destructive" }); }
  }

  async function saveNumbers() {
    if (isPreview) return;
    try {
      await update.mutateAsync({ data: { skillTokenBudget: budget, maxSelectedSkills: maxSkills } });
      onChanged();
      toast({ title: "Routing limits saved" });
    } catch (err) { toast({ title: "Update failed", description: (err as Error).message, variant: "destructive" }); }
  }

  const numbersDirty = budget !== skillTokenBudget || maxSkills !== maxSelectedSkills;

  return (
    <LeverCard
      title="Skill routing"
      subtitle="How skills are selected per turn — progressive disclosure with a token budget."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {ROUTING_MODES.map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={`btn sm${skillRoutingMode === mode ? (mode === "debug_all" ? " destructive" : " accent") : " ghost"}`}
              disabled={update.isPending || isPreview}
              title={mode === "debug_all" ? "Development only — not for production use" : undefined}
              onClick={() => setMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        {activeDesc && <div className="dim" style={{ fontSize: 12 }}>{activeDesc}</div>}

        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="label" style={{ fontSize: 11 }}>Token budget (skill bodies)</span>
            <input
              type="number" className="input" min={0} step={100} value={budget}
              disabled={isPreview}
              onChange={(e) => setBudget(Number(e.target.value))}
              style={{ width: 130, fontSize: 12.5 }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="label" style={{ fontSize: 11 }}>Max skills (1–2)</span>
            <input
              type="number" className="input" min={1} max={2} value={maxSkills}
              disabled={isPreview}
              onChange={(e) => setMaxSkills(Math.max(1, Math.min(2, Number(e.target.value))))}
              style={{ width: 90, fontSize: 12.5 }}
            />
          </label>
          {!isPreview && (
            <button type="button" className="btn primary sm" disabled={!numbersDirty || update.isPending} onClick={saveNumbers}>
              <Save size={12} strokeWidth={1.8} /> Save limits
            </button>
          )}
        </div>
      </div>
    </LeverCard>
  );
}

// ── Inspector ─────────────────────────────────────────────────────────────

const LEVER_COLOR: Record<string, string> = {
  identity: "var(--accent)",
  skill_catalog: "var(--ink-3)",
  skill: "var(--info, var(--accent))",
  best_practices: "var(--warn)",
  attachments: "var(--success)",
};

function InspectorCard({ promptVersions }: { promptVersions: AiPromptVersion[] }) {
  const [sample, setSample] = useState("Help me tailor my resume for this job.");
  const [sections, setSections] = useState<PromptSection[] | null>(null);
  const [decision, setDecision] = useState<RoutingDecision | null>(null);
  const [explicit, setExplicit] = useState<string[]>([]);
  const route = usePreviewChatRoute();
  const skills = useMemo(() => latestPerLabel(promptVersions), [promptVersions]);

  function toggleExplicit(slug: string) {
    setExplicit((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug].slice(0, 2)));
  }

  async function run() {
    if (!sample.trim()) return;
    try {
      const result = await route.mutateAsync({
        data: { sampleMessage: sample.trim(), explicitSkillSlugs: explicit.length > 0 ? explicit : undefined },
      });
      setDecision(result.decision);
      setSections(result.sections as PromptSection[]);
    } catch (err) {
      toast({ title: "Preview failed", description: (err as Error).message, variant: "destructive" });
    }
  }

  return (
    <LeverCard
      title="Router simulator"
      subtitle="See which skills the router selects and exactly what the model reads, for a sample message."
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          className="input"
          value={sample}
          onChange={(e) => setSample(e.target.value)}
          placeholder="A sample user message…"
        />
        <button type="button" className="btn primary sm" disabled={route.isPending} onClick={run}>
          <Eye size={12} strokeWidth={1.8} /> {route.isPending ? "…" : "Route"}
        </button>
      </div>
      {skills.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <span className="dim" style={{ fontSize: 11 }}>Explicit picks (≤2):</span>
          {skills.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`btn sm${explicit.includes(v.label) ? " accent" : " ghost"}`}
              style={{ padding: "2px 8px", fontSize: 11 }}
              onClick={() => toggleExplicit(v.label)}
            >
              {v.roleLabel ?? v.label}
            </button>
          ))}
        </div>
      )}
      {decision && (
        <div style={{
          marginBottom: 12, padding: "10px 12px", borderRadius: 8,
          background: "var(--paper-2)", border: "1px solid var(--line-soft)", fontSize: 12.5,
        }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <span><strong>Selected:</strong> {decision.selectedSlugs.length > 0 ? decision.selectedSlugs.join(", ") : "none"}</span>
            <span className="dim">confidence {decision.confidence.toFixed(2)}</span>
            <span className="dim">{decision.skillPromptTokens} tok</span>
            {decision.llmUsed && <span style={{ color: "var(--info, var(--accent))" }}>LLM used</span>}
            {decision.budgetTrimmed && <span style={{ color: "var(--warn)" }}>budget-trimmed</span>}
          </div>
          <div className="dim" style={{ marginTop: 4 }}>{decision.reason}</div>
        </div>
      )}
      {decision && decision.candidates.length > 0 && (
        <div style={{ marginBottom: 12, fontSize: 11.5, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span className="dim">Candidates:</span>
          {decision.candidates.map((c) => (
            <span key={c.slug} style={{ padding: "1px 6px", borderRadius: 4, background: "var(--paper-2)", border: "1px solid var(--line-soft)" }}>
              {c.slug} <span className="dim">{c.score.toFixed(2)}</span>
            </span>
          ))}
        </div>
      )}
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
