#!/usr/bin/env node

import pg from "pg";

const { Pool } = pg;
const ALLOWED_LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const FORBIDDEN_DATABASE_NAMES = new Set(["postgres", "template0", "template1"]);

function fail(message) {
  console.error(`reset-dev-db: ${message}`);
  process.exit(1);
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function parseDatabaseUrl(rawUrl, sourceLabel) {
  if (!rawUrl) {
    fail(`${sourceLabel} is required.`);
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    fail(`${sourceLabel} is not a valid postgres connection string.`);
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    fail(`${sourceLabel} must use the postgres/postgresql protocol.`);
  }

  if (!ALLOWED_LOCAL_HOSTS.has(url.hostname)) {
    fail(
      `Refusing to reset non-local database host "${url.hostname}" from ${sourceLabel}. Use localhost, 127.0.0.1, or ::1 only.`,
    );
  }

  const databaseName = url.pathname.replace(/^\//, "");
  if (!databaseName) {
    fail(`${sourceLabel} must include a database name.`);
  }

  if (FORBIDDEN_DATABASE_NAMES.has(databaseName)) {
    fail(
      `${sourceLabel} points to reserved database "${databaseName}", which reset-dev-db.mjs will not drop. Use a dedicated local development database name such as "jobops_dev" or "asset_manager_dev".`,
    );
  }

  return { url, databaseName };
}

function parseArgs(argv) {
  return {
    allowDatabaseUrl: argv.includes("--allow-database-url"),
  };
}

function resolveResetConnectionString(allowDatabaseUrl) {
  if (process.env.LOCAL_DATABASE_URL) {
    return {
      rawUrl: process.env.LOCAL_DATABASE_URL,
      sourceLabel: "LOCAL_DATABASE_URL",
    };
  }

  if (!allowDatabaseUrl) {
    fail(
      "LOCAL_DATABASE_URL is required for destructive local resets. DATABASE_URL is ignored unless you pass --allow-database-url.",
    );
  }

  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL is required when using --allow-database-url.");
  }

  return {
    rawUrl: process.env.DATABASE_URL,
    sourceLabel: "DATABASE_URL",
  };
}

async function main() {
  const { allowDatabaseUrl } = parseArgs(process.argv.slice(2));
  const { rawUrl, sourceLabel } = resolveResetConnectionString(allowDatabaseUrl);
  const { url, databaseName } = parseDatabaseUrl(rawUrl, sourceLabel);
  const maintenanceDb =
    process.env.DEV_DB_RESET_MAINTENANCE_DB ??
    "postgres";

  const maintenanceUrl = new URL(url.toString());
  maintenanceUrl.pathname = `/${maintenanceDb}`;

  const pool = new Pool({
    connectionString: maintenanceUrl.toString(),
    ssl: false,
  });

  try {
    await pool.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
      [databaseName],
    );
    await pool.query(`drop database if exists ${quoteIdentifier(databaseName)}`);
    await pool.query(`create database ${quoteIdentifier(databaseName)}`);
    console.log(`reset-dev-db: recreated local database "${databaseName}" from ${sourceLabel}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
