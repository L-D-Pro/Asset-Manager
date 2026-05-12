interface OpenRouterModelCapabilities {
  modelName: string;
  supportedParameters: string[];
}

let capabilityCache: {
  expiresAt: number;
  models: Map<string, OpenRouterModelCapabilities>;
} | null = null;

const CATALOG_TTL_MS = 5 * 60 * 1000;

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, "");
}

export async function getOpenRouterModelCapabilities(
  modelName: string,
): Promise<OpenRouterModelCapabilities | null> {
  if (process.env.NODE_ENV === "test") return null;

  const baseUrl = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
  if (!baseUrl || !apiKey) return null;

  const now = Date.now();
  if (capabilityCache && capabilityCache.expiresAt > now) {
    return capabilityCache.models.get(modelName) ?? null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      data?: Array<{ id?: unknown; supported_parameters?: unknown }>;
    };

    const models = new Map<string, OpenRouterModelCapabilities>();
    for (const item of payload.data ?? []) {
      if (typeof item.id !== "string") continue;
      models.set(item.id, {
        modelName: item.id,
        supportedParameters: Array.isArray(item.supported_parameters)
          ? item.supported_parameters.filter((param): param is string => typeof param === "string")
          : [],
      });
    }

    capabilityCache = { expiresAt: now + CATALOG_TTL_MS, models };
    return models.get(modelName) ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

