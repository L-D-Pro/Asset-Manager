# Handoff: Best Practices Guards — Two Issues to Fix

**Repo:** `/var/home/cyrustogo/LDPro/Asset-Manager` (pnpm monorepo, Node 24, TypeScript strict)  
**Branch:** `feat/design-overhaul` (work here, do not touch `main`)  
**Verification command** (run after every change — bypasses corepack guard):
```bash
# From repo root:
node ./node_modules/typescript/bin/tsc --build
cd artifacts/api-server && VITEST=$(node -e "console.log(require.resolve('vitest/package.json').replace(/package.json$/,'vitest.mjs'))") && node --env-file-if-exists=../../.env "$VITEST" run --reporter=dot
cd ../dashboard && node ./node_modules/vite/bin/vite.js build
```

---

## Background

The admin "Best Practices" page (`/admin/best-practices`) has two subsystems:

1. **Items list** (top) — text rules injected verbatim into AI prompts as numbered quality standards. Source tagged `hardcoded`, `ai`, or `hybrid`. Users can toggle active/inactive (recently fixed — `active: false` now persists and is respected by `formatBestPracticesForPrompt`).

2. **Hardcoded guards** (bottom, labelled "always enforced · not editable") — named boolean keys (`noMarkdown`, `mustTailorToJob`, `noGenericFiller`, `coverLetterLengthCheck`, `coverLetterMustAddressBusinessProblem`) stored in `config.hardcodedGuards: Record<string, boolean>`.

The guards map to two different enforcement mechanisms:
- **Deterministic code checks** (always run, no AI): `checkNoMarkdown`, `checkNoGenericFiller`, `checkCoverLetterLength` in `validation.ts`
- **Semantic AI review** (second AI call post-generation): `validateSemanticQuality` in `validation.ts` — checks `mustTailorToJob` (document targets the specific job) and `coverLetterMustAddressBusinessProblem` (addresses a concrete business problem)

---

## Issue 1: Guard keys have zero effect on anything

### What's broken

In `artifacts/api-server/src/lib/best-practices.ts`, `formatBestPracticesForPrompt` tries to use the guard state to suppress a prompt item:

```ts
// BROKEN — key never matches
const guardKey = item.description.slice(0, 30).toLowerCase().replace(/[^a-z0-9]/g, "_");
if (config.hardcodedGuards[guardKey] === false) return false;
```

For an item with description `"Use clean command: Do not use markdown..."`, this generates `use_clean_command__do_not_use_m` — which will never equal `noMarkdown`. The lookup silently misses, so guard state has zero effect on prompt content.

Additionally, the validation functions (`checkNoMarkdown` etc.) are called unconditionally in `validateResumeQuality` and `validateCoverLetterQuality` — they don't consult the guard state before running either. So toggling a guard in the DB currently changes nothing.

### The fix

**Each hardcoded item needs a stable `guardKey` field** that links it to its corresponding guard boolean and validation function.

#### Step 1 — Add `guardKey` to the seeded items in `best-practices.ts`

The `BestPracticeItem` interface already has `guardKey?: string` (unused). Populate it on the hardcoded items:

```ts
// In DEFAULT_BEST_PRACTICES.items:
{ description: "Use clean command: Do not use markdown...", source: "hardcoded", guardKey: "noMarkdown", ... },
{ description: "Tailor the resume to this specific job...",  source: "hardcoded", guardKey: "mustTailorToJob", ... },
{ description: "Lead with quantified impact...",             source: "hardcoded", guardKey: "noGenericFiller", ... },
// (noGenericFiller maps to the filler check; quantified impact is separate)
{ description: "No generic filler...",                       source: "hardcoded", guardKey: "noGenericFiller", ... },
{ description: "Cover letter should be 3-5 concise...",      source: "hardcoded", guardKey: "coverLetterLengthCheck", ... },
{ description: "Cover letter should name a specific biz...", source: "hardcoded", guardKey: "coverLetterMustAddressBusinessProblem", ... },
```

