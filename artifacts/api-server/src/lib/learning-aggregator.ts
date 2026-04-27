interface RawSignal {
  outcome: string;
  promptVersionId: number | null;
}

interface AggregatedStat {
  variantType: "prompt";
  variantId: number;
  successes: number;
  failures: number;
  pending: number;
}

const POSITIVE_OUTCOMES = new Set(["offer", "hired"]);
const NEGATIVE_OUTCOMES = new Set(["rejected"]);

export function aggregateVariantStats(signals: RawSignal[]): AggregatedStat[] {
  const map = new Map<string, AggregatedStat>();

  for (const signal of signals) {
    if (signal.promptVersionId == null) continue;

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

  return Array.from(map.values());
}
