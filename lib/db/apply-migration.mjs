import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const sql = readFileSync(join(__dirname, "runtime-compat.sql"), "utf-8");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

console.log("Applying runtime compatibility patch...");

try {
  await pool.query(sql);
  console.log("Runtime compatibility patch applied successfully.");
} catch (err) {
  console.error("Migration error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
} finally {
  await pool.end();
}
