import { db, pool } from "@workspace/db";
import { aiModelConfigsTable } from "@workspace/db";
import { eq, inArray, and } from "drizzle-orm";
import { logger } from "./logger";

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
 * (dash instead of dot — different model endpoint).
 */
const DISALLOWED_PRIMARY_SUBSTRINGS = ["moonshot/", "kimi", "claude-3-5-haiku"];

/**
 * Known wrong model slugs and their canonical replacements.
 *
 * When a row with a bad slug is found AND no row with the canonical slug exists
 * for the same scope, the bad-slug row is renamed in-place (UPDATE model_name)
 * rather than deactivated. This ensures the existing row's metadata (fallback
 * links, cost fields, etc.) is preserved and no orphaned rows accumulate.
 *
 * If the canonical row already exists, the bad-slug row is left for the
 * standard deactivation pass.
 */
const SLUG_CANONICALIZATION: { from: string; to: string }[] = [
  // Early DB rows used a dash slug; the real OpenRouter endpoint uses a dot.
  // Both the bare and provider-prefixed dash variants are covered.
  { from: "claude-3-5-haiku",           to: "anthropic/claude-3.5-haiku" },
  { from: "anthropic/claude-3-5-haiku", to: "anthropic/claude-3.5-haiku" },
];

/**
 * Deduplicates rows with the same (task_scope, model_name) pair and creates
 * the unique index required for atomic upserts. Safe to call on every startup.
 *
 * Deduplication keeps the row with is_active=true, then lowest priority, then
 * lowest id — matching the model-router's selection preference.
 */
export async function ensureModelConfigConstraints(): Promise<void> {
  await pool.query(`
    DELETE FROM ai_model_configs
    WHERE id NOT IN (
      SELECT DISTINCT ON (task_scope, model_name) id
      FROM ai_model_configs
      ORDER BY task_scope, model_name, is_active DESC, priority ASC, id ASC
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ai_model_configs_scope_model_uidx
    ON ai_model_configs (task_scope, model_name)
  `);
}

/**
 * Idempotent model config upsert routine. Call after ensureModelConfigConstraints().
 * Safe to call on every startup and immediately after a data reset.
 *
 * For each managed scope:
 *  1. Canonicalizes rows with known bad model slugs — renames model_name in-place
 *     to the canonical value when no canonical row already exists for the scope.
 *  2. Deactivates rows with disallowed model names and competing active roots.
 *  3. Upserts the required primary via INSERT … ON CONFLICT (task_scope, model_name)
 *     DO UPDATE — atomically ensures the row exists, is active, and has correct priority.
 *  4. For scopes in SCOPES_REQUIRING_FALLBACK: upserts the gpt-4o-mini fallback
 *     node and wires the primary's fallbackModelId to it.
 */
export async function seedModelConfigs() {
  for (const config of REQUIRED_PRIMARIES) {
    const needsFallback = SCOPES_REQUIRING_FALLBACK.has(config.taskScope);

    // Step 1: canonicalize known bad slugs before any other processing.
    // If a row with the bad slug exists AND no canonical row exists for this scope,
    // rename the bad-slug row to the canonical name so it gets activated below
    // rather than being inserted as a brand-new duplicate row.
    for (const { from: badSlug, to: canonical } of SLUG_CANONICALIZATION) {
      const [badRow] = await db
        .select({ id: aiModelConfigsTable.id })
        .from(aiModelConfigsTable)
        .where(
          and(
            eq(aiModelConfigsTable.taskScope, config.taskScope),
            eq(aiModelConfigsTable.modelName, badSlug),
          ),
        )
        .limit(1);

      if (!badRow) continue;

      const [canonicalRow] = await db
        .select({ id: aiModelConfigsTable.id })
        .from(aiModelConfigsTable)
        .where(
          and(
            eq(aiModelConfigsTable.taskScope, config.taskScope),
            eq(aiModelConfigsTable.modelName, canonical),
          ),
        )
        .limit(1);

      if (!canonicalRow) {
        // No canonical row yet — rename bad slug row to canonical in-place.
        // Mark inactive so the upsert in step 3 activates it with correct settings.
        await db
          .update(aiModelConfigsTable)
          .set({ modelName: canonical, isActive: false })
          .where(eq(aiModelConfigsTable.id, badRow.id));
        logger.info(
          { taskScope: config.taskScope, from: badSlug, to: canonical, id: badRow.id },
          "Canonicalized model_name slug in-place",
        );
      }
      // If canonical already exists, the bad-slug row will be caught by
      // the deactivation pass in step 2.
    }

    // Step 2: load all rows for this scope (after potential rename above).
    const allRows = await db
      .select()
      .from(aiModelConfigsTable)
      .where(eq(aiModelConfigsTable.taskScope, config.taskScope));

    const activeRows = allRows.filter((r) => r.isActive);

    // Step 3: deactivate disallowed rows and competing active roots.
    // Keep: the required primary model, and (for fallback scopes) the fallback model.
    const toDeactivate = activeRows.filter((r) => {
      if (DISALLOWED_PRIMARY_SUBSTRINGS.some((sub) => r.modelName.includes(sub))) return true;
      if (r.modelName === config.modelName) return false;
      if (needsFallback && r.modelName === REQUIRED_FALLBACK_MODEL) return false;
      return true;
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

    // Step 4: upsert required primary.
    // INSERT … ON CONFLICT (task_scope, model_name) DO UPDATE ensures the row
    // is active with the correct priority whether it pre-existed or is brand-new.
    const [primary] = await db
      .insert(aiModelConfigsTable)
      .values({
        taskScope: config.taskScope,
        provider: config.provider,
        modelName: config.modelName,
        isActive: true,
        priority: config.priority,
        extraConfig: {},
      })
      .onConflictDoUpdate({
        target: [aiModelConfigsTable.taskScope, aiModelConfigsTable.modelName],
        set: {
          isActive: true,
          priority: config.priority,
          provider: config.provider,
        },
      })
      .returning({ id: aiModelConfigsTable.id });

    const primaryId = primary!.id;
    logger.info(
      { taskScope: config.taskScope, modelName: config.modelName, id: primaryId },
      "Upserted required model config",
    );

    if (!needsFallback) continue;

    // Step 5: upsert fallback node — must be active for resolveModelChain to traverse it.
    const [fallback] = await db
      .insert(aiModelConfigsTable)
      .values({
        taskScope: config.taskScope,
        provider: "openrouter",
        modelName: REQUIRED_FALLBACK_MODEL,
        isActive: true,
        priority: 90,
        extraConfig: {},
      })
      .onConflictDoUpdate({
        target: [aiModelConfigsTable.taskScope, aiModelConfigsTable.modelName],
        set: {
          isActive: true,
          priority: 90,
        },
      })
      .returning({ id: aiModelConfigsTable.id });

    const fallbackId = fallback!.id;
    logger.info(
      { taskScope: config.taskScope, modelName: REQUIRED_FALLBACK_MODEL, id: fallbackId },
      "Upserted fallback model node",
    );

    // Step 6: wire (or re-wire) primary -> fallback, even if previously linked elsewhere.
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
