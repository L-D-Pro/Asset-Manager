# AI Prompt Iteration — Experiment Report (Template + Proof Artifacts)

This report documents one prompt-version iteration (A → B) and captures the evidence needed for **S04**:

- A baseline snapshot for prompt version **A**
- An improved snapshot for prompt version **B**
- A reproducibility rerun snapshot for the **same request** (must match baseline/improved snapshot JSON exactly for that request)

> Important: In this repo we intentionally keep **no secrets** and do not assume access to the running API/DB in CI.
> The JSON files in `scripts/ai-prompt-iteration/out/` are therefore **placeholders** until generated in a real environment.
> This report MUST NOT be used to claim lift until the placeholders are replaced with real snapshot artifacts.

## What changed (Prompt Version A → B)

- **Task scope:** _(fill)_
- **Prompt Version A**
  - id: _(fill)_
  - label: `A`
  - intent: baseline prompt
- **Prompt Version B**
  - id: _(fill)_
  - label: `B`
  - intent: improved prompt

### Rationale

Describe the concrete prompt edits and why they should improve metrics:

- _(fill: e.g. clearer rubric, tightened output format, stronger constraints, etc.)_

## Snapshot request (exact)

All snapshots MUST be produced from this endpoint:

`GET /ai-metrics-snapshot`

Using query params:

- `metricsVersion=v1`
- `taskScope=...`
- `windowStart=...` (ISO)
- `windowEnd=...` (ISO)

The snapshot script writes the **full request URL** into each JSON artifact.

## Evidence artifacts (files)

These files must exist and be checked in:

- `scripts/ai-prompt-iteration/out/snapshot-baseline.json`
- `scripts/ai-prompt-iteration/out/snapshot-improved.json`
- `scripts/ai-prompt-iteration/out/snapshot-rerun.json`
- `scripts/ai-prompt-iteration/out/snapshot-rerun.sha256`

## Metrics comparison (to be generated)

Fill this section only after generating real snapshots.

| Metric | Baseline (A) | Improved (B) | Δ | Notes |
|---|---:|---:|---:|---|
| approvalRate | _(tbd)_ | _(tbd)_ | _(tbd)_ | eligible rows only |
| avgEditDistance | _(tbd)_ | _(tbd)_ | _(tbd)_ | eligible rows only |
| rubric.mean.* | _(tbd)_ | _(tbd)_ | _(tbd)_ | eligible rows only |

### Degraded-state / eligibility guard

For each snapshot JSON:

- Confirm `status` is `ok`.
- If `status` is `degraded`, list `degradedReasons` and **exclude ineligible rows** from lift claims.
- The lift claim MUST be computed only from eligible rows defined by the v1 contract.

## Reproducibility

Goal: prove that rerunning the **exact same snapshot request** yields **identical JSON**.

### Procedure

1. Generate baseline snapshot:

   ```bash
   node scripts/ai-prompt-iteration/snapshot.ts --out snapshot-baseline.json
   ```

2. Generate improved snapshot (after switching active prompt version or assigning runIds to version B):

   ```bash
   node scripts/ai-prompt-iteration/snapshot.ts --out snapshot-improved.json
   ```

3. Re-run the baseline (or improved) snapshot **with identical query params**:

   ```bash
   node scripts/ai-prompt-iteration/snapshot.ts --out snapshot-rerun.json
   ```

4. Compute hash and verify it matches the expected SHA:

   - Generate SHA:

     ```bash
     node -e "const fs=require('fs');const crypto=require('crypto');const b=fs.readFileSync('scripts/ai-prompt-iteration/out/snapshot-rerun.json');console.log(crypto.createHash('sha256').update(b).digest('hex'))" \
       > scripts/ai-prompt-iteration/out/snapshot-rerun.sha256
     ```

   - Verify determinism:

     ```bash
     node -e "const fs=require('fs');const crypto=require('crypto');const expected=fs.readFileSync('scripts/ai-prompt-iteration/out/snapshot-rerun.sha256','utf8').trim();const actual=crypto.createHash('sha256').update(fs.readFileSync('scripts/ai-prompt-iteration/out/snapshot-rerun.json')).digest('hex');if(expected!==actual){console.error('sha mismatch');process.exit(1)}console.log('sha ok')"
     ```

### Expected outcome

- `snapshot-rerun.json` is byte-for-byte identical to the first run for the same request.
- `snapshot-rerun.sha256` contains the SHA-256 hash of `snapshot-rerun.json`.

## Notes / TODOs (restricted to this folder)

- Replace placeholder JSON artifacts with real outputs from the harness in an environment where the API server is running.
- Fill in prompt version IDs and task scope.
- Populate the metrics comparison table from the snapshot JSON.
