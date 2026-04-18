/*
  AI prompt iteration harness

  - Creates/updates two prompt versions (A/B) for a chosen taskScope.
  - Prints a place to record runIds + promptVersionIds per version.

  Dry-run behavior:
    If API_BASE_URL is not set, prints intended HTTP calls and exits non-zero.

  Runtime requirements:
    - Node 20+ (global fetch)
*/

import { readFile } from "node:fs/promises";
import path from "node:path";

type PromptVersionConfig = {
  label: string;
  isActive: boolean;
  prompt: string;
};

type ExperimentConfig = {
  taskScope: string;
  promptVersions: PromptVersionConfig[];
  windowStart: string;
  windowEnd: string;
  runs?: Record<string, { promptVersionId: number | null; runIds: string[] }>;
};

type ApiPromptVersion = {
  id: number;
  taskScope: string;
  label: string;
  prompt: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const CONFIG_PATH = path.join(process.cwd(), "scripts/ai-prompt-iteration/experiment-config.json");
const CONFIG_EXAMPLE_PATH = path.join(
  process.cwd(),
  "scripts/ai-prompt-iteration/experiment-config.example.json",
);

function formatHttpErrorBody(bodyText: string): string {
  const trimmed = bodyText.trim();
  if (!trimmed) return "<empty body>";
  return trimmed.length > 2000 ? `${trimmed.slice(0, 2000)}\n...<truncated>` : trimmed;
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

async function http<T>(
  url: string,
  init: RequestInit & { expectedStatus: number | number[] },
): Promise<T> {
  const expected = Array.isArray(init.expectedStatus) ? init.expectedStatus : [init.expectedStatus];
  const res = await fetch(url, init);
  const text = await res.text();

  if (!expected.includes(res.status)) {
    throw new Error(
      `HTTP ${res.status} ${res.statusText} for ${init.method ?? "GET"} ${url}\n${formatHttpErrorBody(text)}`,
    );
  }

  return (text ? (JSON.parse(text) as T) : (null as T));
}

async function ensurePromptVersion(
  apiBaseUrl: string,
  taskScope: string,
  desired: PromptVersionConfig,
): Promise<ApiPromptVersion> {
  const listUrl = `${apiBaseUrl}/ai-prompt-versions?taskScope=${encodeURIComponent(taskScope)}`;
  const existing = await http<ApiPromptVersion[]>(listUrl, { expectedStatus: 200 });

  const found = existing.find((v) => v.label === desired.label);
  if (!found) {
    const createUrl = `${apiBaseUrl}/ai-prompt-versions`;
    return http<ApiPromptVersion>(createUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskScope,
        label: desired.label,
        prompt: desired.prompt,
        isActive: desired.isActive,
      }),
      expectedStatus: 201,
    });
  }

  // Always patch to ensure prompt and isActive match config
  const patchUrl = `${apiBaseUrl}/ai-prompt-versions/${found.id}`;
  return http<ApiPromptVersion>(patchUrl, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt: desired.prompt,
      isActive: desired.isActive,
    }),
    expectedStatus: 200,
  });
}

async function main(): Promise<void> {
  const config = await loadConfig();

  if (!config.taskScope) {
    console.error("Missing config.taskScope");
    process.exitCode = 1;
    return;
  }

  if (!Array.isArray(config.promptVersions) || config.promptVersions.length < 2) {
    console.error("Config must include at least two promptVersions entries (A/B)");
    process.exitCode = 1;
    return;
  }

  const apiBaseUrl = requireApiBaseUrl();
  if (!apiBaseUrl) {
    // dry-run message already printed
    console.log("[dry-run] Would read config from:", CONFIG_PATH);
    console.log("[dry-run] Would ensure prompt versions:", {
      taskScope: config.taskScope,
      labels: config.promptVersions.map((p) => ({ label: p.label, isActive: p.isActive })),
    });
    console.log("[dry-run] Would later capture snapshot for window:", {
      windowStart: config.windowStart,
      windowEnd: config.windowEnd,
    });

    process.exitCode = 2;
    return;
  }

  }

  let lastStep = "init";
  try {
    lastStep = "ensure prompt versions";
    const results: Record<string, ApiPromptVersion> = {};

    for (const pv of config.promptVersions) {
      console.log(`[step] ensure prompt version ${pv.label}`);
      results[pv.label] = await ensurePromptVersion(apiBaseUrl, config.taskScope, pv);
      console.log(`[ok] ${pv.label} => id=${results[pv.label]!.id} isActive=${results[pv.label]!.isActive}`);
    }

    console.log("\nPaste this into your experiment-config.json under runs:");
    const runs: Record<string, { promptVersionId: number; runIds: string[] }> = {};
    for (const [label, row] of Object.entries(results)) {
      runs[label] = { promptVersionId: row.id, runIds: [] };
    }
    console.log(JSON.stringify(runs, null, 2));

    console.log(
      "\nNext: produce real runIds in the app by switching active prompt versions and recording the resulting runId values.",
    );
  } catch (err) {
    console.error(`[error] lastStep=${lastStep}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

void main();
