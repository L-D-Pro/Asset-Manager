import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAiPromptVersions,
  useUpdateAiPromptVersion,
  getListAiPromptVersionsQueryKey,
  getGetAiReviewOverviewQueryKey,
  type AiPromptVersion,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/api-errors";
import { X } from "lucide-react";
import { AI_PIPELINE_OVERVIEW_QUERY_KEY } from "../useAiPipelineOverview";

interface RoleFormState {
  roleLabel: string;
  personality: string;
  goals: string;
  skillTags: string[];
}

function readRoleFields(prompt: AiPromptVersion | undefined): RoleFormState {
  if (!prompt) return { roleLabel: "", personality: "", goals: "", skillTags: [] };
  return {
    roleLabel: prompt.roleLabel ?? "",
    personality: prompt.personality ?? "",
    goals: prompt.goals ?? "",
    skillTags: prompt.skillTags ?? [],
  };
}

export function RoleTab({ taskScope }: { taskScope: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useListAiPromptVersions({ taskScope, isActive: true });
  const activePrompt = data?.[0];

  const [form, setForm] = useState<RoleFormState>(readRoleFields(undefined));
  const [skillInput, setSkillInput] = useState("");

  useEffect(() => { setForm(readRoleFields(activePrompt)); }, [activePrompt]);

  const updatePrompt = useUpdateAiPromptVersion({
    mutation: {
      onSuccess: () => {
        toast({ title: "Role updated" });
        queryClient.invalidateQueries({ queryKey: getListAiPromptVersionsQueryKey({ taskScope, isActive: true }) });
        queryClient.invalidateQueries({ queryKey: getGetAiReviewOverviewQueryKey() });
        queryClient.invalidateQueries({ queryKey: AI_PIPELINE_OVERVIEW_QUERY_KEY });
      },
      onError: (error) => toast({
        title: "Failed to update role",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      }),
    },
  });

  if (isLoading) return <div className="dim" style={{ fontSize: 13 }}>Loading role…</div>;

  if (!activePrompt) {
    return (
      <div className="dim" style={{ fontSize: 13 }}>
        No active prompt version for <span className="mono">{taskScope}</span>. Create one in AI Review first — role fields live on the same prompt-version row.
      </div>
    );
  }

  function addSkill() {
    const next = skillInput.trim();
    if (!next || form.skillTags.includes(next)) { setSkillInput(""); return; }
    setForm({ ...form, skillTags: [...form.skillTags, next] });
    setSkillInput("");
  }

  function removeSkill(tag: string) {
    setForm({ ...form, skillTags: form.skillTags.filter((t) => t !== tag) });
  }

  function handleSkillKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(); }
  }

  function handleSave() {
    updatePrompt.mutate({
      id: activePrompt!.id,
      data: {
        roleLabel: form.roleLabel,
        personality: form.personality,
        goals: form.goals,
        skillTags: form.skillTags,
      },
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field">
        <label>Role label</label>
        <input
          className="input"
          value={form.roleLabel}
          onChange={(e) => setForm({ ...form, roleLabel: e.target.value })}
          placeholder="e.g., Resume Expert"
        />
      </div>

      <div className="field">
        <label>Personality</label>
        <textarea
          className="input"
          value={form.personality}
          onChange={(e) => setForm({ ...form, personality: e.target.value })}
          placeholder="e.g., You are an expert resume writer specializing in ATS-optimized tailoring."
          rows={4}
          style={{ resize: "vertical", fontFamily: "var(--font-ui)" }}
        />
      </div>

      <div className="field">
        <label>Goals</label>
        <textarea
          className="input"
          value={form.goals}
          onChange={(e) => setForm({ ...form, goals: e.target.value })}
          placeholder="e.g., Match required skills accurately. Never invent facts."
          rows={3}
          style={{ resize: "vertical", fontFamily: "var(--font-ui)" }}
        />
      </div>

      <div className="field">
        <label>Skill tags</label>
        {form.skillTags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {form.skillTags.map((tag) => (
              <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 4 }} className="chip ghost">
                {tag}
                <button
                  type="button"
                  onClick={() => removeSkill(tag)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "var(--ink-4)" }}
                  aria-label={`Remove ${tag}`}
                >
                  <X size={10} strokeWidth={2} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={handleSkillKey}
            placeholder="Type a tag, then press Enter or comma"
          />
          <button type="button" className="btn sm" onClick={addSkill} disabled={!skillInput.trim()}>
            Add
          </button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn primary sm"
          onClick={handleSave}
          disabled={updatePrompt.isPending}
        >
          {updatePrompt.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
