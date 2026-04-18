# M002 Final Verification Runbook (End-to-End Learning Loop)

This runbook stitches together M002 slices **S01–S05** into a single operator checklist.

It is designed to be usable in two modes:

- **CI / secretless verification:** runs in this repo with no running services. This proves contract shape, determinism helpers, and proof tests.
- **Live verification:** requires a running API server + DB seeded with at least some AI evaluation data. This produces **on-disk evidence artifacts** under `scripts/m002-final-verification/out/` and allows verifying the dashboard behavior.

---

## 0) Definitions and scope

- **Task scopes (stable strings):**
  - `resume_review`
  - `cover_letter_review`
- **Canonical join key:** `run_id` (S01). Used to join AI calls → generated artifacts → approval/evaluation → feedback.
- **Snapshot contract:** `GET /ai-metrics-snapshot?metricsVersion=v1&taskScope=...&windowStart=...&windowEnd=...` (S02/S03).
- **Degraded-state signaling:** snapshot responses can return `status: "degraded"` and `degradedReasons: string[]` (S02/S03). Degraded means **some rows were excluded** due to lineage/reproducibility guarantees failing.
- **Evidence trail:** `scripts/m002-final-verification/out/*` (S05). This is the canonical on-disk evidence for final milestone verification.

---

## 1) CI / secretless checks (must pass in this repo)

These checks require **no** `API_BASE_URL`, DB, or secrets.

### 1.1 Workspace typecheck

```bash
corepack pnpm run -r typecheck
```

### 1.2 S05 “final assembly proof” tests

```bash
corepack pnpm --filter @workspace/api-server exec vitest run src/routes/__tests__/final-assembly-proof.test.ts
```

Notes:
- This is a **secretless** proof test intended to be runnable in constrained CI.
- It encodes fail-closed expectations and evaluation upsert precedence assumptions used by the snapshot/report layers.

### 1.3 (Optional) Focused API-server tests that anchor the contract

If you want to re-validate the most important invariants locally (still secretless):

```bash
corepack pnpm --filter @workspace/api-server exec vitest run \
  src/routes/__tests__/lineage-proof.test.ts \
  src/routes/__tests__/ai-metrics-snapshot.test.ts
```

---

## 2) Live mode prerequisites (required for the end-to-end proof)

To produce real evidence artifacts and validate dashboard behavior, you need:

- Node.js 20+
- API server reachable at `API_BASE_URL` (example: `http://localhost:3001`)
- A DB seeded enough that there are at least some evaluations in-window for task scopes above
- Evaluations must be joinable via **canonical run lineage** (S01). Rows with missing/invalid lineage will be excluded and trigger degraded state.

Environment variable:

```bash
export API_BASE_URL=http://localhost:3001
```

---

## 3) Run the prompt-iteration harness (S04)

The prompt-iteration harness is the operator procedure for running a small A/B prompt iteration and capturing snapshot artifacts.

### 3.1 Configure

```bash
cp scripts/ai-prompt-iteration/experiment-config.example.json scripts/ai-prompt-iteration/experiment-config.json
```

Edit `scripts/ai-prompt-iteration/experiment-config.json` to set:
- `taskScope`
- a fixed `windowStart`/`windowEnd` (ISO strings)

### 3.2 Create / ensure prompt versions (A and B)

```bash
node scripts/ai-prompt-iteration/run-experiment.ts
```

This prints promptVersionIds and guidance for updating config.

### 3.3 Produce evaluations (outside the harness)

The harness does **not** generate resumes/cover letters on its own. Instead:

1. Switch which prompt version is active (A vs B)
2. Run your normal app workflow to generate outputs
3. Approve/reject outputs (this is where evaluations are captured)
4. Record resulting `runId`s in the experiment config

### 3.4 Capture snapshot JSON artifacts

```bash
node scripts/ai-prompt-iteration/snapshot.ts
```

Expected outputs:
- `scripts/ai-prompt-iteration/out/*.json`
- Each file includes the exact request URL, normalized window bounds, and degraded-state signals.

---

## 4) Run the S05 final verification script (evidence artifacts)

This is the milestone-level reproducibility/evidence capture step.

### 4.1 CI / dry-run (expected failure)

In environments without a running API server, this script runs in **dry-run** mode and exits non-zero.

```bash
node scripts/m002-final-verification/final-verify.ts
```

