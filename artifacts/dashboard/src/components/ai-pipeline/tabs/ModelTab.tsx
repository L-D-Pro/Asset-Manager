import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAiModelConfigs,
  useUpdateAiModelConfig,
  getListAiModelConfigsQueryKey,
  type AiModelConfig,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/api-errors";
import { AI_PIPELINE_OVERVIEW_QUERY_KEY } from "../useAiPipelineOverview";

interface ModelTabProps {
  taskScope: string;
}

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
  const active = configs.find((entry) => entry.isActive);
  return active ?? configs[0];
}

function findFallback(configs: AiModelConfig[], id: number | null | undefined): AiModelConfig | undefined {
  if (id == null) return undefined;
  return configs.find((entry) => entry.id === id);
}

function readTemperature(config: AiModelConfig | undefined): string {
  if (!config) return "";
  const value = config.extraConfig?.temperature;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim() !== "") return value;
  return "";
}

export function ModelTab({ taskScope }: ModelTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useListAiModelConfigs({ taskScope });
  const configs = data ?? [];
  const primary = pickPrimary(configs);
  const fallback = findFallback(configs, primary?.fallbackModelId);
  const secondFallback = findFallback(configs, fallback?.fallbackModelId);

  const [form, setForm] = useState<ModelFormState>({
    modelName: "",
    fallbackModelId: "",
    secondFallbackModelId: "",
    temperature: "",
    maxTokens: "",
    isActive: false,
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
      onError: (error) =>
        toast({
          title: "Failed to update model config",
          description: getErrorMessage(error, "Please try again."),
          variant: "destructive",
        }),
    },
  });

  if (isLoading) {
    return <p>Loading model config...</p>;
  }

  if (!primary) {
    return (
      <div>
        <p>
          No model config for {taskScope}.
        </p>
        <Link to="/ai-config">
          Create one in AI Config
        </Link>
      </div>
    );
  }

  const handleSave = () => {
    const trimmedModel = form.modelName.trim();
    if (!trimmedModel) {
      toast({
        title: "Model name required",
        description: "Enter a model name (e.g., anthropic/claude-3.5-haiku).",
        variant: "destructive",
      });
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

    const extraConfig: Record<string, unknown> = { ...primary.extraConfig };
    if (temperatureNumber !== undefined) {
      extraConfig.temperature = temperatureNumber;
    } else {
      delete extraConfig.temperature;
    }

    updateConfig.mutate({
      id: primary.id,
      data: {
        modelName: trimmedModel,
        isActive: form.isActive,
        fallbackModelId: fallbackId,
        maxTokens: maxTokensNumber,
        extraConfig,
      },
    });
  };

  return (
    <div>
      <div>
        <div>
          <label htmlFor="model-name">Primary Model</label>
          <Input
            id="model-name"
            value={form.modelName}
            onChange={(event) => setForm({ ...form, modelName: event.target.value })}
            placeholder="anthropic/claude-3.5-haiku"
          />
          <p>Provider: {primary.provider}</p>
        </div>

        <div>
          <label htmlFor="model-temperature">Temperature</label>
          <Input
            id="model-temperature"
            value={form.temperature}
            onChange={(event) => setForm({ ...form, temperature: event.target.value })}
            placeholder="0.2"
            inputMode="decimal"
          />
        </div>

        <div>
          <label htmlFor="model-max-tokens">Max Tokens</label>
          <Input
            id="model-max-tokens"
            value={form.maxTokens}
            onChange={(event) => setForm({ ...form, maxTokens: event.target.value })}
            placeholder="4000"
            inputMode="numeric"
          />
        </div>

        <div>
          <label htmlFor="model-fallback">Fallback Config ID</label>
          <Input
            id="model-fallback"
            value={form.fallbackModelId}
            onChange={(event) => setForm({ ...form, fallbackModelId: event.target.value })}
            placeholder={fallback ? String(fallback.id) : "-"}
            inputMode="numeric"
          />
          <p>
            {fallback ? `Currently: ${fallback.modelName}` : "No fallback wired."}
            {secondFallback ? ` -> ${secondFallback.modelName}` : ""}
          </p>
        </div>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
          />
          Active
        </label>
        <Button onClick={handleSave} disabled={updateConfig.isPending}>
          {updateConfig.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>

      <div>
        <Link to="/ai-config">
          Open full editor in AI Config
        </Link>
      </div>
    </div>
  );
}
