import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function resolveSslConfig(databaseUrl: string): false | { rejectUnauthorized: boolean } | undefined {
  try {
    const url = new URL(databaseUrl);
    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
    const sslParam = url.searchParams.get("ssl")?.toLowerCase();

    // Common hosted Postgres URLs use `?sslmode=require` (Neon, Supabase, etc.).
    // node-postgres doesn't always infer this, so we map it explicitly.
    const wantsSsl =
      sslParam === "true" ||
      sslMode === "require" ||
      sslMode === "verify-ca" ||
      sslMode === "verify-full";

    if (!wantsSsl) return undefined;

    const strict =
      sslMode === "verify-ca" ||
      sslMode === "verify-full";

    return { rejectUnauthorized: strict };
  } catch {
    return undefined;
  }
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSslConfig(process.env.DATABASE_URL),
  connectionTimeoutMillis: 10_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
