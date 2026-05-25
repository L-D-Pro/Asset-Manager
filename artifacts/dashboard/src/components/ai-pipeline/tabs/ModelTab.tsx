import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAiModelConfigs,
  useUpdateAiModelConfig,
  getListAiModelConfigsQueryKey,
  type AiModelConfig,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/api-errors";
import { AI_PIPELINE_OVERVIEW_QUERY_KEY } from "../useAiPipelineOverview";

interface ModelFormState {
  modelName: string;
  fallbackModelId: string;
  secondFallbackModelId: string;
  temperature: string;
  maxTokens: string;
  isActive: boolean;
}

function pickPrimary(configs: AiModelConfig[]): AiModelConfig | undefined {
  if (configs.length === 0) return undefined;
  return configs.find((c) => c.isActive) ?? configs[0];
}

function findFallback(configs: AiModelConfig[], id: number | null | undefined): AiModelConfig | undefined {
  if (id == null) return undefined;
  return configs.find((c) => c.id === id);
}

function readTemperature(config: AiModelConfig | undefined): string {
  if (!config) return "";
  const value = config.extraConfig?.temperature;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim() !== "") return value;
  return "";
}

export function ModelTab({ taskScope }: { taskScope: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useListAiModelConfigs({ taskScope });
  const configs = data ?? [];
  const primary = pickPrimary(configs);
  const fallback = findFallback(configs, primary?.fallbackModelId);
  const secondFallback = findFallback(configs, fallback?.fallbackModelId);

  const [form, setForm] = useState<ModelFormState>({
    modelName: "", fallbackModelId: "", secondFallbackModelId: "",
    temperature: "", maxTokens: "", isActive: false,
  });

  useEffect(() => {
    if (primary) {
      setForm({
        modelName: primary.modelName,
        fallbackModelId: primary.fallbackModelId != null ? String(primary.fallbackModelId) : "",
        secondFallbackModelId: fallback?.fallbackModelId != null ? String(fallback.fallbackModelId) : "",
        temperature: readTemperature(primary),
        maxTokens: primary.maxTokens != null ? String(primary.maxTokens) : "",
        isActive: primary.isActive,
      });
    }
  }, [primary, fallback]);

  const updateConfig = useUpdateAiModelConfig({
    mutation: {
      onSuccess: () => {
        toast({ title: "Model config updated" });
        queryClient.invalidateQueries({ queryKey: getListAiModelConfigsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAiModelConfigsQueryKey({ taskScope }) });
        queryClient.invalidateQueries({ queryKey: AI_PIPELINE_OVERVIEW_QUERY_KEY });
      },
      onError: (error) => toast({
        title: "Failed to update model config",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      }),
    },
  });

  if (isLoading) return <div className="dim" style={{ fontSize: 13 }}>Loading model config…</div>;

  if (!primary) {
    return (
      <div className="dim" style={{ fontSize: 13 }}>
        No model config for <span className="mono">{taskScope}</span>.{" "}
        <Link to="/ai-config" style={{ color: "var(--accent)" }}>Create one in AI Config</Link>.
      </div>
    );
  }

  function handleSave() {
    const trimmedModel = form.modelName.trim();
    if (!trimmedModel) {
      toast({ title: "Model name required", description: "Enter a model name (e.g., anthropic/claude-3.5-haiku).", variant: "destructive" });
      return;
    }

    const temperatureValue = form.temperature.trim();
    let temperatureNumber: number | undefined;
    if (temperatureValue !== "") {
      const parsed = Number(temperatureValue);
      if (!Number.isFinite(parsed)) {
        toast({ title: "Invalid temperature", description: "Use a number like 0.2", variant: "destructive" });
        return;
      }
      temperatureNumber = parsed;
    }

    const maxTokensValue = form.maxTokens.trim();
    let maxTokensNumber: number | null | undefined;
    if (maxTokensValue === "") {
      maxTokensNumber = null;
    } else {
      const parsed = Number(maxTokensValue);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast({ title: "Invalid max tokens", description: "Use a positive integer.", variant: "destructive" });
        return;
      }
      maxTokensNumber = Math.floor(parsed);
    }

    const fallbackIdValue = form.fallbackModelId.trim();
    let fallbackId: number | null | undefined;
    if (fallbackIdValue === "") {
      fallbackId = null;
    } else {
      const parsed = Number(fallbackIdValue);
      if (!Number.isFinite(parsed)) {
        toast({ title: "Invalid fallback ID", description: "Use a numeric model config ID.", variant: "destructive" });
        return;
      }
      fallbackId = parsed;
    }

    const extraConfig: Record<string, unknown> = { ...primary!.extraConfig };
    if (temperatureNumber !== undefined) {
      extraConfig.temperature = temperatureNumber;
    } else {
      delete extraConfig.temperature;
    }

    updateConfig.mutate({
      id: primary!.id,
      data: {
        modelName: trimmedModel,
        isActive: form.isActive,
        fallbackModelId: fallbackId,
        maxTokens: maxTokensNumber,
        extraConfig,
      },
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label>Primary model</label>
          <input
            className="input"
            value={form.modelName}
            onChange={(e) => setForm({ ...form, modelName: e.target.value })}
            placeholder="anthropic/claude-3.5-haiku"
          />
          <div className="dim" style={{ fontSize: 11.5, marginTop: 3 }}>
            Provider: <span className="mono">{primary.provider}</span>
          </div>
        </div>

        <div className="field">
          <label>Fallback config ID</label>
          <input
            className="input"
            value={form.fallbackModelId}
            onChange={(e) => setForm({ ...form, fallbackModelId: e.target.value })}
            placeholder={fallback ? String(fallback.id) : "—"}
            inputMode="numeric"
          />
          <div className="dim" style={{ fontSize: 11.5, marginTop: 3 }}>
            {fallback ? `→ ${fallback.modelName}` : "No fallback wired."}
            {secondFallback ? ` → ${secondFallback.modelName}` : ""}
          </div>
        </div>

        <div className="field">
          <label>Temperature</label>
          <input
            className="input"
            value={form.temperature}
            onChange={(e) => setForm({ ...form, temperature: e.target.value })}
            placeholder="0.2"
            inputMode="decimal"
          />
        </div>

        <div className="field">
          <label>Max tokens</label>
          <input
            className="input"
            value={form.maxTokens}
            onChange={(e) => setForm({ ...form, maxTokens: e.target.value })}
            placeholder="4000"
            inputMode="numeric"
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <span>Active</span>
          </label>
          <Link to="/ai-config" style={{ fontSize: 12.5, color: "var(--accent)" }}>
            Open full editor in AI Config →
          </Link>
        </div>
        <button
          type="button"
          className="btn primary sm"
          onClick={handleSave}
          disabled={updateConfig.isPending}
        >
          {updateConfig.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
