import { useState } from "react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContentCard } from "@/components/ui/content-card";
import { PageHeader } from "@/components/ui/page-header";
import { AiTaskDetailPanel } from "@/components/ai-pipeline/AiTaskDetailPanel";
import { useAiPipelineOverview } from "@/components/ai-pipeline/useAiPipelineOverview";
import { TASK_SCOPES, type AiPipelineTaskSummary } from "@/components/ai-pipeline/types";

// ─── User-workflow narrative strip ────────────────────────────────────────────
const WORKFLOW_STAGES: ReadonlyArray<{ id: string; label: string; icon: string; blurb: string }> = [
  { id: "intake", label: "Intake", icon: "📋", blurb: "Paste the raw job description." },
  { id: "parse", label: "JD Parse", icon: "🔍", blurb: "AI extracts structured requirements." },
  { id: "role", label: "Role Profile", icon: "🎯", blurb: "Match claims to the target role." },
  { id: "tailor", label: "Tailor", icon: "✂️", blurb: "Generate resume + cover letter." },
  { id: "approve", label: "Approve", icon: "✅", blurb: "Truth-Lock review and sign-off." },
  { id: "apply", label: "Apply", icon: "🚀", blurb: "Submit and track outcome." },
];

const TASK_LABELS: Record<string, string> = {
  jd_parsing: "JD Parsing",
  claim_generation: "Claim Generation",
  gap_analysis: "Gap Analysis",
  resume_tailoring: "Resume Tailoring",
  cover_letter: "Cover Letter",
  job_research: "Job Research",
  market_research: "Market Research",
  proposal_drafting: "Proposal Drafting",
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

  const showOverviewMissing = !overview.isLoading && (overview.isError || (overview.data?.length ?? 0) === 0);

  return (
    <div>
      <PageHeader
        title="AI Pipeline Hub"
        subtitle="One surface for every lever that shapes an AI call: prompts, roles, models, best practices, and examples."
        variant="data"
      />

      {/* ── Workflow narrative ─────────────────────────────────────────── */}
      <section>
        <h2>User Workflow</h2>
        <div>
          {WORKFLOW_STAGES.map((stage, index) => (
            <div
              key={stage.id}
            >
              <span>{stage.icon}</span>
              <div>
                <div>
                  <span>{index + 1}.</span>
                  <span>{stage.label}</span>
                </div>
                <p>{stage.blurb}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI Tasks grid ──────────────────────────────────────────────── */}
      <section>
        <div>
          <h2>AI Tasks</h2>
          {overview.isLoading && <span>Loading…</span>}
        </div>

        {showOverviewMissing && (
          <div>
            Live summary endpoint unavailable. Showing scopes only — counts and active labels will populate once
            <span> GET /api/ai-pipeline/overview</span> is deployed.
          </div>
        )}

        <div>
          {tasks.map((task) => {
            const isSelected = selected === task.taskScope;
            return (
              <button
                key={task.taskScope}
                type="button"
                onClick={() => setSelected(isSelected ? null : task.taskScope)}
                aria-pressed={isSelected}
                aria-label={`${TASK_LABELS[task.taskScope] ?? task.taskScope} task`}
                
              >
                <div>
                  <div>{task.taskScope}</div>
                  <div>
                    {task.roleLabel ?? TASK_LABELS[task.taskScope] ?? task.taskScope}
                  </div>
                  <div>
                    {task.modelName ?? "no model"}
                    {" · "}
                    prompt #{task.activePromptVersionId ?? "—"}
                  </div>
                  <div>
                    {task.bestPracticesEnabledCount} rules · {task.trainingExampleCount} examples
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Detail panel ───────────────────────────────────────────────── */}
      {selected && (
        <ContentCard>
          <CardHeader>
            <CardTitle>{selected}</CardTitle>
          </CardHeader>
          <CardContent>
            <AiTaskDetailPanel taskScope={selected} />
          </CardContent>
        </ContentCard>
      )}
    </div>
  );
}
