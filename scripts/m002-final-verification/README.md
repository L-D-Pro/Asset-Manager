# M002 Final Verification (Reproducibility Evidence)

This folder contains a deterministic **final verification script** used in Milestone M002 to produce an on-disk evidence trail for reproducibility.

## What it proves

- The API `GET /ai-metrics-snapshot` is **stable/reproducible** for a fixed window.
- The snapshot surface exposes **degraded-state signals** (`status`, `degradedReasons`, and normalized window bounds).
- Evidence artifacts are written to disk under deterministic, operator-friendly filenames.

This script intentionally **does not** attempt to create or approve resume/cover-letter versions. That requires auth/session and a live DB. Instead, it focuses on the “final assembly” proof that can be automated: **metrics snapshot reproducibility**.

## Output artifacts

Artifacts are written to:

- `scripts/m002-final-verification/out/`

Per `(taskScope, windowStart, windowEnd)` the script writes:

- `...__capture-a.json` — first capture (includes normalized window)
- `...__capture-b.json` — second capture
- `...__sha256.txt` — sha256 proof of the **stable-stringified** response + status + degradedReasons

Filenames encode the task scope and window so they can be referenced directly from a runbook.

## Usage

### Dry-run (CI-safe)

If `API_BASE_URL` is **not** set, the script prints the exact intended API calls and exits non-zero.

```bash
node scripts/m002-final-verification/final-verify.ts
```

### Live mode

Set `API_BASE_URL` to a running API server.

```bash
API_BASE_URL=http://localhost:3001 node scripts/m002-final-verification/final-verify.ts
```

Notes:
- The window bounds come from `scripts/ai-prompt-iteration/experiment-config.json` if present,
  otherwise `scripts/ai-prompt-iteration/experiment-config.example.json`.
- The script queries both task scopes:
  - `resume_review`
  - `cover_letter_review`

## Exit codes

- `2` — dry-run (no `API_BASE_URL`)
- `1` — live run but reproducibility failed or snapshot status was degraded/error (artifacts still written)
- `0` — all scopes produced byte-identical stable JSON and `status=ok`
