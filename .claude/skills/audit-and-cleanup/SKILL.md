---
name: audit-and-cleanup
description: Use when asked to audit a codebase for cleanup, dead code, broken routes/imports, duplicates, or maintainability risk, or to plan a cleanup pass. Produces an evidence-backed findings table + a phased roadmap, then executes phases with verification gates between them.
---

Structured codebase-audit → phased-cleanup workflow. Evidence over guesses; verify
between phases. Pair with [verify-gate] for the checks.

## 1. Map before judging
- App framework, router, build/test/lint commands, entry points.
- Trace routes filesystem → pages/handlers; trace UI API calls → server handlers.
- Find duplicates by purpose/behavior, not just exact text.

## 2. Findings table (one row per issue)
`Category | Files | Problem | Evidence | Risk (low/med/high) | Fix`
Categories: broken route/import/endpoint · dead code · duplicate/redundant ·
inconsistent architecture · runtime risk (swallowed errors, eager throws, broken
auth/loading) · test/build failures · risky-to-touch.
Every row needs **concrete evidence** (grep result, file:line, failed command) —
never assert from assumption. Re-verify memory/doc claims against current code.

## 3. Phased roadmap (execute in order, verify-gate between phases)
- **Phase 1 — safe mechanical:** delete orphans, dedupe registrations, gitignore, stale config.
- **Phase 2 — route/import/build:** fix broken flows; removals that span imports.
- **Phase 3 — redundancy consolidation:** merge duplicate logic; migrate hand-rolled to shared.
- **Phase 4 — deeper architectural:** lazy-init/side-effect fixes, tooling, spec-first work.

## 4. Discipline
- Run verify-gate to capture a green **baseline** first; re-run after each phase.
- Decisions that change behavior, remove a feature, or touch generated/DB/auth code →
  ask before acting (use AskUserQuestion). Default to the reversible option.
- Keep auditors read-only; keep fixes scope-capped per phase.
- Never hand-edit generated code or run `drizzle push` — see CLAUDE.md.
- Report what's done, deferred (with reason), and risky-to-touch.
