---
name: verify-gate
description: Use before claiming any change is done, fixed, or passing in the Asset-Manager repo — runs the project's real verification sequence (typecheck + vitest + dashboard build) via the node-direct bypass that avoids the corepack preinstall guard. Evidence before assertions.
---

The repo's "done" gate. `pnpm run typecheck`/`test` trip the `preinstall` guard
under this machine's corepack — call tools directly via `node`. Run from repo root.

## Sequence (run in order; stop at first failure)

1. **Build libs** (always first — downstream typechecks depend on built libs):
   `node ./node_modules/typescript/bin/tsc --build`
2. **Typecheck api-server:**
   `cd artifacts/api-server && node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`
3. **Typecheck dashboard:**
   `cd artifacts/dashboard && node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`
4. **Tests (api-server vitest):**
   ```
   cd artifacts/api-server
   VITEST=$(node -e "console.log(require.resolve('vitest/package.json').replace(/package.json$/,'vitest.mjs'))")
   node --env-file-if-exists=../../.env "$VITEST" run --reporter=dot
   ```
   The `--env-file-if-exists=../../.env` flag is **required** — without it, env-coupled
   modules throw at import and the suite reports false failures. Baseline = all green.
5. **Dashboard bundle (catches bundler-resolution breaks tsc misses):**
   `cd artifacts/dashboard && node ./node_modules/vite/bin/vite.js build`

## Rules

- Report actual output. If a step fails, quote the failing test/error — do not claim pass.
- A vitest "failure" with no `.env` is almost always the env-coupling artifact, not a real break. Re-run with the flag before reporting.
- Tooltip/select sourcemap warnings in the vite build are pre-existing cosmetics, not errors — build exit 0 is the signal.
- Capture a baseline (run before your change) so you can attribute any new failure.
