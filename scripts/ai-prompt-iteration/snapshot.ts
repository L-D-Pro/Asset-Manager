/*
  Snapshot capture helper

  - Calls GET /ai-metrics-snapshot?metricsVersion=v1&windowStart=...&windowEnd=...&taskScope=...
  - Writes JSON response into scripts/ai-prompt-iteration/out/ with deterministic naming.

  Dry-run behavior:
    If API_BASE_URL is not set, prints intended request URL and exits non-zero.

  Runtime requirements:
    - Node 20+ (global fetch)
*/

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ExperimentConfig = {
  taskScope: string;
  windowStart: string;
  windowEnd: string;
};

type AiMetricsSnapshotResponseV1 = {
  metricsVersion: "v1";
  taskScope: string | null;
  status: string;
  degradedReasons: string[];
  window: {
    requestedStart: string;
    requestedEnd: string;
    startInclusive: string;
    endExclusive: string;
    granularity: string;
  };
  promptVersionAggregates: unknown;
};

const CONFIG_PATH = path.join(process.cwd(), "scripts/ai-prompt-iteration/experiment-config.json");
const CONFIG_EXAMPLE_PATH = path.join(
  process.cwd(),
  "scripts/ai-prompt-iteration/experiment-config.example.json",
);
const OUT_DIR = path.join(process.cwd(), "scripts/ai-prompt-iteration/out");

function slug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeIso(s: string): string {
  // Keep deterministic file name by removing characters that are awkward on windows.
  return s.replace(/[:.]/g, "-");
}

async function loadConfig(): Promise<ExperimentConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as ExperimentConfig;
  } catch {
    const raw = await readFile(CONFIG_EXAMPLE_PATH, "utf8");
    return JSON.parse(raw) as ExperimentConfig;
  }
}

function requireApiBaseUrl(): string {
  const apiBaseUrl = process.env.API_BASE_URL;
  if (!apiBaseUrl) {
    console.error(
      "[dry-run] API_BASE_URL is not set.\n" +
        "Set API_BASE_URL (e.g. http://localhost:3001) and re-run to execute real calls.",
    );
    return "";
  }
  return apiBaseUrl.replace(/\/$/, "");
}

function formatHttpErrorBody(bodyText: string): string {
  const trimmed = bodyText.trim();
  if (!trimmed) return "<empty body>";
  return trimmed.length > 2000 ? `${trimmed.slice(0, 2000)}\n...<truncated>` : trimmed;
}

async function main(): Promise<void> {
  const config = await loadConfig();
  const apiBaseUrl = requireApiBaseUrl();

  if (!apiBaseUrl) {
    const intended = `/ai-metrics-snapshot?metricsVersion=v1&windowStart=${encodeURIComponent(
      config.windowStart,
    )}&windowEnd=${encodeURIComponent(config.windowEnd)}&taskScope=${encodeURIComponent(config.taskScope || "")}`;

    console.log("[dry-run] Would call:", intended);
    process.exitCode = 2;
    return;
  }

  const url = new URL(`${apiBaseUrl}/ai-metrics-snapshot`);
  url.searchParams.set("metricsVersion", "v1");
  url.searchParams.set("windowStart", config.windowStart);
  url.searchParams.set("windowEnd", config.windowEnd);
  if (config.taskScope) url.searchParams.set("taskScope", config.taskScope);

  await mkdir(OUT_DIR, { recursive: true });

  const res = await fetch(url.toString(), { method: "GET" });
  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status} ${res.statusText} for GET ${url.toString()}\n${formatHttpErrorBody(text)}`);
    process.exitCode = 1;
    return;
  }

  const json = JSON.parse(text) as AiMetricsSnapshotResponseV1;

  const fileName = `${slug(config.taskScope || "all")}__${normalizeIso(config.windowStart)}__${normalizeIso(
    config.windowEnd,
  )}__metrics-v1.json`;

  const outPath = path.join(OUT_DIR, fileName);
  const artifact = {
    requestUrl: url.toString(),
    capturedAt: new Date().toISOString(),
    response: json,
    normalizedWindow: json.window,
  };

  await writeFile(outPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");

  console.log("[ok] wrote:", outPath);
  console.log("status:", json.status);
  if (Array.isArray(json.degradedReasons) && json.degradedReasons.length > 0) {
    console.log("degradedReasons:", json.degradedReasons);
  }
  console.log("normalizedWindow:", json.window);
}

void main();
