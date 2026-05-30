import React, { useState } from "react";
import { Portal } from "@/components/ui/portal";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAiModelConfigs,
  useGetModelConfigHealth,
  useGetAiPipelineOverview,
  useCreateAiModelConfig,
  useUpdateAiModelConfig,
  useDeleteAiModelConfig,
  type AiModelConfig,
  type AiPipelineTaskSummary,
} from "@workspace/api-client-react";
import { Plus, Shield, X, Pencil, Trash2 } from "lucide-react";

const COMMON_SCOPES = ["chat", "skill_routing", "jd_parsing", "resume_tailoring", "cover_letter", "claim_generation"] as const;

export default function ModelsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AiModelConfig | null>(null);
  const { data: models = [], isLoading } = useListAiModelConfigs();
  const { data: health } = useGetModelConfigHealth();
  const { data: pipeline = [] } = useGetAiPipelineOverview();

  const healthyCount = health?.scopes.filter((s) => s.healthy).length ?? 0;
  const totalCount = health?.scopes.length ?? 0;

  return (
    <div className="page fade-up" style={{ maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div className="eyebrow">ai-model-configs · per-task model assignments + fallbacks</div>
          <h1 className="h-display" style={{ marginTop: 4 }}>Models <em>· which AI runs where</em></h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" type="button">
            <Shield size={13} strokeWidth={1.8} /> Health
          </button>
          <button className="btn primary" type="button" onClick={() => setDialogOpen(true)}>
            <Plus size={13} strokeWidth={1.8} /> Add config
          </button>
        </div>
      </div>

      {/* Health summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 22 }}>
        <HealthCard
          label="Healthy scopes"
          value={totalCount > 0 ? `${healthyCount} / ${totalCount}` : "—"}
          tone={healthyCount === totalCount ? "success" : "warn"}
        />
        <HealthCard label="Fallback rate (24h)" value="—" tone="ok" />
        <HealthCard label="Error rate (24h)" value="—" tone="ok" />
        <HealthCard label="Median latency" value="—" tone="ok" />
      </div>

      <div className="card">
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 140px 200px 200px 90px 90px 70px 32px",
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
          <span>Scope</span>
          <span>Provider</span>
          <span>Primary</span>
          <span>Fallback</span>
          <span>Error %</span>
          <span>P50</span>
          <span />
          <span />
        </div>
        <div className="row-list">
          {isLoading && (
            <div className="dim" style={{ padding: "32px 18px", textAlign: "center", fontSize: 13 }}>Loading…</div>
          )}
          {!isLoading && models.length === 0 && (
            <div className="dim" style={{ padding: "32px 18px", textAlign: "center", fontSize: 13 }}>No model configs yet.</div>
          )}
          {models.map((m) => (
            <ModelRow key={m.id} model={m} allModels={models} onEdit={setEditingModel} onDeleted={() => queryClient.invalidateQueries({ queryKey: ["/api/ai-model-configs"] })} />
          ))}
        </div>
      </div>

      {/* Pipeline visualization */}
      <div className="card" style={{ marginTop: 22 }}>
        <div className="card-h">
          <h2 className="card-title">Pipeline · resume_tailoring</h2>
          <span className="dim mono" style={{ fontSize: 11 }}>ai-pipeline endpoint</span>
        </div>
        <div className="card-body">
          <PipelineViz pipeline={pipeline} />
        </div>
      </div>

      {dialogOpen && (
        <CreateConfigDialog
          allModels={models}
          onClose={() => setDialogOpen(false)}
        />
      )}
      {editingModel && (
        <EditConfigDialog
          model={editingModel}
          allModels={models}
          onClose={() => setEditingModel(null)}
        />
      )}
    </div>
  );
}

function ModelRow({ model, allModels, onEdit, onDeleted }: { model: AiModelConfig; allModels: AiModelConfig[]; onEdit: (m: AiModelConfig) => void; onDeleted: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { mutateAsync: deleteConfig, isPending } = useDeleteAiModelConfig();
  const fallback = allModels.find((m) => m.id === model.fallbackModelId);

  async function handleDelete() {
    try {
      await deleteConfig({ id: model.id });
      onDeleted();
    } catch (err) {
      alert((err as Error).message ?? "Delete failed");
    }
  }

  return (
    <div className="row" style={{ gridTemplateColumns: "1fr 140px 200px 200px 90px 90px 70px 64px", cursor: "default" }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{model.taskScope.replaceAll("_", " ")}</div>
        <div className="dim mono" style={{ fontSize: 11, marginTop: 2 }}>priority {model.priority}</div>
      </div>
      <span className="chip" style={{ fontSize: 11 }}>{model.provider}</span>
      <span className="mono" style={{ fontSize: 12.5, color: "var(--ink)" }}>{model.modelName}</span>
      <span className="mono dim" style={{ fontSize: 12.5 }}>
        {fallback
          ? <span title={fallback.modelName}>{fallback.modelName.split("/").pop()}</span>
          : model.fallbackModelId
            ? `#${model.fallbackModelId}`
            : <em style={{ fontFamily: "var(--font-display)" }}>none</em>}
      </span>
      <span className="mono" style={{ fontSize: 12, color: "var(--success)" }}>—</span>
      <span className="mono dim" style={{ fontSize: 12 }}>—</span>
      <span className={`chip ${model.isActive ? "success" : "ghost"} dot`} style={{ fontSize: 10.5 }}>
        {model.isActive ? "active" : "off"}
      </span>
      <span style={{ display: "flex", gap: 4 }}>
        <button type="button" className="btn ghost" style={{ padding: "3px 6px" }} title="Edit config" onClick={() => onEdit(model)}>
          <Pencil size={12} strokeWidth={1.8} />
        </button>
        {confirmDelete ? (
          <button type="button" className="btn danger" style={{ padding: "3px 6px", fontSize: 11 }} disabled={isPending} onClick={handleDelete} title="Confirm delete">
            {isPending ? "…" : "✓"}
          </button>
        ) : (
          <button type="button" className="btn ghost" style={{ padding: "3px 6px", color: "var(--danger, #d73a49)" }} title="Delete config" onClick={() => setConfirmDelete(true)} onBlur={() => setConfirmDelete(false)}>
            <Trash2 size={12} strokeWidth={1.8} />
          </button>
        )}
      </span>
    </div>
  );
}

// ── Create Config Dialog ──────────────────────────────────────────────────

interface CreateConfigForm {
  taskScope: string;
  modelName: string;
  priority: string;
  fallbackModelId: string;
  isActive: boolean;
}

function CreateConfigDialog({ allModels, onClose }: { allModels: AiModelConfig[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { mutateAsync: createConfig, isPending } = useCreateAiModelConfig();

  const [form, setForm] = useState<CreateConfigForm>({
    taskScope: "",
    modelName: "",
    priority: "1",
    fallbackModelId: "",
    isActive: true,
  });
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof CreateConfigForm, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.taskScope.trim()) { setError("Task scope is required."); return; }
    if (!form.modelName.trim()) { setError("Model name is required."); return; }
    const priority = Number(form.priority);
    if (!Number.isFinite(priority) || priority < 1) { setError("Priority must be a positive number."); return; }

    try {
      await createConfig({
        data: {
          taskScope: form.taskScope.trim(),
          modelName: form.modelName.trim(),
          provider: "openrouter",
          priority,
          isActive: form.isActive,
          fallbackModelId: form.fallbackModelId ? Number(form.fallbackModelId) : undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/ai-model-configs"] });
      onClose();
    } catch (err) {
      setError((err as Error).message ?? "Failed to create config.");
    }
  }

  return (
    <Portal>
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ width: 460, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-h">
          <h2 className="card-title">Add model config</h2>
          <button type="button" className="settings-x" onClick={onClose} aria-label="Close"><X size={14} strokeWidth={2} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Task scope */}
          <div>
            <label className="label" style={{ display: "block", marginBottom: 5 }}>Task scope</label>
            <select
              className="input"
              value={form.taskScope}
              onChange={(e) => set("taskScope", e.target.value)}
              autoFocus
            >
              <option value="">— select a scope —</option>
              {COMMON_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
              Scopes are fixed — each maps to a specific pipeline in the backend.
            </div>
          </div>

          {/* Model name */}
          <div>
            <label className="label" style={{ display: "block", marginBottom: 5 }}>Model name</label>
            <input
              className="input"
              value={form.modelName}
              onChange={(e) => set("modelName", e.target.value)}
              placeholder="e.g. anthropic/claude-3.5-haiku"
            />
            <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>OpenRouter model ID — find them at openrouter.ai/models</div>
          </div>

          {/* Priority + isActive row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5 }}>Priority</label>
              <input
                className="input"
                type="number"
                min={1}
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
              />
              <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>Lower = tried first. Default: 1</div>
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5 }}>Active</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isActive}
                  onClick={() => set("isActive", !form.isActive)}
                  style={{
                    width: 36, height: 20, borderRadius: 99,
                    background: form.isActive ? "var(--accent)" : "var(--line)",
                    border: "none", cursor: "pointer", position: "relative", transition: "background 0.15s",
                  }}
                >
                  <span style={{
                    position: "absolute", top: 3, left: form.isActive ? 19 : 3,
                    width: 14, height: 14, borderRadius: "50%", background: "#fff",
                    transition: "left 0.15s",
                  }} />
                </button>
                <span className="dim" style={{ fontSize: 12 }}>{form.isActive ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
          </div>

          {/* Fallback model */}
          <div>
            <label className="label" style={{ display: "block", marginBottom: 5 }}>Fallback model <span className="dim" style={{ fontWeight: 400 }}>(optional)</span></label>
            <select
              className="input"
              value={form.fallbackModelId}
              onChange={(e) => set("fallbackModelId", e.target.value)}
              style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
            >
              <option value="">— none —</option>
              {allModels.map((m) => (
                <option key={m.id} value={m.id}>
                  #{m.id} · {m.taskScope} · {m.modelName}
                </option>
              ))}
            </select>
            <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>If the primary model fails at runtime, the fallback is tried and a notice appears in chat.</div>
          </div>

          {error && (
            <div className="chip danger" style={{ fontSize: 12 }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
            <button type="button" className="btn ghost sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary sm" disabled={isPending}>
              {isPending ? "Saving…" : "Create config"}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}

function EditConfigDialog({ model, allModels, onClose }: { model: AiModelConfig; allModels: AiModelConfig[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { mutateAsync: updateConfig, isPending } = useUpdateAiModelConfig();

  const [form, setForm] = useState<CreateConfigForm>({
    taskScope: model.taskScope,
    modelName: model.modelName,
    priority: String(model.priority),
    fallbackModelId: model.fallbackModelId != null ? String(model.fallbackModelId) : "",
    isActive: model.isActive ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof CreateConfigForm, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.taskScope.trim()) { setError("Task scope is required."); return; }
    if (!form.modelName.trim()) { setError("Model name is required."); return; }
    const priority = Number(form.priority);
    if (!Number.isFinite(priority) || priority < 1) { setError("Priority must be a positive number."); return; }

    try {
      await updateConfig({
        id: model.id,
        data: {
          taskScope: form.taskScope.trim(),
          modelName: form.modelName.trim(),
          priority,
          isActive: form.isActive,
          fallbackModelId: form.fallbackModelId ? Number(form.fallbackModelId) : null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/ai-model-configs"] });
      onClose();
    } catch (err) {
      setError((err as Error).message ?? "Failed to update config.");
    }
  }

  return (
    <Portal>
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ width: 460, background: "var(--card)", border: "1px solid var(--line)", borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-pop)", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-h">
          <h2 className="card-title">Edit model config <span className="dim mono" style={{ fontSize: 12 }}>#{model.id}</span></h2>
          <button type="button" className="settings-x" onClick={onClose} aria-label="Close"><X size={14} strokeWidth={2} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 5 }}>Task scope</label>
            <select className="input" value={form.taskScope} onChange={(e) => set("taskScope", e.target.value)}>
              <option value="">— select a scope —</option>
              {COMMON_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="label" style={{ display: "block", marginBottom: 5 }}>Model name</label>
            <input className="input" value={form.modelName} onChange={(e) => set("modelName", e.target.value)} placeholder="e.g. anthropic/claude-3.5-haiku" />
            <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>OpenRouter model ID — find them at openrouter.ai/models</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5 }}>Priority</label>
              <input className="input" type="number" min={1} value={form.priority} onChange={(e) => set("priority", e.target.value)} />
              <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>Lower = tried first.</div>
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5 }}>Active</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                <button
                  type="button" role="switch" aria-checked={form.isActive}
                  onClick={() => set("isActive", !form.isActive)}
                  style={{ width: 36, height: 20, borderRadius: 99, background: form.isActive ? "var(--accent)" : "var(--line)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.15s" }}
                >
                  <span style={{ position: "absolute", top: 3, left: form.isActive ? 19 : 3, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
                </button>
                <span className="dim" style={{ fontSize: 12 }}>{form.isActive ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="label" style={{ display: "block", marginBottom: 5 }}>Fallback model <span className="dim" style={{ fontWeight: 400 }}>(optional)</span></label>
            <select className="input" value={form.fallbackModelId} onChange={(e) => set("fallbackModelId", e.target.value)} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
              <option value="">— none —</option>
              {allModels.filter((m) => m.id !== model.id).map((m) => (
                <option key={m.id} value={m.id}>#{m.id} · {m.taskScope} · {m.modelName}</option>
              ))}
            </select>
          </div>

          {error && <div className="chip danger" style={{ fontSize: 12 }}>{error}</div>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
            <button type="button" className="btn ghost sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary sm" disabled={isPending}>{isPending ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}

const PIPELINE_STEPS = [
  { name: "jd_parsing", model: "haiku-4.5", color: "info" },
  { name: "claim_match", model: "haiku-4.5", color: "info" },
  { name: "resume_tailoring", model: "sonnet-4.5", color: "accent" },
  { name: "ats_score", model: "haiku-4.5", color: "info" },
  { name: "approval_gate", model: "human", color: "warn" },
] as const;

function PipelineViz({ pipeline }: { pipeline: AiPipelineTaskSummary[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", padding: "4px 0" }}>
      {PIPELINE_STEPS.map((s, i) => {
        const live = pipeline.find((p) => p.taskScope === s.name);
        const modelLabel = live?.modelName ?? s.model;
        return (
          <React.Fragment key={s.name}>
            <div style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--paper-2)",
              minWidth: 160,
              flexShrink: 0,
            }}>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                step {i + 1}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>{s.name.replaceAll("_", " ")}</div>
              <span className={`chip ${s.color} dot`} style={{ fontSize: 10.5, marginTop: 6 }}>{modelLabel}</span>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <span style={{ color: "var(--ink-4)", flexShrink: 0, fontSize: 16 }}>›</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function HealthCard({ label, value, tone }: { label: string; value: string; tone: "success" | "warn" | "ok" }) {
  const dotColor = tone === "success" ? "var(--success)" : tone === "warn" ? "var(--warn)" : "var(--accent)";
  return (
    <div className="card flat" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="label">{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: dotColor }} />
        <span className="h-display" style={{ fontSize: 22 }}>{value}</span>
      </div>
    </div>
  );
}
