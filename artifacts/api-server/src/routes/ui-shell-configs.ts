import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, adminUsersTable } from "@workspace/db";
import { uiShellConfigsTable } from "../../../../lib/db/src/schema/ui-shell-configs";
import { z } from "zod";
import type { JobOpsRequest } from "../lib/http-types";

const router: IRouter = Router();

const paramsSchema = z.object({ appKey: z.string().min(1) });
const slotItemSchema = z.object({
  id: z.string().min(1),
  componentKey: z.string().min(1),
  order: z.number().int().nonnegative(),
  visibility: z.boolean(),
  label: z.string().min(1),
  locked: z.boolean().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
});
const uiConfigSchema = z.object({
  version: z.literal(1),
  appKey: z.string().min(1),
  themeID: z.string().min(1),
  slots: z.object({
    navbar: z.array(slotItemSchema),
    sidebar: z.array(slotItemSchema),
    dashboardGrid: z.array(slotItemSchema),
  }),
  updatedAt: z.string().min(1),
  updatedBy: z.number().nullable(),
});
const themeDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mode: z.enum(["light", "dark"]),
  palette: z.object({
    bgPrimary: z.string().min(1),
    bgGlass: z.string().min(1),
    textMain: z.string().min(1),
    textSubtle: z.string().optional(),
    brandPrimary: z.string().min(1),
    brandAccent: z.string().optional(),
    borderSubtle: z.string().optional(),
    borderStrong: z.string().optional(),
  }),
});
const upsertBodySchema = z.object({
  themeID: z.string().min(1),
  themeDefinitions: z.array(themeDefinitionSchema),
  uiConfig: uiConfigSchema,
});

type UiConfigInput = z.infer<typeof uiConfigSchema>;
type UiSlotsInput = UiConfigInput["slots"];
type PgLikeError = { code?: string; message?: string };
let schemaEnsured = false;

function ensureAuthenticated(req: JobOpsRequest): number | null {
  return (req.session as { adminId?: number }).adminId ?? null;
}

