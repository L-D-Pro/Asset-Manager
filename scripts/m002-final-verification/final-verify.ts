/*
  M002 Final Verification Script

  Modes:
  - Dry-run (default): if API_BASE_URL is not set, prints intended calls and exits non-zero.
  - Live: if API_BASE_URL is set, calls GET /ai-metrics-snapshot twice per task scope for a fixed window,
          asserts byte-identical JSON (stable stringify), and writes durable artifacts + sha256 proofs.

  This script intentionally does NOT attempt to create real resume/cover-letter versions, approvals,
  or feedback signals. Those require auth + a live DB. Instead it proves the reproducibility and
  degraded-signal visibility of the metrics snapshot surface.

  Runtime requirements:
    - Node 20+ (global fetch)
*/

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type FinalVerifyConfig = {
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

const EXPERIMENT_CONFIG_PATH = path.join(process.cwd(), "scripts/ai-prompt-iteration/experiment-config.json");
const EXPERIMENT_CONFIG_EXAMPLE_PATH = path.join(
  process.cwd(),
  "scripts/ai-prompt-iteration/experiment-config.example.json",
);

const OUT_DIR = path.join(process.cwd(), "scripts/m002-final-verification/out");

type TaskScope = "resume_review" | "cover_letter_review";
const TASK_SCOPES: TaskScope[] = ["resume_review", "cover_letter_review"];

function slug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeIsoForFilename(s: string): string {
  // Keep deterministic file name by removing characters that are awkward on Windows.
  return s.replace(/[:.]/g, "-");
}

async function loadWindowConfig(): Promise<FinalVerifyConfig> {
  // Reuse existing conventions: if experiment-config.json exists, take its windowStart/windowEnd.
  // Otherwise fall back to the example config.
  try {
    const raw = await readFile(EXPERIMENT_CONFIG_PATH, "utf8");
    const json = JSON.parse(raw) as { windowStart: string; windowEnd: string };
    return { windowStart: json.windowStart, windowEnd: json.windowEnd };
  } catch {
    const raw = await readFile(EXPERIMENT_CONFIG_EXAMPLE_PATH, "utf8");
    const json = JSON.parse(raw) as { windowStart: string; windowEnd: string };
    return { windowStart: json.windowStart, windowEnd: json.windowEnd };
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

function stableStringify(value: unknown): string {
  // Deterministic JSON encoding: recursively sort object keys.
  if (value === null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => {
      const v = obj[k];
      return `${JSON.stringify(k)}:${stableStringify(v)}`;
    })
    .join(",")}}`;
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function formatHttpErrorBody(bodyText: string): string {
  const trimmed = bodyText.trim();
  if (!trimmed) return "<empty body>";
  return trimmed.length > 2000 ? `${trimmed.slice(0, 2000)}\n...<truncated>` : trimmed;
}

type CaptureResult = {
  requestUrl: string;
  capturedAt: string;
  response: AiMetricsSnapshotResponseV1;
  stableJson: string;
  sha256: string;
};

async function captureOnce(params: {
  apiBaseUrl: string;
  taskScope: TaskScope;
  windowStart: string;
  windowEnd: string;
}): Promise<CaptureResult> {
  const url = new URL(`${params.apiBaseUrl}/ai-metrics-snapshot`);
  url.searchParams.set("metricsVersion", "v1");
  url.searchParams.set("windowStart", params.windowStart);
  url.searchParams.set("windowEnd", params.windowEnd);
  url.searchParams.set("taskScope", params.taskScope);

  const res = await fetch(url.toString(), { method: "GET" });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} ${res.statusText} for GET ${url.toString()}\n${formatHttpErrorBody(text)}`,
    );
  }

  const json = JSON.parse(text) as AiMetricsSnapshotResponseV1;
  const stableJson = stableStringify(json);
  return {
    requestUrl: url.toString(),
    capturedAt: new Date().toISOString(),
    response: json,
    stableJson,
    sha256: sha256Hex(stableJson),
  };
}

function deterministicBaseName(taskScope: TaskScope, windowStart: string, windowEnd: string): string {
  return `${slug(taskScope)}__${normalizeIsoForFilename(windowStart)}__${normalizeIsoForFilename(windowEnd)}__metrics-v1`;
}

