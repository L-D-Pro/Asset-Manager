import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAiPromptVersions,
  useUpdateAiPromptVersion,
  getListAiPromptVersionsQueryKey,
  getGetAiReviewOverviewQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/api-errors";
import { AI_PIPELINE_OVERVIEW_QUERY_KEY } from "../useAiPipelineOverview";

interface PromptFormState {
  label: string;
  systemPrompt: string;
  userPromptTemplate: string;
  isActive: boolean;
}

export function PromptTab({ taskScope }: { taskScope: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useListAiPromptVersions({ taskScope, isActive: true });
  const activePrompt = data?.[0];

  const [form, setForm] = useState<PromptFormState>({
    label: "", systemPrompt: "", userPromptTemplate: "", isActive: false,
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
        queryClient.invalidateQueries({ queryKey: getListAiPromptVersionsQueryKey({ taskScope, isActive: true }) });
        queryClient.invalidateQueries({ queryKey: getGetAiReviewOverviewQueryKey() });
        queryClient.invalidateQueries({ queryKey: AI_PIPELINE_OVERVIEW_QUERY_KEY });
      },
      onError: (error) => toast({
        title: "Failed to update prompt",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      }),
    },
  });

  if (isLoading) {
    return <div className="dim" style={{ fontSize: 13 }}>Loading prompt…</div>;
  }

  if (!activePrompt) {
    return (
      <div className="dim" style={{ fontSize: 13 }}>
        No active prompt version for <span className="mono">{taskScope}</span>. Create one in AI Review to start editing here.
      </div>
    );
  }

  function handleSave() {
    updatePrompt.mutate({
      id: activePrompt!.id,
      data: {
        label: form.label,
        systemPrompt: form.systemPrompt,
        userPromptTemplate: form.userPromptTemplate,
        isActive: form.isActive,
      },
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field">
        <label>Label</label>
        <input
          className="input"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="e.g., baseline-v1"
        />
      </div>

      <div className="field">
        <label>System prompt</label>
        <textarea
          className="input"
          value={form.systemPrompt}
          onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
          rows={8}
          style={{ resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 12.5 }}
        />
      </div>

      <div className="field">
        <label>User prompt template</label>
        <textarea
          className="input"
          value={form.userPromptTemplate}
          onChange={(e) => setForm({ ...form, userPromptTemplate: e.target.value })}
          rows={4}
          style={{ resize: "vertical", fontFamily: "var(--font-mono)", fontSize: 12.5 }}
        />
        <div className="dim" style={{ fontSize: 11.5, marginTop: 4 }}>
          Use <span className="mono">{"{{userPrompt}}"}</span> where runtime content should be inserted.
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          <span>Active <span className="dim">(used for production calls)</span></span>
        </label>
        <button
          type="button"
          className="btn primary sm"
          onClick={handleSave}
          disabled={updatePrompt.isPending || !form.label || !form.systemPrompt}
        >
          {updatePrompt.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
