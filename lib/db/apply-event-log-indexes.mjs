#!/usr/bin/env node
// Apply lib/db/migrations/event-log-indexes.sql against $DATABASE_URL.
//
// Usage:
//   node --env-file=.env lib/db/apply-event-log-indexes.mjs
//
// Phase 10: adds compound indexes on event_logs for cursor-based pagination
// and per-user filtering. All statements are idempotent (IF NOT EXISTS).

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
const sqlPath = join(here, "migrations", "event-log-indexes.sql");
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(process.env.DATABASE_URL),
});

try {
  await client.connect();
  console.log(`Connected. Applying ${sqlPath}…`);
  await client.query(sql);
  console.log("✓ event-log-indexes migration applied successfully");
} catch (err) {
  console.error("✗ Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