Read the existing items carefully and assign the correct key to each. `mustTailorToJob` maps to the tailoring rule. The quantified impact rule has no direct guard and should be left without a `guardKey`.

#### Step 2 — Fix the key lookup in `formatBestPracticesForPrompt`

Replace the broken key derivation with a direct `guardKey` lookup:

```ts
const activeItems = config.items.filter((item) => {
  if (item.active === false) return false;
  // Use the item's own guardKey (if set) to check guard state
  if (item.guardKey && config.hardcodedGuards[item.guardKey] === false) return false;
  return true;
});
```

#### Step 3 — Gate the validation functions on guard state

In `validateResumeQuality` and `validateCoverLetterQuality`, accept the guard state and skip checks when the guard is off. The pipeline already has access to the `BestPracticesConfig` — thread it through or pass the guards as a parameter:

```ts
export function validateResumeQuality(
  documentText: string,
  bullets: { text: string }[],
  guards: Record<string, boolean> = {},
): void {
  const violations: string[] = [
    ...(guards.noMarkdown !== false ? checkNoMarkdown(documentText) : []),
    ...(guards.noGenericFiller !== false ? checkNoGenericFiller(documentText) : []),
    ...(guards.quantifiedImpact !== false ? checkQuantifiedImpact(bullets) : []),
  ];
  // ... rest unchanged
}
```

Same pattern for `validateCoverLetterQuality` with `noMarkdown`, `noGenericFiller`, `coverLetterLengthCheck`.

For `validateSemanticQuality`, the guard state should gate whether it runs at all:
```ts
// In the pipeline, before calling validateSemanticQuality:
if (guards.mustTailorToJob !== false || guards.coverLetterMustAddressBusinessProblem !== false) {
  await validateSemanticQuality(documentText, jobContext, jobId, userId);
}
```

#### Step 4 — Find where guards are loaded and thread them through

Search for calls to `validateResumeQuality` and `validateCoverLetterQuality` in:
- `artifacts/api-server/src/lib/pipelines/resume-tailor.ts`
- `artifacts/api-server/src/lib/pipelines/cover-letter-draft.ts`

Both pipelines already call `getBestPractices()` or accept a config — pass `config.hardcodedGuards` down to the validation functions.

#### Tests to write (TDD — write failing tests first)

File: `artifacts/api-server/src/lib/__tests__/best-practices.test.ts` (already exists)

Add tests:
- `formatBestPracticesForPrompt excludes item when its guardKey is set to false in hardcodedGuards`
- `formatBestPracticesForPrompt includes item when its guardKey is missing from hardcodedGuards`
- `validateResumeQuality skips markdown check when noMarkdown guard is false`
- `validateResumeQuality skips filler check when noGenericFiller guard is false`

File: `artifacts/api-server/src/lib/__tests__/validation.test.ts` (already exists, add to it)

---

## Issue 2: `quality_check` scope is invisible and unconfigurable

### What's broken

`validateSemanticQuality` in `validation.ts` calls:
```ts
callAI({ taskType: "quality_check", ... })
```

The model router looks up `quality_check` in `ai_model_configs`, finds no match, and silently falls back to the `default` scope (`anthropic/claude-3.5-haiku`). There is no way to see, configure, or monitor this AI call from the admin UI.

The hardcoded scope list in the frontend:
```ts
// artifacts/dashboard/src/pages/ai-config/index.tsx line 18
const TASK_SCOPES = ["chat", "default", "jd_parsing", "resume_tailoring", "cover_letter", "claim_generation"] as const;
```

`quality_check` is missing — so it never appears in the "Add Config" dropdown.

### The fix

#### Step 1 — Add `quality_check` to the frontend scope lists

Three files to update:

**`artifacts/dashboard/src/pages/ai-config/index.tsx`** line ~18:
```ts
const TASK_SCOPES = [
  "chat", "default", "jd_parsing", "resume_tailoring",
  "cover_letter", "claim_generation", "quality_check"   // ← add
] as const;
```

