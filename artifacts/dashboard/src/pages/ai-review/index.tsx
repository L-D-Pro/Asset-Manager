import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAiReviewOverviewQueryKey,
  useCreateAiPromptVersion,
  useGetAiReviewOverview,
  useUpdateAiPromptVersion,
} from "@workspace/api-client-react";
import type { AiPromptVersion, EventLog } from "@workspace/api-client-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { ContentCard } from "@/components/ui/content-card";
import { Brain, ChevronDown, ChevronUp, FlaskConical, History, Pencil, ShieldCheck, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/api-errors";
import { Link } from "react-router-dom";
import { useState } from "react";
import type React from "react";

const DEFAULT_PROMPT = {
  taskScope: "resume_tailoring",
  label: "",
  version: 1,
  systemPrompt: "",
  userPromptTemplate: "{{userPrompt}}",
  notes: "",
  isActive: false,
};

export default function AiReviewPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [promptForm, setPromptForm] = useState(DEFAULT_PROMPT);
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [editingPromptId, setEditingPromptId] = useState<number | null>(null);
  const { data, isLoading } = useGetAiReviewOverview();

  const createPrompt = useCreateAiPromptVersion({
    mutation: {
      onSuccess: () => {
        toast({ title: "Prompt version saved" });
        setPromptForm(DEFAULT_PROMPT);
        queryClient.invalidateQueries({ queryKey: getGetAiReviewOverviewQueryKey() });
      },
      onError: (error) =>
        toast({
          title: "Failed to save prompt version",
          description: getErrorMessage(error, "Please check the prompt fields."),
          variant: "destructive",
        }),
    },
  });

  const stats = data?.stats;

  return (
    <div>
      <PageHeader
        title="AI Review"
        subtitle="Version prompts, inspect AI runs, and curate supervised learning signals without fine-tuning prematurely."
        variant="data"
      />

      <p>
        Want to edit prompt + role + model + best practices for one task in a single panel?{" "}
        <Link to="/pipeline-diagram">
          Open the AI Pipeline Hub
        </Link>
        .
      </p>

      <div>
        <Metric title="Recent AI Runs" value={stats?.recentAiEvents ?? 0} icon={<History />} />
        <Metric title="Evaluations" value={stats?.evaluations ?? 0} icon={<ShieldCheck />} />
        <Metric title="Active Prompts" value={stats?.activePromptVersions ?? 0} icon={<Brain />} />
        <Metric title="Training Examples" value={stats?.trainingExamples ?? 0} icon={<FlaskConical />} />
      </div>

      <ContentCard>
        <CardHeader>
          <CardTitle>Create Prompt Version</CardTitle>
          <CardDescription>
            Active versions override the built-in prompt for a task. Use {"{{userPrompt}}"} inside the template to preserve runtime context.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <div>
              <label>Task Scope</label>
              <Input
                value={promptForm.taskScope}
                onChange={(event) => setPromptForm({ ...promptForm, taskScope: event.target.value })}
                placeholder="e.g., resume_tailoring, cover_letter"
              />
              <p>The AI pipeline task this prompt overrides</p>
            </div>
            <div>
              <label>Label</label>
              <Input
                value={promptForm.label}
                onChange={(event) => setPromptForm({ ...promptForm, label: event.target.value })}
                placeholder="e.g., baseline-v1, improved-v2"
              />
              <p>Human-readable name for this version</p>
            </div>
            <div>
              <label>Version Number</label>
              <Input
                type="number"
                value={promptForm.version}
                onChange={(event) => setPromptForm({ ...promptForm, version: Number(event.target.value) })}
                placeholder="1, 2, 3..."
              />
              <p>Numeric version within this task scope</p>
            </div>
          </div>
          <div>
            <label>System Prompt</label>
            <Textarea
              value={promptForm.systemPrompt}
              onChange={(event) => setPromptForm({ ...promptForm, systemPrompt: event.target.value })}
              placeholder="Instructions for the AI (e.g., 'You are a professional resume writer...')"
            />
            <p>The system message sent to the AI model</p>
          </div>
          <div>
            <label>User Prompt Template</label>
            <Textarea
              value={promptForm.userPromptTemplate}
              onChange={(event) => setPromptForm({ ...promptForm, userPromptTemplate: event.target.value })}
              placeholder="Template with {{userPrompt}} placeholder for runtime context"
            />
            <p>Use {'{{userPrompt}}'} where runtime content should be inserted</p>
          </div>
          <div>
            <label>
              <input
                type="checkbox"
                checked={promptForm.isActive}
                onChange={(event) => setPromptForm({ ...promptForm, isActive: event.target.checked })}
              />
              <span>Make active for this task</span>
            </label>
            <Button
              onClick={() => createPrompt.mutate({ data: promptForm })}
              disabled={!promptForm.label || !promptForm.systemPrompt || createPrompt.isPending}
            >
              {createPrompt.isPending ? "Saving..." : "Save Prompt Version"}
            </Button>
          </div>
        </CardContent>
      </ContentCard>

      <div>
        <ContentCard>
          <CardHeader>
            <CardTitle>Recent AI Events</CardTitle>
            <CardDescription>Click any event to see the full call details — model, tokens, cost, and attempt metadata.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <p>Loading...</p> : null}
            {data?.recentAiEvents.map((event) => (
              <AiEventRow
                key={event.id}
                event={event}
                expanded={expandedEventId === event.id}
                onToggle={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
              />
            ))}
          </CardContent>
        </ContentCard>

        <ContentCard>
          <CardHeader>
            <CardTitle>Prompt Versions</CardTitle>
            <CardDescription>Edit a prompt to update its content and model instructions. Activate only the version you want in production.</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.promptVersions.map((prompt) => (
              <PromptVersionRow
                key={prompt.id}
                prompt={prompt}
                editing={editingPromptId === prompt.id}
                onEdit={() => setEditingPromptId(prompt.id)}
                onCancel={() => setEditingPromptId(null)}
                onSaved={() => {
                  setEditingPromptId(null);
                  queryClient.invalidateQueries({ queryKey: getGetAiReviewOverviewQueryKey() });
                }}
              />
            ))}
          </CardContent>
        </ContentCard>
      </div>
    </div>
  );
}