async function main(): Promise<void> {
  const config = await loadWindowConfig();
  const apiBaseUrl = requireApiBaseUrl();

  if (!apiBaseUrl) {
    for (const taskScope of TASK_SCOPES) {
      const intended = `/ai-metrics-snapshot?metricsVersion=v1&windowStart=${encodeURIComponent(
        config.windowStart,
      )}&windowEnd=${encodeURIComponent(config.windowEnd)}&taskScope=${encodeURIComponent(taskScope)}`;

      console.log("[dry-run] Would call:", intended);
    }

    process.exitCode = 2;
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });

  let degradedOrError = false;

  for (const taskScope of TASK_SCOPES) {
    const base = deterministicBaseName(taskScope, config.windowStart, config.windowEnd);

    console.log(`\n[run] taskScope=${taskScope}`);
    console.log("windowStart:", config.windowStart);
    console.log("windowEnd:", config.windowEnd);

    let a: CaptureResult;
    let b: CaptureResult;
    try {
      a = await captureOnce({
        apiBaseUrl,
        taskScope,
        windowStart: config.windowStart,
        windowEnd: config.windowEnd,
      });

      b = await captureOnce({
        apiBaseUrl,
        taskScope,
        windowStart: config.windowStart,
        windowEnd: config.windowEnd,
      });
    } catch (err) {
      console.error("[error] snapshot capture failed:", err);
      degradedOrError = true;
      continue;
    }

    const isByteIdentical = a.stableJson === b.stableJson;

    const artifactAPath = path.join(OUT_DIR, `${base}__capture-a.json`);
    const artifactBPath = path.join(OUT_DIR, `${base}__capture-b.json`);
    const proofPath = path.join(OUT_DIR, `${base}__sha256.txt`);

    const artifactA = {
      requestUrl: a.requestUrl,
      capturedAt: a.capturedAt,
      sha256StableJson: a.sha256,
      response: a.response,
      normalizedWindow: a.response.window,
    };
    const artifactB = {
      requestUrl: b.requestUrl,
      capturedAt: b.capturedAt,
      sha256StableJson: b.sha256,
      response: b.response,
      normalizedWindow: b.response.window,
    };

    await writeFile(artifactAPath, JSON.stringify(artifactA, null, 2) + "\n", "utf8");
    await writeFile(artifactBPath, JSON.stringify(artifactB, null, 2) + "\n", "utf8");

    // Proof file is keyed to (taskScope, windowStart, windowEnd) and proves stable JSON hash.
    const proofLines = [
      `taskScope=${taskScope}`,
      `windowStart=${config.windowStart}`,
      `windowEnd=${config.windowEnd}`,
      `sha256StableJson=${a.sha256}`,
      `byteIdentical=${isByteIdentical}`,
      `status=${a.response.status}`,
      `degradedReasons=${Array.isArray(a.response.degradedReasons) ? a.response.degradedReasons.join(",") : ""}`,
      "",
    ];
    await writeFile(proofPath, proofLines.join("\n"), "utf8");

    console.log("[ok] wrote:", artifactAPath);
    console.log("[ok] wrote:", artifactBPath);
    console.log("[ok] wrote:", proofPath);
    console.log("status:", a.response.status);
    if (Array.isArray(a.response.degradedReasons) && a.response.degradedReasons.length > 0) {
      console.log("degradedReasons:", a.response.degradedReasons);
    }
    console.log("normalizedWindow:", a.response.window);

    if (!isByteIdentical) {
      console.error(
        "[fail] Snapshot responses are not byte-identical after stable stringify. This breaks reproducibility proof.",
      );
      degradedOrError = true;
    }

    if (a.sha256 !== b.sha256) {
      console.error("[fail] sha256 differs between captures:", a.sha256, b.sha256);
      degradedOrError = true;
    }

    if (a.response.status !== "ok") {
      // Always write artifacts for operators, but fail the run so it is visible.
      console.error("[degraded] snapshot.status != ok:", a.response.status);
      degradedOrError = true;
    }
  }

  if (degradedOrError) {
    process.exitCode = 1;
    return;
  }

  console.log("\n[pass] All scopes produced reproducible snapshots with status=ok.");
}

void main();
