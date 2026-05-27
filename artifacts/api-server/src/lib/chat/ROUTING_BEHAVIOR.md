# Chat Skill Routing Behavior

Reference document for the chat skill-routing pipeline implemented in
`skill-router.ts` and orchestrated by `resolve-system-prompt.ts`.

---

## Routing Modes

| Mode | Behavior |
|---|---|
| `none` | No skill injected. Prompt contains identity + best practices + attachments only. |
| `auto` | Deterministic scoring first; LLM disambiguates if needed. No fallback-to-all. |
| `explicit` | Exactly the skill(s) the user pinned in the chat composer. Falls through to `auto` if no valid slugs. |
| `debug_all` | **Development only.** Injects every active skill body; bypasses cap and token budget. Blocked in production. |

**Unknown/legacy mode strings** are mapped before use:

- `"all"` → `debug_all`
- `"classified"` → `auto`
- anything else unknown → `auto` (safe default)

`debug_all` is additionally guarded by `guardDebugMode()`: if `NODE_ENV === "production"`,
it is downgraded to `auto` and a warning is logged.

---

## Routing Priority Order (auto mode)

```
1. Explicit selection (mode === "explicit" with valid slugs) → wins immediately
2. Deterministic scoring (triggers + attachment boosts) → single clear winner ≥ autoThreshold → wins
3. Ambiguous deterministic (≥2 candidates within ambiguousGap of top) → LLM disambiguates
4. Zero deterministic matches + strong attachment context → LLM routing attempt
5. Zero deterministic matches + no strong context → no skill selected
```

---

## Control-Plane-Tunable Values

The following routing values are stored in `ai_chat_lever_config` and editable
via the Control Plane **Advanced Routing Tuning** section. Changes take effect
on the next chat turn with no restart.

| Field | Default | Range | Controls |
|---|---|---|---|
| `autoThreshold` | 0.3 | [0.0, 1.0] | Min score for a deterministic match |
| `triggerWeight` | 0.3 | [0.0, 2.0] | Score added per matching trigger example |
| `negativeTriggerWeight` | 0.5 | [0.0, 2.0] | Score subtracted per negative trigger |
| `ambiguousGap` | 0.15 | [0.0, 0.5] | Gap within which candidates are "tied" → LLM called |
| `llmConfidenceThreshold` | 0.5 | [0.0, 1.0] | Min LLM confidence to accept a selection |
| `coverBoost` | 0.3 | [0.0, 2.0] | Boost when cover signal detected |
| `boostTailorPlusJob` | 0.4 | [0.0, 2.0] | Boost for tailor-slugs with base_resume+job |
| `boostResumePlusJob` | 0.2 | [0.0, 2.0] | Boost for resume-slugs with base_resume+job |
| `boostAuditTailoredJob` | 0.4 | [0.0, 2.0] | Boost for audit-slugs with tailored_resume+job |
| `boostAuditTailoredOnly` | 0.2 | [0.0, 2.0] | Boost for audit-slugs with tailored_resume (no job) |
| `historyTurnLimit` | 20 | [1, 100] | Conversation history turns fed to model per turn |
| `skillTokenBudget` | 1500 | [0, ∞) | Max tokens of injected skill bodies |
| `maxSelectedSkills` | 1 | [1, 2] | Max skills injected (UI/schema validated) |

---

## Structural Safety Constants (code-only, non-tunable)

| Constant | Value | Purpose |
|---|---|---|
| `HARD_MAX_SKILLS_CEILING` | 2 | Absolute ceiling — cannot be exceeded via config; exported from `skill-router.ts` so UI validation can reference it |
| `CHARS_PER_TOKEN` | 4 | Token estimation denominator for skill budget; in `token-budget.ts` |
| `DEFAULT_MODEL_MAX_TOKENS` | 4096 | Fallback max_tokens when a model config row has null maxTokens; in `stream-openrouter.ts` |

---

## Deterministic Scoring

`scoreSkills(message, attachmentKinds, skills, config)` returns a score per skill:

```
score = Σ triggerWeight for each triggerExample present in message (case-insensitive substring)
      − Σ negativeTriggerWeight for each negativeTrigger present in message
      + attachmentBoost (see Attachment Boosts table)
```

**Winner logic:**
- Filter candidates where `score >= autoThreshold`
- If 0 candidates → see attachment-context path below
- If 1 candidate above threshold → select it (no LLM)
- If ≥2 candidates within `ambiguousGap` of the top → LLM disambiguates
- Otherwise top candidate wins

