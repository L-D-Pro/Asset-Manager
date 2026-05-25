# Claude Usage Patterns — Asset-Manager

> Generated from a local scrape of all Claude Code sessions on this machine
> (`~/.claude/projects/c--Users-uberc-LD-Pro-Asset-Manager/`).
> **Corpus:** 37 session transcripts · 218 real user prompts · ~8,700 tool calls.
> All work to date is on a single project (Job Ops / Asset-Manager).

## Methodology

Parsed every `*.jsonl` transcript: extracted AI session titles, user prompts
(stripped of IDE/system/hook wrappers), assistant tool calls, and skill
invocations, then bucketed prompts by keyword. Counts below are raw frequencies.

---

## 1. What you do most frequently

### Work themes (by session title weight)
| Theme | Signal | Notes |
|---|---|---|
| Build the chat/AI MVP | highest | Conversational UI, resume skills, streaming |
| Debug AI/chat runtime | high | "Fix chat 500", missing skill file, prompt assembly |
| **Audit + cleanup + maintainability** | high | Two full audit passes, dead-code/redundancy hunts |
| AI config / pipeline restructure | medium | AI metrics, JD-parse integration, model routing |
| Documentation cleanup & sync | medium | Redundant-doc removal, drift correction |

### Prompt keyword frequency (218 prompts)
```
chat_ai      95   skill/plugin/agent  80   audit/review  76
fix/bug      63   test                58   docs          58
plan/phase   57   search/find         54   run/build     53
schema/db    45   cleanup/refactor    35   git           31
commit       21   merge 8   push 8
```

### Tool usage (what the work actually *is*)
```
Read 901  ·  Bash 745  ·  Edit 433  ·  Grep 239  ·  Write 163  ·  Glob 160
TodoWrite 89  ·  Agent 28  ·  AskUserQuestion 25  ·  Skill 20  ·  ToolSearch 19
```

**Read it as:** your dominant loop is **investigate → locate → surgically edit →
verify**. Heavy Read/Grep/Glob (1,300 calls) = lots of code-locating. Heavy
Bash (745) = constant git + verification runs (typecheck/vitest/vite). TodoWrite
(89) = you run multi-phase tasks. You lean on subagents (Agent 28) and structured
decision points (AskUserQuestion 25) for bigger jobs.

**Top recurring friction:** repeated manual verification via raw `node`/`tsc`/
`vitest` (the pnpm/corepack guard bypass), repeated code-location sweeps, and
repeated source↔docs drift fixes.

---

## 2. What should become SKILLS (reusable workflows / knowledge)

Skills = procedures you repeat. Highest-value candidates:

1. **`audit-and-cleanup`** *(strongest signal — done end-to-end twice)*
   Phased codebase audit → findings table (category/files/evidence/risk/fix) →
   Phase 1 mechanical, Phase 2 route/import, Phase 3 redundancy, Phase 4
   architectural. Encodes the exact structure you keep reinventing.
2. **`verify-gate`** — the project's real "done" check: build libs (`tsc --build`),
   per-package `tsc --noEmit`, `vitest` **with `--env-file-if-exists`**, dashboard
   `vite build`. Bakes in the corepack-guard bypass (run tools via `node` directly).
3. **`doc-drift-sync`** — compare source reality vs docs, surface stale claims with
   evidence, produce surgical patches (just executed: test-suite claim, deleted
   endpoints, counts).
4. **`drizzle-curated-push`** — schema changes via idempotent SQL + a `pg` runner
   over Neon/SSL; never `drizzle generate`/`push` (stalls on this DB's drift).

> Several of these already exist as point-in-time **memories**
> (`verify-via-node-direct`, `drizzle-push`). Promote them from memory to a skill
> so they apply automatically, not just when recalled.

---

## 3. What should become PLUGINS (standalone tools)

Plugins = packaged tools you invoke, independent of one repo:

1. **`session-analytics`** — this very task. Scrape `~/.claude/projects`, aggregate
   themes/tools/skills, emit a report. You asked for it ⇒ you want it repeatable.
2. **`verify-gate` runner** — a CLI wrapping the node-direct typecheck+vitest+vite
   sequence (with the env-file flag), so verification is one command in any repo.
3. **`deadcode-scan`** — `knip` pre-tuned for a pnpm monorepo with `@/` alias +
   ignore globs (raw `knip` was unusable here without config).
4. **semble** — already added as an MCP server this session; keep it. It is the
   plugin form of your frequent "where is X / find code" need (Grep 239 + Glob 160).

---

## 4. What should become AGENTS (autonomous subagents)

You already dispatch subagents (Agent 28×) and the caveman investigator/builder
exist. Worth formalizing:

1. **`codebase-auditor`** *(read-only)* — locate dead code, broken routes,
   duplicates; return a severity-tagged findings table. No edits. Mirrors the
   audit work + the existing `cavecrew-investigator`.
2. **`verifier`** — autonomously run the verify-gate, parse output, report
   pass/fail with the failing test names. Removes the manual re-run loop.
3. **`doc-syncer`** — diff source vs a doc set, propose patches, hand back for
   approval. Bounded, parallelizable.
4. **`surgical-fixer`** — bounded 1–2 file edits (rename, typo, single-function
   rewrite). Matches your high Edit/Read ratio + the existing `cavecrew-builder`.

> Pattern: keep auditors/verifiers **read-only**, keep fixers **scope-capped**.
> That matches how you already gate big work behind AskUserQuestion.

---

## 5. What belongs in CLAUDE.md (project-level instructions)

Recurring, project-specific facts that should be standing instructions (some
already added this session):

- **Verification bypass** — pnpm `typecheck`/`test` trip the `preinstall` guard in
  this env; run `tsc`/`vitest` via `node` directly, and pass
  `--env-file-if-exists=../../.env` to vitest. *(Currently only a memory — promote it.)*
- **DB workflow** — never `drizzle generate`/`push`; land schema via curated
  idempotent SQL + a `pg` runner (Neon, SSL).
- **Test commands exist** — Vitest (api-server, `pnpm test`, ~29 files) +
  Playwright E2E (dashboard, `pnpm test:e2e`). *(Fixed in AGENTS/CONVENTIONS this session.)*
- **Live chat AI path** — `resolveChatSystemPrompt` in `lib/chat/resolve-system-prompt.ts`
  is the assembly path; do not bypass. `seedChatRuntime()` runs at server boot.
- **Generated code** — never hand-edit `lib/api-zod/src/generated/` or
  `lib/api-client-react/src/generated/`; regenerate from `openapi.yaml`.
- **Branch reality** — `feat/design-overhaul` deliberately stripped page styling;
  "missing styles" are intentional WIP, not bugs. *(Save future you from "fixing" them.)*

These are already partly captured across CLAUDE.md / AGENTS.md / memories — the gap
is that the verification bypass and DB workflow live in **memory** (recall-only)
rather than CLAUDE.md (always-on).

---

## Bottom line

Your usage is **80% investigate-fix-verify on one AI-heavy app**, with **audit/
cleanup and docs-sync as strong recurring secondary loops**, and a standing
interest in **turning your own workflows into reusable tooling** (skill/plugin/
agent appeared in 80 prompts). The single highest-leverage move: codify the
**verify-gate** + **audit-and-cleanup** workflows (skill or plugin) and promote the
**node-direct verification** + **Drizzle** rules from memory into CLAUDE.md, since
those are the frictions you hit in nearly every session.