Expected stderr includes:
- `[dry-run] API_BASE_URL is not set.`

This is intentional: it proves the script is safe to execute without secrets.

### 4.2 Live run (produces the on-disk evidence trail)

```bash
API_BASE_URL=http://localhost:3001 node scripts/m002-final-verification/final-verify.ts
```

Outputs:
- Writes evidence under `scripts/m002-final-verification/out/`
- For each `(taskScope, windowStart, windowEnd)`:
  - `...__capture-a.json`
  - `...__capture-b.json`
  - `...__sha256.txt`

Pass/fail meaning:
- Exit `0`: reproducibility OK and `status=ok` for all scopes.
- Exit `1`: live run but reproducibility failed **or** snapshot returned `status=degraded`/`error` (artifacts still written).
- Exit `2`: dry-run (no `API_BASE_URL`).

---

## 5) Dashboard verification checklist (/ai-metrics)

Goal: confirm the dashboard surfaces both **metrics** and **trust signals** (degraded + normalized window bounds).

Navigate to the admin dashboard page:

- `GET /ai-metrics` (UI route)

### 5.1 Where degraded banners appear

In `artifacts/dashboard/src/pages/ai-metrics/index.tsx`:
- The degraded banner is rendered by `DegradedBanner` when `snapshot.status === "degraded"`.
- The banner shows:
  - `snapshot.window.startInclusive` and `snapshot.window.endExclusive` (normalized window bounds)
  - `snapshot.degradedReasons` list

What to verify:
- When the API returns `status=degraded`, the banner appears and is visually prominent.
- The banner’s window bounds match the **normalized** window from the API response (not the raw request).

### 5.2 Where window bounds appear

The banner prints:
- `Window: <startInclusive> → <endExclusive>`

Verify these match the snapshot artifacts produced by the scripts (same bounds for the same query).

### 5.3 Fields that must match the snapshot artifacts

For any snapshot JSON captured to disk (either from `scripts/ai-prompt-iteration/out/` or `scripts/m002-final-verification/out/`), the dashboard should reflect:

- `status` and `degradedReasons` (degraded-state trust signal)
- `window.startInclusive` and `window.endExclusive` (normalized window)
- Top-level aggregates:
  - `aggregates.evaluationCount`
  - `aggregates.approvalOutcomeCounts`
- Prompt-version aggregates (when present):
  - `aggregates.byPromptVersion[<promptVersionId>]...`
- Series (when present):
  - `series[*].bucketStartInclusive`
  - `series[*].evaluationCount`

Note: The dashboard currently reads some extended v1 fields via runtime-safe casts because generated client types may lag the OpenAPI response shape.

---

## 6) “If degraded”: how to interpret degradedReasons and lift claims

If `snapshot.status === "degraded"`:

1. Treat the snapshot as **partially ineligible** for lift claims.
2. Use `degradedReasons` to understand what was excluded.
3. Use the normalized window bounds to reproduce the exact request for debugging.

Common interpretation guidance:

- **Lineage-related degraded reasons** (e.g. missing root AI event / invalid run_id):
  - Some evaluation rows could not be proven joinable back to a canonical AI call.
  - These rows are excluded; do not claim lift that depends on them.

- **Reproducibility-related degraded reasons**:
  - Some rows failed contract eligibility checks.
  - Snapshot may still be useful for trend visibility, but it is not defensible for “improvement” claims.

Lift-claim rule:
- Only compute/report lift from eligible rows. If degraded, either (a) compute lift on eligible-only candidates (if the contract provides eligible sets), or (b) refrain from claiming lift and document exclusions.

---

## 7) Evidence packaging for milestone verification (what to attach / reference)

For the final M002 verification story, reference the following repo artifacts:

- S04 harness + report template:
  - `scripts/ai-prompt-iteration/README.md`
  - `scripts/ai-prompt-iteration/EXPERIMENT-REPORT.md`
  - `scripts/ai-prompt-iteration/out/*`
- S05 reproducibility evidence (canonical):
  - `scripts/m002-final-verification/out/*`
- Proof tests (CI-safe):
  - `artifacts/api-server/src/routes/__tests__/final-assembly-proof.test.ts`

When validating a live environment, ensure the on-disk `scripts/m002-final-verification/out/*` artifacts are captured and preserved as the milestone’s reproducibility evidence.