---

## Attachment Boosts

Applied deterministically before the threshold check. Boosts are based on
attachment kinds present in the current turn. All boost amounts are tunable
via the Control Plane.

| Attachment combo | Slug condition | Boost field |
|---|---|---|
| `base_resume` + `job` | slug contains `"tailor"` or `"tailored-resume"` | `boostTailorPlusJob` (default 0.4) |
| `base_resume` + `job` | slug contains `"resume"` | `boostResumePlusJob` (default 0.2) |
| `tailored_resume` + `job` | slug contains `"audit"` or `"resume-audit"` | `boostAuditTailoredJob` (default 0.4) |
| `tailored_resume` only | slug contains `"audit"` | `boostAuditTailoredOnly` (default 0.2) |
| "cover" in message text or attachments | slug contains `"cover"` | `coverBoost` (default 0.3) |

---

## LLM Router

The cheap LLM router (`classifyWithLLM`) is called when:

1. Deterministic candidates are ambiguous (≥2 within `ambiguousGap` of top score)
2. Zero deterministic matches **and** strong attachment context exists:
   `attachmentKinds` includes `base_resume`, `tailored_resume`, or `job`

**Strong attachment** = any of `["base_resume", "tailored_resume", "job"]` present.
`claims` and `document` attachments do **not** qualify as strong context.

**Fail-closed confidence handling:**
- If the LLM returns a confidence value that is missing, non-numeric, `NaN`, `Infinity`,
  negative, or > 1.0, `classifyWithLLM` returns `null` (no skill selected).
- If `classifyWithLLM` returns results, `routeSkills` additionally filters by
  `llmConfidenceThreshold`: any result with score below the threshold is dropped.
- In the **ambiguous path**: if all LLM results are below threshold, falls back to
  top deterministic match (not no-skill).
- In the **zero-match attachment path**: if all LLM results are below threshold,
  returns no-skill (no fallback).

**Unknown slugs**: LLM results with slugs not in the active skill set are silently
filtered both in `classifyWithLLM` (server-side) and in `routeSkills` (defense-in-depth).

**Router system prompt (`ROUTER_SYSTEM_PROMPT`):**
Currently hardcoded in `resolve-system-prompt.ts`. It governs what the LLM returns.
_Follow-up:_ Seed into `ai_prompt_versions` under `taskScope=skill_routing` so it is
editable via the Control Plane. `classifyWithLLM` already tries `skill_routing` scope
first, so the migration path is low-risk.

---

## No-Fallback-to-All Rule

**This is a hard invariant.** No code path in `auto`, `explicit`, or `none` mode
can inject all active skills. The only path that injects all skills is `debug_all`,
and that is blocked in production.

If you see all skills injected in a non-debug run, that is a bug.

---

## Max Selected Skills

- Config: `maxSelectedSkills` (DB lever, default 1, range [1, 2])
- Structural ceiling: `HARD_MAX_SKILLS_CEILING = 2` (code constant, exported from `skill-router.ts`)
- Schema validation (`openapi.yaml`): `maximum: 2` on `UpdateChatLeverConfigBody.maxSelectedSkills`
- UI validation: `max={2}` on the Control Plane input
- `debug_all` bypasses both limits

---

## Skill Catalog in Prompt

**No catalog is injected.** When routing returns no skill match, the model sees identity
+ best practices + attachment context only — no skill body. The router accesses skill
metadata internally, but the main model never sees a skill catalog listing.
`catalog = []` always in `resolveChatPrompt`.

---

## Production Behavior

| Scenario | Result |
|---|---|
| `debug_all` in dev | All skill bodies injected, cap/budget bypassed |
| `debug_all` in prod (`NODE_ENV=production`) | Downgraded to `auto`, warning logged |
| Unknown routing mode string in DB | `asMode()` maps to `auto` |
| LLM returns invalid/missing confidence | `classifyWithLLM` returns `null` → no skill (fail closed) |
| LLM returns slug not in active skill set | Filtered out at both `classifyWithLLM` and `routeSkills` |
| LLM confidence below `llmConfidenceThreshold` | Filtered: ambiguous path falls back to deterministic; attachment path → no skill |
| Skill catalog in prompt | Never — `catalog = []` always; router sees metadata, model sees only selected bodies |
