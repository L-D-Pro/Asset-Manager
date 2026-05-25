import { useState } from "react";
import { Portal } from "@/components/ui/portal";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAiPromptVersions,
  useGetAiLearningLeaderboard,
  useCreateAiPromptVersion,
  useUpdateAiPromptVersion,
  useDeleteAiPromptVersion,
  getListAiPromptVersionsQueryKey,
  type AiPromptVersion,
  type AiLearningLeaderboardEntry,
} from "@workspace/api-client-react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

const TASK_SCOPES = ["chat", "default", "jd_parsing", "resume_tailoring", "cover_letter", "claim_generation"] as const;

export default function PromptsPage() {
  const queryClient = useQueryClient();
  const { data: prompts = [], isLoading } = useListAiPromptVersions();
  const { data: leaderboard = [] } = useGetAiLearningLeaderboard();
  const [scope, setScope] = useState("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AiPromptVersion | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListAiPromptVersionsQueryKey() });

  const scopes = ["all", ...Array.from(new Set(prompts.map((p) => p.taskScope)))];
  const filtered = scope === "all" ? prompts : prompts.filter((p) => p.taskScope === scope);

  const winProbById = new Map<number, number>(
    (leaderboard as AiLearningLeaderboardEntry[])
      .filter((e) => e.variantType === "prompt")
      .map((e) => [e.variantId, e.successRate])
  );

  const leaderboardEntries = (leaderboard as AiLearningLeaderboardEntry[])
    .filter((e) => e.variantType === "prompt")
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 2);

  return (
    <div className="page fade-up" style={{ maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div className="eyebrow">ai-learning · prompt versions · Bayesian win prob</div>
          <h1 className="h-display" style={{ marginTop: 4 }}>Prompt versions <em>· what the AI is reading</em></h1>
          <div className="dim" style={{ fontSize: 13, marginTop: 6, maxWidth: 640 }}>
            One prompt is active per task scope. Variants accrue samples; win-probability is computed from your evaluations and feedback signals.
          </div>
        </div>
        <button className="btn primary" type="button" onClick={() => setAdding(true)}>
          <Plus size={13} strokeWidth={1.8} /> New version
        </button>
      </div>

      <div className="tabs" style={{ marginBottom: 14 }}>
        {scopes.map((s) => (
          <div key={s} className={`tab${scope === s ? " active" : ""}`} onClick={() => setScope(s)}>
            {s.replaceAll("_", " ")}
            <span className="mono dim" style={{ marginLeft: 6, fontSize: 11 }}>
              {s === "all" ? prompts.length : prompts.filter((p) => p.taskScope === s).length}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{
          display: "grid",
          gridTemplateColumns: "60px 1fr 130px 90px 130px 100px 90px 64px",
          alignItems: "center",
          gap: 14,
          padding: "10px 18px",
          borderBottom: "1px solid var(--line)",
          background: "var(--paper-2)",
          fontSize: 11,
          color: "var(--ink-4)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 500,
        }}>
          <span>ID</span>
          <span>Goals</span>
          <span>Scope</span>
          <span>Version</span>
          <span>Win prob</span>
          <span>Samples</span>
          <span>State</span>
          <span />
        </div>
        <div className="row-list">
          {isLoading && (
            <div className="dim" style={{ padding: "32px 18px", textAlign: "center", fontSize: 13 }}>Loading…</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="dim" style={{ padding: "32px 18px", textAlign: "center", fontSize: 13 }}>No prompt versions yet.</div>
          )}
          {filtered.map((p) => {
            const winProb = winProbById.get(p.id);
            const lbEntry = (leaderboard as AiLearningLeaderboardEntry[]).find((e) => e.variantType === "prompt" && e.variantId === p.id);
            const samples = lbEntry ? lbEntry.successes + lbEntry.failures + lbEntry.pending : 0;
            return (
              <PromptRow
                key={p.id}
                prompt={p}
                winProb={winProb}
                samples={samples}
                onEdit={() => setEditing(p)}
                onDeleted={invalidate}
              />
            );
          })}
        </div>
      </div>

      {/* Leaderboard card */}
      <div className="card" style={{ marginTop: 22 }}>
        <div className="card-h">
          <h2 className="card-title">Variant leaderboard</h2>
          <span className="dim mono" style={{ fontSize: 11 }}>auto-recompute · based on evaluations</span>
        </div>
        <div className="card-body">
          {leaderboardEntries.length < 2 ? (
            <div className="dim" style={{ fontSize: 12.5 }}>
              Not enough data for comparison. Run more evaluations to build the leaderboard.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
                <PromptVariantCard
                  label="Top performer"
                  version={`v${leaderboardEntries[0]!.variantId}`}
                  name={leaderboardEntries[0]!.label ?? "—"}
                  winProb={leaderboardEntries[0]!.successRate}
                  samples={leaderboardEntries[0]!.successes + leaderboardEntries[0]!.failures}
                  accent
                />
                <div style={{ display: "flex", alignItems: "center", padding: "0 4px", color: "var(--ink-4)" }}>
                  <span className="mono" style={{ fontSize: 14 }}>vs</span>
                </div>
                <PromptVariantCard
                  label="Runner-up"
                  version={`v${leaderboardEntries[1]!.variantId}`}
                  name={leaderboardEntries[1]!.label ?? "—"}
                  winProb={leaderboardEntries[1]!.successRate}
                  samples={leaderboardEntries[1]!.successes + leaderboardEntries[1]!.failures}
                />
              </div>
              <div className="dim" style={{ fontSize: 12.5, marginTop: 16, lineHeight: 1.55 }}>
                Win probability computed from approval outcomes and feedback signals. Will promote automatically once confidence threshold is met.
              </div>
            </>
          )}
        </div>
      </div>

      {adding && (
        <PromptVersionModal
          mode="add"
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); invalidate(); toast({ title: "Prompt version created" }); }}
        />
      )}
      {editing && (
        <PromptVersionModal
          mode="edit"
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); invalidate(); toast({ title: "New version saved — previous archived" }); }}
        />
      )}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function PromptRow({ prompt, winProb, samples, onEdit, onDeleted }: {
  prompt: AiPromptVersion;
  winProb: number | undefined;
  samples: number;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const deleteVersion = useDeleteAiPromptVersion();
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await deleteVersion.mutateAsync({ id: prompt.id });
      onDeleted();
      toast({ title: "Prompt version deleted" });
    } catch (err) {
      toast({ title: "Delete failed", description: (err as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="row" style={{ gridTemplateColumns: "60px 1fr 130px 90px 130px 100px 90px 64px", cursor: "default" }}>
      <span className="mono" style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 500 }}>#{prompt.id}</span>
      <div>
        <div style={{ fontSize: 13.5, color: "var(--ink)" }}>{prompt.goals ?? prompt.label}</div>
        <div className="dim" style={{ fontSize: 11.5, marginTop: 2, fontFamily: "var(--font-mono)" }}>
          role: {(prompt.roleLabel ?? "unknown").toLowerCase()} · updated {format(new Date(prompt.updatedAt), "MMM d")}
        </div>
      </div>
      <span className="chip ghost" style={{ fontSize: 11 }}>{prompt.taskScope.replaceAll("_", " ")}</span>
      <span className="mono" style={{ fontSize: 13 }}>v{prompt.version}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {winProb != null ? (
          <>
            <div style={{ width: 70 }}>
              <div className="bar">
                <i style={{ width: `${winProb * 100}%`, background: winProb >= 0.6 ? "var(--accent)" : "var(--warn)" }} />
              </div>
            </div>
            <span className="mono" style={{ fontSize: 12 }}>{Math.round(winProb * 100)}%</span>
          </>
        ) : (
          <span className="mono dim" style={{ fontSize: 12 }}>—</span>
        )}
      </div>
      <span className="mono dim" style={{ fontSize: 12 }}>{samples > 0 ? samples : "—"}</span>
      {prompt.isActive ? (
        <span className="chip success dot" style={{ fontSize: 10.5 }}>active</span>
      ) : (
        <span className="chip ghost" style={{ fontSize: 10.5 }}>archived</span>
      )}
      <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
        <button
          type="button" className="btn ghost" style={{ padding: "3px 5px" }}
          title="Edit (creates new version)" onClick={(e) => { e.stopPropagation(); onEdit(); }}
        >
          <Pencil size={11} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className={confirmDelete ? "btn danger" : "btn ghost"}
          style={{ padding: "3px 5px", color: confirmDelete ? undefined : "var(--danger, #d73a49)" }}
          title={confirmDelete ? "Confirm delete" : "Delete version"}
          disabled={deleteVersion.isPending}
          onClick={handleDelete}
          onBlur={() => setConfirmDelete(false)}
        >
          {confirmDelete ? (deleteVersion.isPending ? "…" : "✓") : <Trash2 size={11} strokeWidth={1.8} />}
        </button>
      </span>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function PromptVersionModal({ mode, existing, onClose, onSaved }: {
  mode: "add" | "edit";
  existing?: AiPromptVersion;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [taskScope, setTaskScope] = useState(existing?.taskScope ?? "");
  const [label, setLabel] = useState(existing?.label ?? "");
  const [roleLabel, setRoleLabel] = useState(existing?.roleLabel ?? "");
  const [body, setBody] = useState(existing?.systemPrompt ?? "");
  const create = useCreateAiPromptVersion();
  const update = useUpdateAiPromptVersion();

  async function handleSave() {
    if (!taskScope) { toast({ title: "Task scope required", variant: "destructive" }); return; }
    if (!label.trim()) { toast({ title: "Slug required", variant: "destructive" }); return; }
    if (!body.trim()) { toast({ title: "Body required", variant: "destructive" }); return; }
    try {
      if (mode === "edit" && existing) {
        await create.mutateAsync({
          data: {
            taskScope: existing.taskScope,
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
            taskScope,
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
        style={{ width: 640, maxHeight: "calc(100vh - 48px)", background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-h">
          <h2 className="card-title">
            {mode === "edit" ? `Edit · ${existing?.label} — will create v${(existing?.version ?? 0) + 1}` : "New prompt version"}
          </h2>
          <button type="button" className="settings-x" onClick={onClose}><X size={14} strokeWidth={2} /></button>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
          {mode === "add" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 5 }}>Task scope</label>
                <select className="input" value={taskScope} onChange={(e) => setTaskScope(e.target.value)}>
                  <option value="">— select —</option>
                  {TASK_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 5 }}>Slug</label>
                <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. resume-opener" />
              </div>
            </div>
          )}
          {mode === "edit" && (
            <div className="dim" style={{ fontSize: 12, padding: "6px 10px", background: "var(--paper-2)", borderRadius: 6 }}>
              Scope: <span className="mono">{existing?.taskScope}</span> · Slug: <span className="mono">{existing?.label}</span>
            </div>
          )}
          <div>
            <label className="label" style={{ display: "block", marginBottom: 5 }}>Display name</label>
            <input className="input" value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} placeholder="e.g. Resume Opener" />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 5 }}>Prompt body</label>
            <textarea
              className="input" value={body} onChange={(e) => setBody(e.target.value)} rows={16}
              style={{ resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.5 }}
            />
            {mode === "edit" && (
              <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
                Saving creates v{(existing?.version ?? 1) + 1} and archives v{existing?.version}.
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn ghost sm" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary sm" disabled={busy} onClick={handleSave}>
            {busy ? "Saving…" : mode === "edit" ? "Save new version" : "Create"}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}

// ── Leaderboard card ──────────────────────────────────────────────────────────

function PromptVariantCard({
  label, version, name, winProb, samples, accent,
}: {
  label: string; version: string; name: string; winProb: number; samples: number; accent?: boolean;
}) {
  return (
    <div className="card flat" style={{
      flex: 1, padding: 18,
      background: accent ? "var(--accent-bg)" : "var(--paper-2)",
      borderColor: accent ? "var(--accent-line)" : "var(--line-soft)",
    }}>
      <div className="label" style={{ marginBottom: 8, color: accent ? "var(--accent-ink)" : "var(--ink-4)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span className="h-display" style={{ fontSize: 28, color: accent ? "var(--accent-ink)" : "var(--ink)" }}>{version}</span>
        <span className="mono" style={{ fontSize: 12, color: accent ? "var(--accent-ink)" : "var(--ink-3)" }}>{samples} samples</span>
      </div>
      <div className="dim" style={{ fontSize: 12, marginBottom: 10, color: accent ? "var(--accent-ink)" : "var(--ink-3)" }}>{name}</div>
      <div style={{ marginBottom: 6, fontSize: 11, color: accent ? "var(--accent-ink)" : "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Win prob</div>
      <div className="bar" style={{ background: "rgba(255,255,255,0.5)" }}>
        <i style={{ width: `${winProb * 100}%` }} />
      </div>
      <div className="mono" style={{ fontSize: 16, marginTop: 6, color: accent ? "var(--accent-ink)" : "var(--ink)" }}>
        {Math.round(winProb * 100)}%
      </div>
    </div>
  );
}
