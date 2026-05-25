#!/usr/bin/env node
// Apply lib/db/migrations/skill-routing.sql against $DATABASE_URL.
//
// Usage (from lib/db):
//   node --env-file=../../.env apply-skill-routing.mjs
//
// Why this exists: `pnpm --filter @workspace/db run push` stalls on this DB's
// pre-existing interactive drift prompt (user_stats_user_id_unique), so the
// skill-routing schema is landed via a curated SQL file using the workspace's
// existing `pg` dependency — mirrors apply-chat-mvp.mjs.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Did you forget `node --env-file=../../.env`?");
  process.exit(1);
}

function resolveSsl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    const mode = url.searchParams.get("sslmode")?.toLowerCase();
    if (mode === "require") return { rejectUnauthorized: false };
    if (mode === "verify-ca" || mode === "verify-full") return { rejectUnauthorized: true };
    return undefined;
  } catch {
    return undefined;
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(here, "migrations", "skill-routing.sql");
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(process.env.DATABASE_URL),
});

try {
  await client.connect();
  console.log(`Connected. Applying ${sqlPath}…`);
  await client.query(sql);
  console.log("✓ skill-routing migration applied successfully");
} catch (err) {
  console.error("✗ Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
