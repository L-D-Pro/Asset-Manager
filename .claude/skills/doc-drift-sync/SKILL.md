---
name: doc-drift-sync
description: Use when asked to update docs to match the code, check docs for staleness, or sync README/ARCHITECTURE/CLAUDE/AGENTS/API docs after changes. Compares source reality vs the docs, surfaces stale claims with evidence, and applies surgical corrections — no blind rewrites.
---

Side-by-side source-vs-docs reconciliation. Surgical, evidence-backed corrections —
not wholesale rewrites.

## Steps
1. **Inventory docs** + their claimed facts (counts, endpoints, commands, "no X exists").
2. **Grep the docs for high-drift terms** against current code: removed features,
   endpoint paths, table/route/page counts, tool/command names, "no test suite" /
   "not yet" claims. Each suspected stale line → verify against the actual source.
3. **Only edit what's provably drifted.** Leave undrifted docs alone (lower collision
   risk, especially on a WIP branch). State which you left and why.
4. **Match the doc's existing style/structure/tone.** Prefer surgical Edits over
   rewriting whole files.
5. **Report per file:** what changed, any new endpoints/classes/state documented, and
   clarifying questions about undocumented business logic you hit.

## Gotchas for this repo
- Two API docs exist (`docs/api-overview.md`, `lib/api-spec/API_CONTRACT.md`) — check both.
- The `feat/design-overhaul` branch deliberately stripped page styling; "missing styles"
  are intentional, not doc-worthy bugs.
- Generated dirs (`lib/api-*/src/generated/`) reflect `openapi.yaml`; document the spec, not the output.
