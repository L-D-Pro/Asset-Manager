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
2. Deterministic scoring (triggers + attachment boosts) → single clear winner ≥ threshold → wins
3. Ambiguous deterministic (≥2 candidates within gap of top) → LLM disambiguates
4. Zero deterministic matches + strong attachment context → LLM routing attempt
5. Zero deterministic matches + no strong context → no skill selected
```

---

## Thresholds and Constants

| Constant | Value | Meaning |
|---|---|---|
| `AUTO_THRESHOLD` | `0.3` | Minimum score for a skill to be considered a deterministic match |
| `TRIGGER_WEIGHT` | `0.3` | Score added per matching trigger example |
| `NEGATIVE_WEIGHT` | `0.5` | Score subtracted per matching negative trigger |
| `AMBIGUOUS_GAP` | `0.15` | Two candidates within this gap of each other are "tied" → LLM called |
| `HARD_MAX_SKILLS` | `2` | Absolute ceiling on injected skills (even in `explicit` mode) |

---

## Deterministic Scoring

`scoreSkills(message, attachmentKinds, skills)` returns a score per skill:

```
score = Σ TRIGGER_WEIGHT for each triggerExample present in message (case-insensitive substring)
      − Σ NEGATIVE_WEIGHT for each negativeTrigger present in message
      + attachmentBoost (see below)
```

**Winner logic:**
- Filter candidates where `score >= AUTO_THRESHOLD`
- If 0 candidates → see attachment-context path below
- If 1 candidate above threshold → select it (no LLM)
- If ≥2 candidates within `AMBIGUOUS_GAP` of the top → LLM disambiguates
- Otherwise top candidate wins

---

## Attachment Boosts

Applied deterministically before the threshold check. Boosts are based on
attachment kinds present in the current turn:

| Attachment combo | Slug condition | Boost |
|---|---|---|
| `base_resume` + `job` | slug contains `"tailor"` or `"tailored-resume"` | +0.4 |
| `base_resume` + `job` | slug contains `"resume"` | +0.2 |
| `tailored_resume` + `job` | slug contains `"audit"` or `"resume-audit"` | +0.4 |
| `tailored_resume` only | slug contains `"audit"` | +0.2 |
| "cover" in message text | slug contains `"cover"` | +0.3 |

**Boost threshold interaction:**

- `base_resume` + `job` → `resume-tailoring` slug gets +0.4 (≥ threshold). Vague
  messages like "make this fit better" select deterministically without LLM.
- `tailored_resume` + `job` → `resume-audit` slug gets +0.4 (≥ threshold).
  "Is this good?" selects resume-audit deterministically.
- `tailored_resume` alone → `resume-audit` slug gets +0.2 (< threshold = 0.3).
  Vague messages do NOT auto-select; LLM is attempted instead if classify is wired.
- `base_resume` alone → no boost (needs JD to exceed threshold for tailoring).
  Vague messages → LLM attempted if classify is wired; no-skill otherwise.

---

## LLM Router

The cheap LLM router (`classifyWithLLM`) is called when:

1. Deterministic candidates are ambiguous (≥2 within `AMBIGUOUS_GAP` of top score)
2. Zero deterministic matches **and** strong attachment context exists:
   `attachmentKinds` includes `base_resume`, `tailored_resume`, or `job`

**Strong attachment** = any of `["base_resume", "tailored_resume", "job"]` present.
`claims` and `document` attachments do **not** qualify as strong context.

If `classify` is not provided (e.g., tests), or returns `null`/empty → no skill selected.

The LLM response is not filtered by confidence threshold in code — it is expected
to return an empty array when not confident (governed by the router system prompt).

---

## No-Fallback-to-All Rule

This is a hard invariant. No code path in `auto`, `explicit`, or `none` mode
can inject all active skills. The only path that injects all skills is `debug_all`,
and that is blocked in production.

If you see all skills injected in a non-debug run, that is a bug.

---

## Max Selected Skills

- Config: `maxSelectedSkills` (DB lever, default 1)
- Hard cap: `HARD_MAX_SKILLS = 2` (code constant, cannot be overridden via config)
- `debug_all` bypasses both limits

---

## Routing Examples

### Resume tailoring (base_resume + job attachments)

```
User: "make this better"
Attachments: [base_resume, job]

Scores:
  resume-tailoring: 0 (no trigger match) + 0.4 (tailor boost) + 0.2 (resume boost) = 0.6 ✓
  cover-letter:     0
  resume-audit:     0

Decision: resume-tailoring (deterministic, confidence = 0.6)
```

### Resume audit (tailored_resume + job)

```
User: "is this any good?"
Attachments: [tailored_resume, job]

Scores:
  resume-audit:    0 (no trigger match) + 0.4 (audit boost) = 0.4 ✓
  resume-tailoring: 0

Decision: resume-audit (deterministic, confidence = 0.4)
```

### Cover letter

```
User: "write my cover letter"
Attachments: []

Scores:
  cover-letter: 0.3 (trigger match) + 0.3 (cover in message) = 0.6 ✓
  others: 0 or negative (negative trigger for "cover letter")

Decision: cover-letter (deterministic, confidence = 0.6)
```

### General chat (no attachments, no triggers)

```
User: "what's a good way to network?"
Attachments: []

Scores: all 0

Decision: no skill selected ("No skill matched the message — catalog only.")
```

### Vague message + resume only (no JD)

```
User: "can you help me improve this?"
Attachments: [base_resume]

Scores: all 0 (no trigger match, no boost — JD required for tailor boost)
strongAttachment = true (base_resume present)

→ LLM router called if classify is wired
→ If LLM not confident or unavailable: no skill selected
```

---

## Production Behavior

| Scenario | Result |
|---|---|
| `debug_all` in dev | All skill bodies injected, cap/budget bypassed |
| `debug_all` in prod (`NODE_ENV=production`) | Downgraded to `auto`, warning logged |
| Unknown routing mode string in DB | `asMode()` maps to `auto` |
| Skill catalog in prompt | Never — `catalog = []` always; router has metadata, model sees only selected bodies |
