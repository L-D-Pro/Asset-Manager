import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAiPromptVersions,
  useUpdateAiPromptVersion,
  getListAiPromptVersionsQueryKey,
  getGetAiReviewOverviewQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/api-errors";
import { AI_PIPELINE_OVERVIEW_QUERY_KEY } from "../useAiPipelineOverview";

interface PromptTabProps {
  taskScope: string;
}

interface PromptFormState {
  label: string;
  systemPrompt: string;
  userPromptTemplate: string;
  isActive: boolean;
}

export function PromptTab({ taskScope }: PromptTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useListAiPromptVersions({ taskScope, isActive: true });
  const activePrompt = data?.[0];

  const [form, setForm] = useState<PromptFormState>({
    label: "",
    systemPrompt: "",
    userPromptTemplate: "",
    isActive: false,
  });

  useEffect(() => {
    if (activePrompt) {
      setForm({
        label: activePrompt.label,
        systemPrompt: activePrompt.systemPrompt,
        userPromptTemplate: activePrompt.userPromptTemplate ?? "",
        isActive: activePrompt.isActive,
      });
    }
  }, [activePrompt]);

  const updatePrompt = useUpdateAiPromptVersion({
    mutation: {
      onSuccess: () => {
        toast({ title: "Prompt updated" });
        queryClient.invalidateQueries({
          queryKey: getListAiPromptVersionsQueryKey({ taskScope, isActive: true }),
        });
        queryClient.invalidateQueries({ queryKey: getGetAiReviewOverviewQueryKey() });
        queryClient.invalidateQueries({ queryKey: AI_PIPELINE_OVERVIEW_QUERY_KEY });
      },
      onError: (error) =>
        toast({
          title: "Failed to update prompt",
          description: getErrorMessage(error, "Please try again."),
          variant: "destructive",
        }),
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading prompt…</p>;
  }

  if (!activePrompt) {
    return (
      <div className="card-glass p-4 text-sm text-muted-foreground">
        No active prompt version for <span className="font-mono">{taskScope}</span>. Create one in
        <span className="font-medium"> AI Review</span> to start editing here.
      </div>
    );
  }

  const handleSave = () => {
    updatePrompt.mutate({
      id: activePrompt.id,
      data: {
        label: form.label,
        systemPrompt: form.systemPrompt,
        userPromptTemplate: form.userPromptTemplate,
        isActive: form.isActive,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Label</label>
        <Input
          value={form.label}
          onChange={(event) => setForm({ ...form, label: event.target.value })}
          placeholder="e.g., baseline-v1"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">System Prompt</label>
        <Textarea
          value={form.systemPrompt}
          onChange={(event) => setForm({ ...form, systemPrompt: event.target.value })}
          className="min-h-48 font-mono text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          User Prompt Template
        </label>
        <Textarea
          value={form.userPromptTemplate}
          onChange={(event) => setForm({ ...form, userPromptTemplate: event.target.value })}
          className="min-h-24 font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Use {"{{userPrompt}}"} where runtime content should be inserted.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
          />
          <span className="font-medium">Active (used for production calls)</span>
        </label>
        <Button
          onClick={handleSave}
          disabled={updatePrompt.isPending || !form.label || !form.systemPrompt}
        >
          {updatePrompt.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
