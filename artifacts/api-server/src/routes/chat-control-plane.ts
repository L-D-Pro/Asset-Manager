import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  aiChatLeverConfigTable,
  aiChatLeverPresetsTable,
  aiPromptVersionsTable,
  type ChatLeverSnapshot,
} from "@workspace/db";
import {
  UpdateChatLeverConfigBody,
  PreviewChatPromptBody,
  CreateChatLeverPresetBody,
} from "@workspace/api-zod";

import type { JobOpsRequest } from "../lib/http-types";
import {
  getChatLeverConfig,
  resolveChatSystemPromptSections,
  resolveChatPrompt,
} from "../lib/chat/resolve-system-prompt";

const router: IRouter = Router();

const idParam = (raw: string): number | null => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// ── Lever config ───────────────────────────────────────────────────────────

router.get("/chat/lever-config", async (req, res): Promise<void> => {
  if (!(req as JobOpsRequest).session.adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json(await getChatLeverConfig());
});

router.patch("/chat/lever-config", async (req, res): Promise<void> => {
  if (!(req as JobOpsRequest).session.adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = UpdateChatLeverConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const current = await getChatLeverConfig();
  const [updated] = await db
    .update(aiChatLeverConfigTable)
    .set(parsed.data)
    .where(eq(aiChatLeverConfigTable.id, current.id))
    .returning();
  res.json(updated);
});

// ── Prompt inspector ───────────────────────────────────────────────────────

router.post("/chat/preview-prompt", async (req, res): Promise<void> => {
  if (!(req as JobOpsRequest).session.adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = PreviewChatPromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const sections = await resolveChatSystemPromptSections({
    userMessage: parsed.data.sampleMessage,
    attachments: (parsed.data.attachments ?? []) as never,
    overrides: parsed.data.overrides,
  });
  res.json(sections);
});

// ── Router simulator ─────────────────────────────────────────────────────────

router.post("/chat/route-preview", async (req, res): Promise<void> => {
  if (!(req as JobOpsRequest).session.adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = PreviewChatPromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { decision, sections } = await resolveChatPrompt({
    userMessage: parsed.data.sampleMessage,
    attachments: (parsed.data.attachments ?? []) as never,
    explicitSlugs: parsed.data.explicitSkillSlugs,
    overrides: parsed.data.overrides,
  });
  res.json({ decision, sections });
});

// ── Presets ────────────────────────────────────────────────────────────────

router.get("/chat/lever-presets", async (req, res): Promise<void> => {
  if (!(req as JobOpsRequest).session.adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const rows = await db
    .select()
    .from(aiChatLeverPresetsTable)
    .orderBy(desc(aiChatLeverPresetsTable.createdAt));
  res.json(rows);
});

const CreatePresetFromTemplateBody = z.object({
  name: z.string().min(1).max(200),
  snapshot: z.object({
    identityText: z.string(),
    skillsEnabled: z.boolean(),
    bestPracticesEnabled: z.boolean(),
    skillRoutingMode: z.string(),
    skillTokenBudget: z.number().int().nonnegative(),
    maxSelectedSkills: z.number().int().min(1).max(2),
    activePromptVersionIds: z.array(z.number().int().positive()),
  }),
});

router.post("/chat/lever-presets/template", async (req, res): Promise<void> => {
  if (!(req as JobOpsRequest).session.adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreatePresetFromTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [created] = await db
    .insert(aiChatLeverPresetsTable)
    .values({ name: parsed.data.name, snapshot: parsed.data.snapshot as ChatLeverSnapshot })
    .returning();
  res.status(201).json(created);
});

router.post("/chat/lever-presets", async (req, res): Promise<void> => {
  if (!(req as JobOpsRequest).session.adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateChatLeverPresetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Snapshot the current live lever state.
  const config = await getChatLeverConfig();
  const activeRows = await db
    .select({ id: aiPromptVersionsTable.id })
    .from(aiPromptVersionsTable)
    .where(
      and(
        eq(aiPromptVersionsTable.taskScope, "chat"),
        eq(aiPromptVersionsTable.isActive, true),
      ),
    );

  const snapshot: ChatLeverSnapshot = {
    identityText: config.identityText,
    skillsEnabled: config.skillsEnabled,
    bestPracticesEnabled: config.bestPracticesEnabled,
    skillRoutingMode: config.skillRoutingMode,
    skillTokenBudget: config.skillTokenBudget,
    maxSelectedSkills: config.maxSelectedSkills,
    activePromptVersionIds: activeRows.map((r) => r.id),
  };

  const [created] = await db
    .insert(aiChatLeverPresetsTable)
    .values({ name: parsed.data.name, snapshot })
    .returning();
  res.status(201).json(created);
});

router.patch("/chat/lever-presets/:id", async (req, res): Promise<void> => {
  if (!(req as JobOpsRequest).session.adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = idParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [existing] = await db
    .select()
    .from(aiChatLeverPresetsTable)
    .where(eq(aiChatLeverPresetsTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Preset not found" });
    return;
  }

  // Re-snapshot current live state into this preset.
  const config = await getChatLeverConfig();
  const activeRows = await db
    .select({ id: aiPromptVersionsTable.id })
    .from(aiPromptVersionsTable)
    .where(and(eq(aiPromptVersionsTable.taskScope, "chat"), eq(aiPromptVersionsTable.isActive, true)));

  const snapshot: ChatLeverSnapshot = {
    identityText: config.identityText,
    skillsEnabled: config.skillsEnabled,
    bestPracticesEnabled: config.bestPracticesEnabled,
    skillRoutingMode: config.skillRoutingMode,
    skillTokenBudget: config.skillTokenBudget,
    maxSelectedSkills: config.maxSelectedSkills,
    activePromptVersionIds: activeRows.map((r) => r.id),
  };

  const [updated] = await db
    .update(aiChatLeverPresetsTable)
    .set({ snapshot })
    .where(eq(aiChatLeverPresetsTable.id, id))
    .returning();
  res.json(updated);
});

router.delete("/chat/lever-presets/:id", async (req, res): Promise<void> => {
  if (!(req as JobOpsRequest).session.adminId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = idParam(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db
    .delete(aiChatLeverPresetsTable)
    .where(eq(aiChatLeverPresetsTable.id, id))
    .returning({ id: aiChatLeverPresetsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Preset not found" });
    return;
  }
  res.status(204).end();
});

router.post(
  "/chat/lever-presets/:id/apply",
  async (req, res): Promise<void> => {
    if (!(req as JobOpsRequest).session.adminId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const id = idParam(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [preset] = await db
      .select()
      .from(aiChatLeverPresetsTable)
      .where(eq(aiChatLeverPresetsTable.id, id))
      .limit(1);
    if (!preset) {
      res.status(404).json({ error: "Preset not found" });
      return;
    }

    const snapshot = preset.snapshot;
    const config = await getChatLeverConfig();

    // 1. Restore the lever config fields.
    const [updated] = await db
      .update(aiChatLeverConfigTable)
      .set({
        identityText: snapshot.identityText,
        skillsEnabled: snapshot.skillsEnabled,
        bestPracticesEnabled: snapshot.bestPracticesEnabled,
        skillRoutingMode: snapshot.skillRoutingMode,
        skillTokenBudget: snapshot.skillTokenBudget,
        maxSelectedSkills: snapshot.maxSelectedSkills,
      })
      .where(eq(aiChatLeverConfigTable.id, config.id))
      .returning();

    // 2. Flip ai_prompt_versions.isActive to match the snapshot.
    const chatVersions = await db
      .select({ id: aiPromptVersionsTable.id })
      .from(aiPromptVersionsTable)
      .where(eq(aiPromptVersionsTable.taskScope, "chat"));
    const wantActive = new Set(snapshot.activePromptVersionIds);
    const toActivate = chatVersions
      .filter((v) => wantActive.has(v.id))
      .map((v) => v.id);
    const toDeactivate = chatVersions
      .filter((v) => !wantActive.has(v.id))
      .map((v) => v.id);

    if (toActivate.length > 0) {
      await db
        .update(aiPromptVersionsTable)
        .set({ isActive: true })
        .where(inArray(aiPromptVersionsTable.id, toActivate));
    }
    if (toDeactivate.length > 0) {
      await db
        .update(aiPromptVersionsTable)
        .set({ isActive: false })
        .where(inArray(aiPromptVersionsTable.id, toDeactivate));
    }

    res.json(updated);
  },
);

export default router;
