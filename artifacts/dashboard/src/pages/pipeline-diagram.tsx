import { useState } from "react";
import { useAiPipelineOverview } from "@/components/ai-pipeline/useAiPipelineOverview";
import { AiTaskDetailPanel } from "@/components/ai-pipeline/AiTaskDetailPanel";
import { TASK_SCOPES, type AiPipelineTaskSummary } from "@/components/ai-pipeline/types";
import { ChevronRight, X } from "lucide-react";

const WORKFLOW_STAGES: ReadonlyArray<{ id: string; label: string; step: number; blurb: string }> = [
  { id: "intake",  label: "Intake",       step: 1, blurb: "Paste raw job description" },
  { id: "parse",   label: "JD Parse",     step: 2, blurb: "AI extracts requirements" },
  { id: "role",    label: "Role Profile", step: 3, blurb: "Match claims to role" },
  { id: "tailor",  label: "Tailor",       step: 4, blurb: "Generate resume + cover" },
  { id: "approve", label: "Approve",      step: 5, blurb: "Truth-lock review" },
  { id: "apply",   label: "Apply",        step: 6, blurb: "Submit & track outcome" },
];

const TASK_LABELS: Record<string, string> = {
  jd_parsing:       "JD Parsing",
  claim_generation: "Claim Generation",
  gap_analysis:     "Gap Analysis",
  resume_tailoring: "Resume Tailoring",
  cover_letter:     "Cover Letter",
  job_research:     "Job Research",
  market_research:  "Market Research",
  proposal_drafting:"Proposal Drafting",
  quality_check:    "Quality Check",
};

const SCOPE_STEP: Record<string, number> = {
  jd_parsing:       2,
  claim_generation: 3,
  gap_analysis:     3,
  resume_tailoring: 4,
  cover_letter:     4,
  job_research:     1,
  market_research:  1,
  proposal_drafting:4,
  quality_check:    4,
};

function emptySummariesFromScopes(): AiPipelineTaskSummary[] {
  return TASK_SCOPES.map((scope) => ({
    taskScope: scope,
    activePromptVersionId: null,
    activePromptLabel: null,
    roleLabel: null,
    modelName: null,
    modelConfigId: null,
    bestPracticesEnabledCount: 0,
    trainingExampleCount: 0,
  }));
}

export default function PipelineDiagram() {
  const overview = useAiPipelineOverview();
  const [selected, setSelected] = useState<string | null>(null);

  const tasks: AiPipelineTaskSummary[] =
    overview.data && overview.data.length > 0 ? overview.data : emptySummariesFromScopes();

  const showOverviewMissing =
    !overview.isLoading && (overview.isError || (overview.data?.length ?? 0) === 0);

  const selectedTask = selected ? tasks.find((t) => t.taskScope === selected) : null;

  return (
    <div className="page fade-up" style={{ maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div className="eyebrow">admin · ai pipeline · prompts · roles · models · best practices</div>
          <h1 className="h-display" style={{ marginTop: 4 }}>
            AI Pipeline Hub <em>· every lever that shapes a call</em>
          </h1>
          <div className="dim" style={{ fontSize: 13, marginTop: 6, maxWidth: 600 }}>
            One surface for every lever that shapes an AI call: prompts, roles, models, best practices, and training examples.
            <br />
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
              Tailoring Pipeline: Resume Tailoring / Cover Letter &rarr; Quality Check &rarr; ATS Score &rarr; Approval Gate
            </span>
          </div>
        </div>
        {overview.isLoading && (
          <span className="dim mono" style={{ fontSize: 11.5 }}>Loading…</span>
        )}
      </div>

      {/* Workflow pipeline strip */}
      <div className="card flat" style={{ padding: "14px 18px", marginBottom: 18, overflowX: "auto" }}>
        <div className="label" style={{ marginBottom: 12 }}>User workflow</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: "max-content" }}>
          {WORKFLOW_STAGES.map((stage, i, arr) => (
            <div key={stage.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                padding: "9px 14px", borderRadius: "var(--r-md)",
                border: "1px solid var(--line)", background: "var(--paper-2)",
                minWidth: 120, flexShrink: 0,
              }}>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
                  step {stage.step}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{stage.label}</div>
                <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>{stage.blurb}</div>
              </div>
              {i < arr.length - 1 && (
                <ChevronRight size={14} strokeWidth={2} style={{ color: "var(--ink-4)", flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {showOverviewMissing && (
        <div className="card flat" style={{
          padding: "10px 16px", marginBottom: 14, fontSize: 12.5, color: "var(--ink-3)",
          borderColor: "var(--warn)", background: "color-mix(in oklch, var(--warn) 6%, var(--card))",
        }}>
          Live summary endpoint unavailable — showing task scopes only. Counts and active labels will populate once
          <span className="mono" style={{ fontSize: 11.5 }}> GET /api/ai-pipeline/overview</span> is deployed.
        </div>
      )}

      {/* Task cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginBottom: selected ? 18 : 0 }}>
        {tasks.map((task) => {
          const isSelected = selected === task.taskScope;
          const stepN = SCOPE_STEP[task.taskScope];
          const hasData = task.modelName !== null || task.activePromptVersionId !== null;
          return (
            <button
              key={task.taskScope}
              type="button"
              onClick={() => setSelected(isSelected ? null : task.taskScope)}
              aria-pressed={isSelected}
              style={{
                textAlign: "left", background: isSelected ? "var(--accent-bg)" : "var(--card)",
                border: `1px solid ${isSelected ? "var(--accent-line)" : "var(--line)"}`,
                borderRadius: "var(--r-xl)", padding: "14px 16px",
                cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
                display: "flex", flexDirection: "column", gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 10, color: isSelected ? "var(--accent-ink)" : "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
                    {task.taskScope.replaceAll("_", " ")}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: isSelected ? "var(--accent-ink)" : "var(--ink)" }}>
                    {task.roleLabel ?? TASK_LABELS[task.taskScope] ?? task.taskScope}
                  </div>
                </div>
                {stepN && (
                  <span className="chip ghost" style={{ fontSize: 10, flexShrink: 0 }}>step {stepN}</span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div className="mono dim" style={{ fontSize: 11.5 }}>
                  {task.modelName ?? <span style={{ fontStyle: "italic" }}>no model</span>}
                </div>
                <div className="mono dim" style={{ fontSize: 11.5 }}>
                  prompt {task.activePromptVersionId != null ? `#${task.activePromptVersionId}` : "—"}
                  {task.activePromptLabel ? ` · ${task.activePromptLabel}` : ""}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <span className={hasData ? "chip success dot" : "chip ghost"} style={{ fontSize: 10 }}>
                  {task.bestPracticesEnabledCount} rules
                </span>
                <span className="chip ghost" style={{ fontSize: 10 }}>
                  {task.trainingExampleCount} examples
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      {selected && selectedTask && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="card-h">
            <div>
              <div className="mono dim" style={{ fontSize: 10.5, marginBottom: 2 }}>
                {selected.replaceAll("_", " ")}
              </div>
              <h2 className="card-title">
                {selectedTask.roleLabel ?? TASK_LABELS[selected] ?? selected}
              </h2>
            </div>
            <button
              type="button"
              className="settings-x"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <AiTaskDetailPanel taskScope={selected} />
          </div>
        </div>
      )}
    </div>
  );
}