async function requireAdmin(
  req: JobOpsRequest,
  res: import("express").Response,
  next: import("express").NextFunction,
): Promise<void> {
  const adminId = ensureAuthenticated(req);
  if (!adminId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const user = await db.query.adminUsersTable.findFirst({
    where: eq(adminUsersTable.id, adminId),
  });
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

function validateSlot(slots: UiSlotsInput): string | null {
  const keys: Array<keyof UiSlotsInput> = [
    "navbar",
    "sidebar",
    "dashboardGrid",
  ];

  for (const key of keys) {
    const seen = new Set<string>();
    for (const item of slots[key]) {
      if (seen.has(item.id)) {
        return `Duplicate item id "${item.id}" in slot "${key}"`;
      }
      seen.add(item.id);
    }
  }
  return null;
}

function normalizeUiConfig(
  appKey: string,
  adminId: number | null,
  payload: UiConfigInput,
): UiConfigInput {
  return {
    ...payload,
    appKey,
    updatedBy: adminId,
    updatedAt: new Date().toISOString(),
  };
}

function buildFallbackUiConfig(appKey: string, themeID: string, adminId: number | null): UiConfigInput {
  return normalizeUiConfig(appKey, adminId, {
    version: 1,
    appKey,
    themeID,
    slots: {
      navbar: [],
      sidebar: [],
      dashboardGrid: [],
    },
    updatedAt: new Date().toISOString(),
    updatedBy: adminId,
  });
}

function toRouteErrorMessage(error: unknown): string {
  const pgError = error as PgLikeError;
  if (pgError?.code === "42P01") {
    return "UI shell table missing. Run DB compat migration (corepack pnpm --filter @workspace/db run compat).";
  }
  if (pgError?.code === "42703") {
    return "UI shell schema is out of date. Run DB compat migration (corepack pnpm --filter @workspace/db run compat).";
  }
  return pgError?.message ?? "Unexpected UI shell config error.";
}

async function ensureUiShellSchema(): Promise<void> {
  if (schemaEnsured) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ui_shell_configs (
      id SERIAL PRIMARY KEY,
      app_key TEXT NOT NULL UNIQUE,
      theme_id TEXT NOT NULL,
      theme_definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
      ui_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_by_admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.execute(sql`
    ALTER TABLE ui_shell_configs
      ADD COLUMN IF NOT EXISTS theme_id TEXT,
      ADD COLUMN IF NOT EXISTS theme_definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS ui_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS updated_by_admin_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL;
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS ui_shell_configs_app_key_unique
      ON ui_shell_configs(app_key);
  `);

  schemaEnsured = true;
}

router.get(
  "/admin/ui-shell-configs/:appKey",
  async (req, res): Promise<void> => {
    try {
      await ensureUiShellSchema();
      const adminId = ensureAuthenticated(req);
      if (!adminId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const params = paramsSchema.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      const [row] = await db
        .select()
        .from(uiShellConfigsTable)
        .where(eq(uiShellConfigsTable.appKey, params.data.appKey))
        .limit(1);

      if (!row) {
        res.status(404).json({ error: "UI shell config not found" });
        return;
      }

      const safeThemeID =
        typeof row.themeID === "string" && row.themeID.length > 0
          ? row.themeID
          : "higo-pastel-02";
      const parsedThemes = z.array(themeDefinitionSchema).safeParse(row.themeDefinitions);
      const parsedUiConfig = uiConfigSchema.safeParse(row.uiConfig);
      const safeUiConfig = parsedUiConfig.success
        ? parsedUiConfig.data
        : buildFallbackUiConfig(
            params.data.appKey,
            safeThemeID,
            row.updatedByAdminId ?? null,
          );

      res.json({
        ...row,
        themeID: safeThemeID,
        themeDefinitions: parsedThemes.success ? parsedThemes.data : [],
        uiConfig: safeUiConfig,
      });
    } catch (error) {
      res.status(500).json({ error: toRouteErrorMessage(error) });
    }
  },
);

router.put(
  "/admin/ui-shell-configs/:appKey",
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      await ensureUiShellSchema();
      const params = paramsSchema.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      const parsed = upsertBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const slotError = validateSlot(parsed.data.uiConfig.slots);
      if (slotError) {
        res.status(400).json({ error: slotError });
        return;
      }

      const adminId = (req.session as { adminId?: number }).adminId ?? null;
      const uiConfig = normalizeUiConfig(
        params.data.appKey,
        adminId,
        parsed.data.uiConfig,
      );
      const existing = await db
        .select()
        .from(uiShellConfigsTable)
        .where(eq(uiShellConfigsTable.appKey, params.data.appKey))
        .limit(1);

      if (existing.length === 0) {
        const [created] = await db
          .insert(uiShellConfigsTable)
          .values({
            appKey: params.data.appKey,
            themeID: parsed.data.themeID,
            themeDefinitions: parsed.data.themeDefinitions,
            uiConfig,
            updatedByAdminId: adminId,
          })
          .returning();
        res.json(created);
        return;
      }

      const [updated] = await db
        .update(uiShellConfigsTable)
        .set({
          themeID: parsed.data.themeID,
          themeDefinitions: parsed.data.themeDefinitions,
          uiConfig,
          updatedByAdminId: adminId,
        })
        .where(
          and(
            eq(uiShellConfigsTable.id, existing[0].id),
            eq(uiShellConfigsTable.appKey, params.data.appKey),
          ),
        )
        .returning();

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: toRouteErrorMessage(error) });
    }
  },
);

router.post(
  "/admin/ui-shell-configs/:appKey/reset",
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      await ensureUiShellSchema();
      const params = paramsSchema.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      const adminId = (req.session as { adminId?: number }).adminId ?? null;
      const emptyUiConfig = buildFallbackUiConfig(
        params.data.appKey,
        "higo-pastel-02",
        adminId,
      );

      const [updated] = await db
        .insert(uiShellConfigsTable)
        .values({
          appKey: params.data.appKey,
          themeID: "higo-pastel-02",
          themeDefinitions: [],
          uiConfig: emptyUiConfig,
          updatedByAdminId: adminId,
        })
        .onConflictDoUpdate({
          target: uiShellConfigsTable.appKey,
          set: {
            themeID: "higo-pastel-02",
            themeDefinitions: [],
            uiConfig: emptyUiConfig,
            updatedByAdminId: adminId,
          },
        })
        .returning();

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: toRouteErrorMessage(error) });
    }
  },
);

export default router;