// ─── AI Event Row ─────────────────────────────────────────────────────────────

function AiEventRow({
  event,
  expanded,
  onToggle,
}: {
  event: EventLog;
  expanded: boolean;
  onToggle: () => void;
}) {
  const meta = asMetadata(event.metadata);
  const taskType = stringVal(meta, "taskType") ?? event.nextState ?? "unknown";
  const modelName = stringVal(meta, "modelName") ?? "No model";
  const promptVersionId = meta?.promptVersionId;
  const promptLabel = stringVal(meta, "promptLabel");
  const provider = stringVal(meta, "provider");
  const promptTokens = numberVal(meta, "promptTokens");
  const completionTokens = numberVal(meta, "completionTokens");
  const estimatedCostUsd = numberVal(meta, "estimatedCostUsd");
  const finishReason = stringVal(meta, "finishReason");
  const contentLength = numberVal(meta, "contentLength");
  const attemptNumber = numberVal(meta, "attemptNumber");
  const priorFailures = Array.isArray(meta?.priorFailures) ? meta.priorFailures.length : 0;
  const runId = stringVal(meta, "runId");
  const succeeded = meta?.succeeded;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
      >
        <div>
          <div>
            <span>{taskType}</span>
            <Badge variant={event.eventType === "ai_call_failed" ? "destructive" : "secondary"}>
              {succeeded === false ? "failed" : "ok"}
            </Badge>
          </div>
          <p>
            {modelName}
            {promptVersionId != null
              ? ` · prompt #${promptVersionId}${promptLabel ? ` (${promptLabel})` : ""}`
              : " · built-in prompt"}
          </p>
        </div>
        <span>
          {expanded ? <ChevronUp /> : <ChevronDown />}
        </span>
      </button>

      {expanded && (
        <div>
          <DetailRow label="Task" value={taskType} />
          <DetailRow label="Model" value={`${modelName}${provider ? ` (${provider})` : ""}`} />
          <DetailRow
            label="Tokens"
            value={
              promptTokens != null && completionTokens != null
                ? `${promptTokens.toLocaleString()} in / ${completionTokens.toLocaleString()} out`
                : "—"
            }
          />
          {estimatedCostUsd != null && (
            <DetailRow label="Est. Cost" value={`$${estimatedCostUsd.toFixed(5)}`} />
          )}
          <DetailRow label="Finish Reason" value={finishReason ?? "—"} />
          <DetailRow label="Content Length" value={contentLength != null ? `${contentLength.toLocaleString()} chars` : "—"} />
          <DetailRow
            label="Attempts"
            value={attemptNumber != null ? `${attemptNumber}${priorFailures > 0 ? ` (${priorFailures} prior failure${priorFailures > 1 ? "s" : ""})` : ""}` : "—"}
          />
          <DetailRow
            label="Prompt Version"
            value={
              promptVersionId != null
                ? `#${promptVersionId}${promptLabel ? ` — ${promptLabel}` : ""}`
                : "built-in (no DB version)"
            }
          />
          {event.jobId != null && <DetailRow label="Job ID" value={String(event.jobId)} />}
          {runId && <DetailRow label="Run ID" value={runId} mono />}
          <DetailRow label="Time" value={new Date(event.createdAt).toLocaleString()} />
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ─── Prompt Version Row ───────────────────────────────────────────────────────

function PromptVersionRow({
  prompt,
  editing,
  onEdit,
  onCancel,
  onSaved,
}: {
  prompt: AiPromptVersion;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    label: prompt.label,
    taskScope: prompt.taskScope,
    version: prompt.version,
    systemPrompt: prompt.systemPrompt,
    userPromptTemplate: prompt.userPromptTemplate ?? "",
    notes: prompt.notes ?? "",
    isActive: prompt.isActive,
  });

  const updatePrompt = useUpdateAiPromptVersion({
    mutation: {
      onSuccess: () => {
        toast({ title: "Prompt version updated" });
        onSaved();
      },
      onError: (error) =>
        toast({
          title: "Failed to update prompt",
          description: getErrorMessage(error, "Please check the prompt fields."),
          variant: "destructive",
        }),
    },
  });

  if (!editing) {
    return (
      <div>
        <div>
          <div>
            <div>
              <span>{prompt.label}</span>
              <Badge variant={prompt.isActive ? "default" : "outline"}>{prompt.taskScope}</Badge>
            </div>
            <p>
              v{prompt.version} {prompt.isActive ? "· active" : "· inactive"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil />
            Edit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div>
        <span>Editing: {prompt.label}</span>
        <button type="button" onClick={onCancel}>
          <X />
        </button>
      </div>

      <div>
        <div>
          <label>Label</label>
          <Input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
        </div>
        <div>
          <label>Task Scope</label>
          <Input
            value={form.taskScope}
            onChange={(e) => setForm({ ...form, taskScope: e.target.value })}
          />
        </div>
        <div>
          <label>Version</label>
          <Input
            type="number"
            value={form.version}
            onChange={(e) => setForm({ ...form, version: Number(e.target.value) })}
          />
        </div>
      </div>

      <div>
        <label>System Prompt</label>
        <Textarea
          value={form.systemPrompt}
          onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
        />
      </div>

      <div>
        <label>User Prompt Template</label>
        <Textarea
          value={form.userPromptTemplate}
          onChange={(e) => setForm({ ...form, userPromptTemplate: e.target.value })}
        />
        <p>Use {'{{userPrompt}}'} where runtime content is inserted</p>
      </div>

      <div>
        <label>Notes</label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Optional: describe what changed in this version"
        />
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          <span>Active (used for production calls)</span>
        </label>
        <div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => updatePrompt.mutate({ id: prompt.id, data: form })}
            disabled={!form.label || !form.systemPrompt || updatePrompt.isPending}
          >
            {updatePrompt.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function Metric({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <ContentCard>
      <CardContent>
        <div>
          <span>{title}</span>
          {icon}
        </div>
        <div>{value}</div>
      </CardContent>
    </ContentCard>
  );
}

// ─── Metadata helpers ─────────────────────────────────────────────────────────

function asMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringVal(meta: Record<string, unknown> | null, key: string): string | null {
  if (!meta) return null;
  const v = meta[key];
  return typeof v === "string" ? v : null;
}

function numberVal(meta: Record<string, unknown> | null, key: string): number | null {
  if (!meta) return null;
  const v = meta[key];
  return typeof v === "number" ? v : null;
}

