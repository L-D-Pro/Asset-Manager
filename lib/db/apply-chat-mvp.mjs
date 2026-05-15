#!/usr/bin/env node
// Apply lib/db/migrations/chat-mvp.sql against $DATABASE_URL.
//
// Usage:
//   node --env-file=.env lib/db/apply-chat-mvp.mjs
//
// Why this exists: the canonical `pnpm --filter @workspace/db run push` was
// blocked on an unrelated interactive prompt (user_stats_user_id_unique drift)
// when the chat MVP landed, and Windows doesn't ship with psql. This is a
// minimal Node runner that uses the workspace's existing `pg` dependency to
// run the curated chat-mvp SQL file inside a single transaction.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Did you forget `node --env-file=.env`?");
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
const sqlPath = join(here, "migrations", "chat-mvp.sql");
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(process.env.DATABASE_URL),
});

try {
  await client.connect();
  console.log(`Connected. Applying ${sqlPath}…`);
  await client.query(sql);
  console.log("✓ chat-mvp migration applied successfully");
} catch (err) {
  console.error("✗ Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