**`artifacts/dashboard/src/pages/ai-metrics/index.tsx`** line ~16:
```ts
const COMMON_SCOPES = [
  "chat", "skill_routing", "jd_parsing", "resume_tailoring",
  "cover_letter", "claim_generation", "quality_check"   // ← add
] as const;
```

That's it for the frontend — the rest of the config and metrics pages are data-driven from those constants.

#### Step 2 — Seed a default `quality_check` config (optional but recommended)

If the DB is empty for `quality_check`, the model router will still fall back to `default`. That's acceptable. But to make it explicit and visible from day one, add a seed entry alongside the other hardcoded seeds — or just document that the admin should add one manually via the UI after deploying.

The recommended model for this task: something fast and cheap since it runs post-generation on every draft. `anthropic/claude-3.5-haiku` (same as current default fallback) is fine.

#### Step 3 — Surface it in the pipeline diagram

In `artifacts/dashboard/src/components/ai-pipeline/types.ts`, the pipeline step renderer maps `taskScope` values to display names. Add:
```ts
if (taskScope === "quality_check") return "quality_check";
```

And in the pipeline diagram data (wherever resume_tailoring and cover_letter pipelines are described), add a `quality_check` step after the main generation step to make it visible:
```
Step 3: resume tailoring → Step 4: quality check → Step 5: ats score → Step 6: approval gate
```

Check `artifacts/dashboard/src/pages/pipeline-diagram.tsx` for where the pipeline step data lives.

#### No new tests needed for this issue

This is purely additive — adding a string to a constant list and showing a step in a diagram. The model router already handles the scope lookup correctly; `quality_check` will just have an explicit config instead of falling through to default.

---

## File map

| File | Issue | Change |
|---|---|---|
| `artifacts/api-server/src/lib/best-practices.ts` | #1 | Add `guardKey` to seeded items; fix key lookup in `formatBestPracticesForPrompt` |
| `artifacts/api-server/src/lib/pipelines/validation.ts` | #1 | Add `guards` param to `validateResumeQuality` + `validateCoverLetterQuality`; gate `validateSemanticQuality` call |
| `artifacts/api-server/src/lib/pipelines/resume-tailor.ts` | #1 | Pass `config.hardcodedGuards` to `validateResumeQuality` |
| `artifacts/api-server/src/lib/pipelines/cover-letter-draft.ts` | #1 | Pass `config.hardcodedGuards` to `validateCoverLetterQuality` |
| `artifacts/api-server/src/lib/__tests__/best-practices.test.ts` | #1 | Add 4 new tests (TDD first) |
| `artifacts/api-server/src/lib/__tests__/validation.test.ts` | #1 | Add 2 new tests for guarded validation |
| `artifacts/dashboard/src/pages/ai-config/index.tsx` | #2 | Add `"quality_check"` to `TASK_SCOPES` |
| `artifacts/dashboard/src/pages/ai-metrics/index.tsx` | #2 | Add `"quality_check"` to `COMMON_SCOPES` |
| `artifacts/dashboard/src/components/ai-pipeline/types.ts` | #2 | Add `quality_check` display mapping |
| `artifacts/dashboard/src/pages/pipeline-diagram.tsx` | #2 | Add quality check step to pipeline diagram |

---

## Key invariants to preserve

- `validateSemanticQuality` must remain **non-fatal on AI call failure** — the `try/catch` that swallows errors and returns without throwing must stay. This is intentional: a broken quality-check AI call should not block the user from getting their draft.
- The `active` field fix (items not deleted on deactivate) was recently landed — do not revert it. The `active: false` filter at the top of `formatBestPracticesForPrompt` must remain.
- Never edit files in `lib/api-zod/src/generated/` or `lib/api-client-react/src/generated/` — those are codegen outputs. If the OpenAPI spec needs updating, edit `lib/api-spec/openapi.yaml` and run `pnpm --filter @workspace/api-spec run codegen`.
- TypeScript strict mode — no `any`, no `as unknown as T`.
