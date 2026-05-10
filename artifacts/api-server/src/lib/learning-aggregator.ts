interface RawSignal {
  outcome: string;
  promptVersionId: number | null;
  modelName?: string | null;
  taskScope?: string | null;
  modelConfigId?: number | null;
}

interface AggregatedStat {
  variantType: "prompt" | "model";
  variantId: number;
  taskScope?: string | null;
  successes: number;
  failures: number;
  pending: number;
}

const POSITIVE_OUTCOMES = new Set(["offer", "hired"]);
const NEGATIVE_OUTCOMES = new Set(["rejected"]);

/** Hash a model name string into a stable 32-bit signed integer for use as variantId. */
function hashModelName(name: string): number {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash + name.charCodeAt(i)) | 0;
  }
  return hash;
}

export function aggregateVariantStats(signals: RawSignal[]): AggregatedStat[] {
  const map = new Map<string, AggregatedStat>();

  for (const signal of signals) {
    // Prompt variant aggregation (unchanged logic)
    if (signal.promptVersionId != null) {
      const key = `prompt:${signal.promptVersionId}`;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          variantType: "prompt",
          variantId: signal.promptVersionId,
          successes: 0,
          failures: 0,
          pending: 0,
        };
        map.set(key, entry);
      }

      if (POSITIVE_OUTCOMES.has(signal.outcome)) {
        entry.successes++;
      } else if (NEGATIVE_OUTCOMES.has(signal.outcome)) {
        entry.failures++;
      } else {
        entry.pending++;
      }
    }

    // Model variant aggregation (new)
    if (signal.modelName != null) {
      const modelVariantId = signal.modelConfigId ?? hashModelName(signal.modelName);
      const scoped = signal.taskScope ?? "unknown";
      const key = `model:${scoped}:${modelVariantId}`;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          variantType: "model",
          variantId: modelVariantId,
          taskScope: signal.taskScope ?? null,
          successes: 0,
          failures: 0,
          pending: 0,
        };
        map.set(key, entry);
      }

      if (POSITIVE_OUTCOMES.has(signal.outcome)) {
        entry.successes++;
      } else if (NEGATIVE_OUTCOMES.has(signal.outcome)) {
        entry.failures++;
      } else {
        entry.pending++;
      }
    }
  }

  return Array.from(map.values());
}
