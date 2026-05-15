import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAiPromptVersions,
  useUpdateAiPromptVersion,
  getListAiPromptVersionsQueryKey,
  getGetAiReviewOverviewQueryKey,
  type AiPromptVersion,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/api-errors";
import { AI_PIPELINE_OVERVIEW_QUERY_KEY } from "../useAiPipelineOverview";

interface RoleTabProps {
  taskScope: string;
}

interface RoleFormState {
  roleLabel: string;
  personality: string;
  goals: string;
  skillTags: string[];
}

function readRoleFields(prompt: AiPromptVersion | undefined): RoleFormState {
  if (!prompt) {
    return { roleLabel: "", personality: "", goals: "", skillTags: [] };
  }
  return {
    roleLabel: prompt.roleLabel ?? "",
    personality: prompt.personality ?? "",
    goals: prompt.goals ?? "",
    skillTags: prompt.skillTags ?? [],
  };
}

export function RoleTab({ taskScope }: RoleTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useListAiPromptVersions({ taskScope, isActive: true });
  const activePrompt = data?.[0];

  const [form, setForm] = useState<RoleFormState>(readRoleFields(undefined));
  const [skillInput, setSkillInput] = useState("");

  useEffect(() => {
    setForm(readRoleFields(activePrompt));
  }, [activePrompt]);

  const updatePrompt = useUpdateAiPromptVersion({
    mutation: {
      onSuccess: () => {
        toast({ title: "Role updated" });
        queryClient.invalidateQueries({
          queryKey: getListAiPromptVersionsQueryKey({ taskScope, isActive: true }),
        });
        queryClient.invalidateQueries({ queryKey: getGetAiReviewOverviewQueryKey() });
        queryClient.invalidateQueries({ queryKey: AI_PIPELINE_OVERVIEW_QUERY_KEY });
      },
      onError: (error) =>
        toast({
          title: "Failed to update role",
          description: getErrorMessage(error, "Please try again."),
          variant: "destructive",
        }),
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading role…</p>;
  }

  if (!activePrompt) {
    return (
      <div className="quiet-card p-4 text-sm text-muted-foreground">
        No active prompt version for <span className="font-mono">{taskScope}</span>. Create one in AI Review first;
        the role fields live on the same prompt-version row.
      </div>
    );
  }

  const addSkill = () => {
    const next = skillInput.trim();
    if (!next) return;
    if (form.skillTags.includes(next)) {
      setSkillInput("");
      return;
    }
    setForm({ ...form, skillTags: [...form.skillTags, next] });
    setSkillInput("");
  };

  const removeSkill = (tag: string) => {
    setForm({ ...form, skillTags: form.skillTags.filter((entry) => entry !== tag) });
  };

  const handleSkillKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addSkill();
    }
  };

  const handleSave = () => {
    updatePrompt.mutate({
      id: activePrompt.id,
      data: {
        roleLabel: form.roleLabel,
        personality: form.personality,
        goals: form.goals,
        skillTags: form.skillTags,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="role-label" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Role Label
        </label>
        <Input
          id="role-label"
          value={form.roleLabel}
          onChange={(event) => setForm({ ...form, roleLabel: event.target.value })}
          placeholder="e.g., Resume Expert"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="role-personality"
          className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Personality
        </label>
        <Textarea
          id="role-personality"
          aria-label="Personality"
          value={form.personality}
          onChange={(event) => setForm({ ...form, personality: event.target.value })}
          placeholder="e.g., You are an expert resume writer specializing in ATS-optimized tailoring."
          className="min-h-24"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="role-goals" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Goals
        </label>
        <Textarea
          id="role-goals"
          aria-label="Goals"
          value={form.goals}
          onChange={(event) => setForm({ ...form, goals: event.target.value })}
          placeholder="e.g., Match required skills accurately. Never invent facts."
          className="min-h-20"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="role-skills" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Skill Tags
        </label>
        <div className="flex flex-wrap gap-2">
          {form.skillTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeSkill(tag)}
                className="ml-1 rounded-sm text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            id="role-skills"
            value={skillInput}
            onChange={(event) => setSkillInput(event.target.value)}
            onKeyDown={handleSkillKey}
            placeholder="Type a tag, then press Enter or comma"
          />
          <Button type="button" variant="outline" onClick={addSkill} disabled={!skillInput.trim()}>
            Add
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-end pt-1">
        <Button onClick={handleSave} disabled={updatePrompt.isPending}>
          {updatePrompt.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
