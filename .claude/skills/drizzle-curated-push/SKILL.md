---
name: drizzle-curated-push
description: Use when changing the Drizzle schema or applying a DB migration in the Asset-Manager repo. This DB cannot use drizzle push/generate (stalls on pre-existing drift) — land changes via a curated idempotent SQL file applied with a pg runner over Neon (SSL).
---

How schema changes reach this DB. **Never** `drizzle generate` or `drizzle push` —
`push` stalls on a pre-existing interactive drift prompt (e.g. `user_stats_user_id_unique`).

## Workflow
1. **Edit the Drizzle schema** under `lib/db/src/schema/` (source of truth for types) and
   export from `lib/db/src/schema/index.ts`.
2. **Write a curated, idempotent SQL migration** in `lib/db/migrations/<name>.sql`:
   - Additive + safe: `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`,
     `DROP CONSTRAINT IF EXISTS` before re-add, `CREATE INDEX IF NOT EXISTS`.
   - Wrap in `BEGIN; ... COMMIT;`. Safe to re-run.
   - Header comment: why hand-curated + the apply command.
3. **Apply with a `pg` runner** (`lib/db/apply-*.mjs` pattern): connect with
   `connectionString: DATABASE_URL`, resolve SSL from `?sslmode=` (Neon needs
   `{ rejectUnauthorized: false }` for `require`). Run: `node --env-file=../../.env lib/db/apply-<name>.mjs`.
4. **Verify types** with [verify-gate] (tsc --build picks up the schema change).

## Rules
- Idempotent always — these run against a live DB and may be re-applied.
- Schema TS + SQL must agree; the SQL is what actually mutates the DB, the TS gives Drizzle its types.
- Runtime seeds/migrations that must run every boot belong in `seedChatRuntime()`-style boot hooks, not one-shot scripts.
