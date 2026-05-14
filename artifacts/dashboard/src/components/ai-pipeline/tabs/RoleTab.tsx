import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListAiPromptVersions,
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

interface RoleUpdateBody {
  roleLabel: string;
  personality: string;
  goals: string;
  skillTags: string[];
}

/**
 * Active prompt rows carry role metadata that lives on `ai_prompt_versions`
 * but is not (yet) part of the generated `AiPromptVersion` schema. We read
 * the values defensively and PATCH via a direct fetch so we can include the
 * role-only fields. Once the OpenAPI schema is widened, this can switch to
 * `useUpdateAiPromptVersion`.
 */
function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function readRoleFields(prompt: AiPromptVersion | undefined): RoleFormState {
  if (!prompt) {
    return { roleLabel: "", personality: "", goals: "", skillTags: [] };
  }
  // Role fields are persisted on `ai_prompt_versions` but not yet present
  // in the generated OpenAPI schema, so we read them via a safe record view.
  const raw = asRecord(prompt);
  const skillTagsRaw = raw.skillTags;
  const skillTags = Array.isArray(skillTagsRaw)
    ? skillTagsRaw.filter((tag): tag is string => typeof tag === "string")
    : [];
  return {
    roleLabel: typeof raw.roleLabel === "string" ? raw.roleLabel : "",
    personality: typeof raw.personality === "string" ? raw.personality : "",
    goals: typeof raw.goals === "string" ? raw.goals : "",
    skillTags,
  };
}

async function patchPromptRoleFields(id: number, body: RoleUpdateBody): Promise<void> {
  const response = await fetch(`/api/ai-prompt-versions/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = (await response.json()) as { detail?: string; message?: string; error?: string };
      message = data.detail ?? data.message ?? data.error ?? message;
    } catch {
      // ignore parse failure
    }
    throw new Error(message);
  }
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

  const mutation = useMutation({
    mutationFn: async (vars: { id: number; body: RoleUpdateBody }) => {
      await patchPromptRoleFields(vars.id, vars.body);
    },
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
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading role…</p>;
  }

  if (!activePrompt) {
    return (
      <div className="card-glass p-4 text-sm text-muted-foreground">
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
    mutation.mutate({
      id: activePrompt.id,
      body: {
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
        <Button onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
