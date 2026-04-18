# AI prompt iteration harness (local)

This folder contains a deterministic, local-run harness for doing a small prompt-version A/B iteration and capturing an `ai-metrics-snapshot` v1 JSON artifact for a fixed, normalized window.

The harness is designed to be reviewable without secrets. If `API_BASE_URL` is **not** set, scripts run in **dry-run** mode (they print the intended calls and exit non-zero).

## Prerequisites

- Node.js 20+ (uses global `fetch`)
- API server running locally (or reachable) that serves these endpoints:
  - `GET /ai-prompt-versions?taskScope=...`
  - `POST /ai-prompt-versions`
  - `PATCH /ai-prompt-versions/:id`
  - `GET /ai-metrics-snapshot?metricsVersion=v1&windowStart=...&windowEnd=...&taskScope=...`
- Database seeded enough that:
  - at least one prompt version can be created for the selected `taskScope`
  - you can produce evaluations for the chosen `taskScope` (outside the harness; see below)

## Files

- `experiment-config.example.json` — copy to `experiment-config.json` for local runs.
- `run-experiment.ts` — creates two prompt versions for a chosen `taskScope` and prints a place to record run IDs produced under each version.
- `snapshot.ts` — calls `GET /ai-metrics-snapshot` and writes the JSON response to `out/` with deterministic naming.

## Setup

1. Copy config:

   ```bash
   cp scripts/ai-prompt-iteration/experiment-config.example.json scripts/ai-prompt-iteration/experiment-config.json
   ```

2. Set environment:

   ```bash
   export API_BASE_URL=http://localhost:3001  # or wherever the api server runs
   ```

## Run: create prompt versions (A/B)

```bash
node scripts/ai-prompt-iteration/run-experiment.ts
```

What this does:

- Ensures two prompt versions exist for `taskScope` with labels `A` and `B`.
- Marks version `A` active by default (can be changed in config).
- Prints a JSON snippet to paste back into your `experiment-config.json` once you have real `runId`s and `promptVersionId`s.

### Producing evaluations / run IDs

This harness does **not** attempt to run generation flows (resume/cover-letter creation) because that depends on local product flows, seed data, and UIs.

Instead:

- Switch active prompt version (A vs B)
- Run your normal app workflow to generate and approve/reject outputs
- Record the resulting `runId`s for each prompt version in `experiment-config.json`

## Run: capture snapshot JSON

```bash
node scripts/ai-prompt-iteration/snapshot.ts
```

Outputs:

- Writes `scripts/ai-prompt-iteration/out/*.json`
- Each output includes:
  - the exact request URL used
  - the response’s normalized window bounds
  - the `status` and any `degradedReasons`

## Dry-run mode

If `API_BASE_URL` is not set, scripts:

- print the intended HTTP calls
- exit with a non-zero status

This makes the harness safe to run in environments without secrets/services, while still providing a repeatable procedure when services exist.
