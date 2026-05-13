import app from "./app";
import { logger } from "./lib/logger";
import { db, pool } from "@workspace/db";
import { adminUsersTable, aiModelConfigsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

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

/**
 * Required primary model per managed task scope.
 * Priority 1 = highest priority (lowest number wins).
 */
const REQUIRED_PRIMARIES: Array<{
  taskScope: string;
  modelName: string;
  provider: string;
  priority: number;
}> = [
  { taskScope: "resume_tailoring", modelName: "anthropic/claude-3.5-haiku", provider: "openrouter", priority: 1 },
  { taskScope: "cover_letter",     modelName: "anthropic/claude-3.5-haiku", provider: "openrouter", priority: 1 },
  { taskScope: "claim_generation", modelName: "anthropic/claude-3.5-haiku", provider: "openrouter", priority: 1 },
  { taskScope: "jd_parsing",       modelName: "anthropic/claude-3.5-haiku", provider: "openrouter", priority: 1 },
  { taskScope: "default",          modelName: "anthropic/claude-3.5-haiku", provider: "openrouter", priority: 1 },
];

/**
 * For these scopes, enforce a DB-level fallback row (gpt-4o-mini) linked from the primary.
 * callAI walks the fallbackModelId chain on model failure.
 */
const REQUIRED_FALLBACK_MODEL = "openai/gpt-4o-mini";
const SCOPES_REQUIRING_FALLBACK = new Set(["resume_tailoring", "cover_letter"]);

/**
 * Model name substrings that must not be an active primary for managed scopes.
 * Kimi/moonshot was previously (mis-)seeded and caused 45-second hangs.
 */
const DISALLOWED_PRIMARY_SUBSTRINGS = ["moonshot/", "kimi", "claude-3-5-haiku"]; // claude-3-5-haiku is the wrong slug (should be claude-3.5-haiku)

/**
 * Idempotent model config repair routine. Runs on every startup.
 *
 * For each managed scope it:
 *  1. Deactivates active rows whose modelName matches a disallowed pattern.
 *  2. Ensures an active row with the required model exists (re-activates an
 *     existing inactive row, or inserts a new one).
 *  3. For scopes in SCOPES_REQUIRING_FALLBACK: ensures a gpt-4o-mini fallback
 *     row exists and links it from the primary via fallbackModelId.
 *
 * Safe to call on every startup — all operations are conditional.
 */
async function seedModelConfigs() {
  for (const config of REQUIRED_PRIMARIES) {
    // ── 1. Load all rows for this scope ────────────────────────────────────
    const allRows = await db
      .select()
      .from(aiModelConfigsTable)
      .where(eq(aiModelConfigsTable.taskScope, config.taskScope));

    const activeRows = allRows.filter((r) => r.isActive);
    const disallowedActive = activeRows.filter((r) =>
      DISALLOWED_PRIMARY_SUBSTRINGS.some((sub) => r.modelName.includes(sub)),
    );

    // ── 2. Deactivate disallowed active primaries ───────────────────────────
    if (disallowedActive.length > 0) {
      await db
        .update(aiModelConfigsTable)
        .set({ isActive: false })
        .where(inArray(aiModelConfigsTable.id, disallowedActive.map((r) => r.id)));
      for (const row of disallowedActive) {
        logger.info(
          { id: row.id, modelName: row.modelName, taskScope: config.taskScope },
          "Deactivated disallowed model config",
        );
      }
    }

    // ── 3. Ensure correct primary is active ────────────────────────────────
    const requiredActive = activeRows.find(
      (r) =>
        r.modelName === config.modelName &&
        !DISALLOWED_PRIMARY_SUBSTRINGS.some((sub) => r.modelName.includes(sub)),
    );

    let primaryId: number;

    if (requiredActive) {
      primaryId = requiredActive.id;
    } else {
      // Check for an existing (possibly inactive) row with the correct model
      const existingInactive = allRows.find(
        (r) =>
          r.modelName === config.modelName &&
          !DISALLOWED_PRIMARY_SUBSTRINGS.some((sub) => r.modelName.includes(sub)),
      );

      if (existingInactive) {
        await db
          .update(aiModelConfigsTable)
          .set({ isActive: true, priority: config.priority })
          .where(eq(aiModelConfigsTable.id, existingInactive.id));
        primaryId = existingInactive.id;
        logger.info(
          { taskScope: config.taskScope, modelName: config.modelName, id: existingInactive.id },
          "Re-activated required model config",
        );
      } else {
        const [inserted] = await db
          .insert(aiModelConfigsTable)
          .values({
            taskScope: config.taskScope,
            provider: config.provider,
            modelName: config.modelName,
            isActive: true,
            priority: config.priority,
            extraConfig: {},
          })
          .returning({ id: aiModelConfigsTable.id });
        primaryId = inserted!.id;
        logger.info(
          { taskScope: config.taskScope, modelName: config.modelName, id: primaryId },
          "Seeded missing model config",
        );
      }
    }

    // ── 4. Enforce fallback chain for critical scopes ───────────────────────
    if (!SCOPES_REQUIRING_FALLBACK.has(config.taskScope)) continue;

    // Re-fetch the primary row to get its current fallbackModelId
    const [primaryRow] = await db
      .select()
      .from(aiModelConfigsTable)
      .where(eq(aiModelConfigsTable.id, primaryId));

    if (!primaryRow || primaryRow.fallbackModelId != null) continue; // already linked

    // Find or create the fallback node (inactive — it's a chain target, not a direct primary)
    const reloadedAll = await db
      .select()
      .from(aiModelConfigsTable)
      .where(eq(aiModelConfigsTable.taskScope, config.taskScope));

    const existingFallback = reloadedAll.find((r) => r.modelName === REQUIRED_FALLBACK_MODEL);

    let fallbackId: number;

    if (existingFallback) {
      fallbackId = existingFallback.id;
    } else {
      const [fb] = await db
        .insert(aiModelConfigsTable)
        .values({
          taskScope: config.taskScope,
          provider: "openrouter",
          modelName: REQUIRED_FALLBACK_MODEL,
          isActive: false, // fallback node only — not a candidate primary
          priority: 90,
          extraConfig: {},
        })
        .returning({ id: aiModelConfigsTable.id });
      fallbackId = fb!.id;
      logger.info(
        { taskScope: config.taskScope, modelName: REQUIRED_FALLBACK_MODEL, id: fallbackId },
        "Inserted fallback model node",
      );
    }

    await db
      .update(aiModelConfigsTable)
      .set({ fallbackModelId: fallbackId })
      .where(eq(aiModelConfigsTable.id, primaryId));

    logger.info(
      { taskScope: config.taskScope, primaryId, fallbackId, fallbackModel: REQUIRED_FALLBACK_MODEL },
      "Linked fallback chain for scope",
    );
  }
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
  await seedModelConfigs();

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
