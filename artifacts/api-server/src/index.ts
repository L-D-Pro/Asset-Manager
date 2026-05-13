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
 * Priority 1 = highest priority (lowest number wins in model-router).
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
 * For these scopes, wire a DB-level gpt-4o-mini fallback node from the primary.
 * resolveModelChain (ai-client.ts) walks the fallbackModelId chain on API failure,
 * querying isActive=true — so the fallback node must be active.
 */
const REQUIRED_FALLBACK_MODEL = "openai/gpt-4o-mini";
const SCOPES_REQUIRING_FALLBACK = new Set(["resume_tailoring", "cover_letter"]);

/**
 * Model name substrings that must never be an active primary for managed scopes.
 * Kimi/moonshot caused 45-second hangs; claude-3-5-haiku is the wrong slug
 * (dash instead of dot — different model endpoint, deactivated in original DB fix).
 */
const DISALLOWED_PRIMARY_SUBSTRINGS = ["moonshot/", "kimi", "claude-3-5-haiku"];

/**
 * Idempotent model config repair routine. Runs on every startup.
 *
 * For each managed scope:
 *  1. Deactivates active rows with disallowed model names OR that are competing
 *     active roots not needed for the scope (ensures deterministic primary selection).
 *  2. Ensures the required primary is active with the correct priority (re-activates
 *     an existing inactive row, or inserts a new one; normalises priority if drifted).
 *  3. For scopes in SCOPES_REQUIRING_FALLBACK: ensures a gpt-4o-mini fallback node
 *     exists as an ACTIVE row (resolveModelChain requires isActive=true to traverse)
 *     with priority=90 (never wins primary selection), and always wires the primary's
 *     fallbackModelId to it — even if previously linked to something else.
 *
 * Safe to call on every startup — all operations are conditional.
 */
async function seedModelConfigs() {
  for (const config of REQUIRED_PRIMARIES) {
    const needsFallback = SCOPES_REQUIRING_FALLBACK.has(config.taskScope);

    // Step 1: load all rows for this scope
    const allRows = await db
      .select()
      .from(aiModelConfigsTable)
      .where(eq(aiModelConfigsTable.taskScope, config.taskScope));

    const activeRows = allRows.filter((r) => r.isActive);

    // Step 2: deactivate disallowed rows and competing active roots
    // Keep: the required primary model, and (for scopes needing fallback) the fallback model.
    // Deactivate everything else that is currently active.
    const toDeactivate = activeRows.filter((r) => {
      if (DISALLOWED_PRIMARY_SUBSTRINGS.some((sub) => r.modelName.includes(sub))) return true;
      if (r.modelName === config.modelName) return false;
      if (needsFallback && r.modelName === REQUIRED_FALLBACK_MODEL) return false;
      return true; // competing active root — demote it
    });

    if (toDeactivate.length > 0) {
      await db
        .update(aiModelConfigsTable)
        .set({ isActive: false })
        .where(inArray(aiModelConfigsTable.id, toDeactivate.map((r) => r.id)));
      for (const row of toDeactivate) {
        logger.info(
          { id: row.id, modelName: row.modelName, taskScope: config.taskScope },
          "Deactivated competing/disallowed model config",
        );
      }
    }

    // Step 3: ensure required primary is active with correct priority
    const requiredActive = activeRows.find(
      (r) => r.modelName === config.modelName && !toDeactivate.includes(r),
    );

    let primaryId: number;

    if (requiredActive) {
      // Normalise priority even when the row was already active (may have drifted)
      if (requiredActive.priority !== config.priority) {
        await db
          .update(aiModelConfigsTable)
          .set({ priority: config.priority })
          .where(eq(aiModelConfigsTable.id, requiredActive.id));
        logger.info(
          { id: requiredActive.id, taskScope: config.taskScope, priority: config.priority },
          "Normalised primary model priority",
        );
      }
      primaryId = requiredActive.id;
    } else {
      const existingRow = allRows.find((r) => r.modelName === config.modelName);

      if (existingRow) {
        await db
          .update(aiModelConfigsTable)
          .set({ isActive: true, priority: config.priority })
          .where(eq(aiModelConfigsTable.id, existingRow.id));
        primaryId = existingRow.id;
        logger.info(
          { taskScope: config.taskScope, modelName: config.modelName, id: existingRow.id },
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

    // Step 4: enforce active fallback chain for critical scopes
    if (!needsFallback) continue;

    // resolveModelChain (ai-client.ts line ~630) queries AND isActive=true on each
    // fallback hop — the node MUST be active or the chain silently breaks.
    const existingFallback = allRows.find((r) => r.modelName === REQUIRED_FALLBACK_MODEL);
    let fallbackId: number;

    if (existingFallback) {
      // Ensure it is active and not erroneously set as a primary competitor (priority must be high)
      const needsRepair = !existingFallback.isActive || existingFallback.priority < 50;
      if (needsRepair) {
        await db
          .update(aiModelConfigsTable)
          .set({ isActive: true, priority: 90 })
          .where(eq(aiModelConfigsTable.id, existingFallback.id));
        logger.info(
          { id: existingFallback.id, taskScope: config.taskScope },
          "Repaired fallback model node (was inactive or low priority)",
        );
      }
      fallbackId = existingFallback.id;
    } else {
      const [fb] = await db
        .insert(aiModelConfigsTable)
        .values({
          taskScope: config.taskScope,
          provider: "openrouter",
          modelName: REQUIRED_FALLBACK_MODEL,
          isActive: true,  // must be active — resolveModelChain requires isActive=true on each hop
          priority: 90,    // high number keeps it out of primary selection (model-router picks lowest)
          extraConfig: {},
        })
        .returning({ id: aiModelConfigsTable.id });
      fallbackId = fb!.id;
      logger.info(
        { taskScope: config.taskScope, modelName: REQUIRED_FALLBACK_MODEL, id: fallbackId },
        "Inserted active fallback model node",
      );
    }

    // Always wire (or re-wire) primary -> fallback, even if previously linked elsewhere
    const [currentPrimary] = await db
      .select({ fallbackModelId: aiModelConfigsTable.fallbackModelId })
      .from(aiModelConfigsTable)
      .where(eq(aiModelConfigsTable.id, primaryId));

    if (currentPrimary?.fallbackModelId !== fallbackId) {
      await db
        .update(aiModelConfigsTable)
        .set({ fallbackModelId: fallbackId })
        .where(eq(aiModelConfigsTable.id, primaryId));
      logger.info(
        { taskScope: config.taskScope, primaryId, fallbackId, fallbackModel: REQUIRED_FALLBACK_MODEL },
        "Wired fallback chain for scope",
      );
    }
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
