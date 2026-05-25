import app from "./app";
import { logger } from "./lib/logger";
import { db, pool } from "@workspace/db";
import { adminUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { ensureModelConfigConstraints, seedModelConfigs } from "./lib/seed-model-configs";
import { seedChatRuntime } from "./lib/chat/seed";
import { checkModelConfigHealth } from "./lib/model-config-health";

const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function runConfigHealthCheck(context: "startup" | "periodic") {
  try {
    const report = await checkModelConfigHealth();
    if (!report.healthy) {
      logger.error(
        { unhealthyScopes: report.unhealthyScopes, checkedAt: report.checkedAt },
        `[${context}] Model config health check FAILED — unhealthy scopes detected`,
      );
    } else {
      logger.info(
        { checkedAt: report.checkedAt },
        `[${context}] Model config health check passed`,
      );
    }
  } catch (err) {
    logger.error({ err }, `[${context}] Model config health check threw an unexpected error`);
  }
}

/**
 * API server entry point.
 *
 * Reads the `PORT` environment variable and starts the Express HTTP server.
 * Throws immediately on startup if `PORT` is absent or not a positive integer.
 *
 * Also runs a one-time admin user bootstrap if:
 *  - No admin user exists in the database, AND
 *  - ADMIN_USERNAME + ADMIN_PASSWORD environment variables are set.
 *
 * This lets you create the initial account on first deploy without running
 * a separate CLI script.
 */

/**
 * Bootstrap the admin user if none exists.
 * Reads ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL from environment.
 * Safe to call on every startup — exits silently if user already exists.
 */
async function bootstrapAdminUser() {
  const existing = await db.select({ id: adminUsersTable.id }).from(adminUsersTable).limit(1);
  if (existing.length > 0) return; // Already set up

  const username = (process.env.ADMIN_USERNAME ?? "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const email = process.env.ADMIN_EMAIL ?? "admin@localhost";

  if (!username || !password) {
    logger.warn(
      "No admin user found. Set ADMIN_USERNAME and ADMIN_PASSWORD environment variables " +
      "to auto-create one on next startup."
    );
    return;
  }

  if (password.length < 12) {
    logger.error("ADMIN_PASSWORD must be at least 12 characters. Admin user NOT created.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(adminUsersTable).values({ username, email, passwordHash, role: "admin" });
  logger.info({ username, email }, "Admin user created from environment variables.");
  logger.warn(
    "Remove ADMIN_USERNAME and ADMIN_PASSWORD from environment after first login for security."
  );
}

async function ensureSessionTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  `);
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  await ensureSessionTable();
  await bootstrapAdminUser();
  await ensureModelConfigConstraints();
  await seedModelConfigs();
  await seedChatRuntime();

  await runConfigHealthCheck("startup");

  const healthInterval = setInterval(() => {
    runConfigHealthCheck("periodic");
  }, HEALTH_CHECK_INTERVAL_MS);
  healthInterval.unref();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "Server startup failed");
  process.exit(1);
});
