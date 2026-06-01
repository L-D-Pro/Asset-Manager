import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  aiChatLeverConfigTable,
  aiChatLeverPresetsTable,
  aiPromptVersionsTable,
  messages,
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
  resolveChatPrompt,
} from "../lib/chat/resolve-system-prompt";
import { buildFinalChatPayload } from "../lib/chat/final-payload-builder";
import { requireAdmin } from "../middlewares/admin";
import { currentUserId } from "../lib/ownership";

const router: IRouter = Router();

const idParam = (raw: string | string[]): number | null => {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
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

router.patch("/chat/lever-config", requireAdmin, async (req, res): Promise<void> => {
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

  const userId = currentUserId(req as JobOpsRequest);

  // Load real conversation history if conversationId provided in the request body.
  const conversationId =
    typeof req.body.conversationId === "number" ? (req.body.conversationId as number) : null;
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (conversationId != null) {
    const leverConfig = await getChatLeverConfig();
    const historyRows = await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(leverConfig.historyTurnLimit);
    history = historyRows
      .reverse()
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  }

  const payload = await buildFinalChatPayload({
    userId,
    userMessage: {
      content: parsed.data.sampleMessage,
      attachments: (parsed.data.attachments ?? []) as never,
    },
    history,
    explicitSlugs: parsed.data.explicitSkillSlugs ?? [],
    overrides: parsed.data.overrides,
  });

  res.json(payload);
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
    userId: currentUserId(req as JobOpsRequest),
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

router.post("/chat/lever-presets/template", requireAdmin, async (req, res): Promise<void> => {
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

router.post("/chat/lever-presets", requireAdmin, async (req, res): Promise<void> => {
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
    autoThreshold: config.autoThreshold,
    triggerWeight: config.triggerWeight,
    negativeTriggerWeight: config.negativeTriggerWeight,
    ambiguousGap: config.ambiguousGap,
    llmConfidenceThreshold: config.llmConfidenceThreshold,
    coverBoost: config.coverBoost,
    boostTailorPlusJob: config.boostTailorPlusJob,
    boostResumePlusJob: config.boostResumePlusJob,
    boostAuditTailoredJob: config.boostAuditTailoredJob,
    boostAuditTailoredOnly: config.boostAuditTailoredOnly,
    historyTurnLimit: config.historyTurnLimit,
  };

  const [created] = await db
    .insert(aiChatLeverPresetsTable)
    .values({ name: parsed.data.name, snapshot })
    .returning();
  res.status(201).json(created);
});

router.patch("/chat/lever-presets/:id", requireAdmin, async (req, res): Promise<void> => {
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
    autoThreshold: config.autoThreshold,
    triggerWeight: config.triggerWeight,
    negativeTriggerWeight: config.negativeTriggerWeight,
    ambiguousGap: config.ambiguousGap,
    llmConfidenceThreshold: config.llmConfidenceThreshold,
    coverBoost: config.coverBoost,
    boostTailorPlusJob: config.boostTailorPlusJob,
    boostResumePlusJob: config.boostResumePlusJob,
    boostAuditTailoredJob: config.boostAuditTailoredJob,
    boostAuditTailoredOnly: config.boostAuditTailoredOnly,
    historyTurnLimit: config.historyTurnLimit,
  };

  const [updated] = await db
    .update(aiChatLeverPresetsTable)
    .set({ snapshot })
    .where(eq(aiChatLeverPresetsTable.id, id))
    .returning();
  res.json(updated);
});

router.delete("/chat/lever-presets/:id", requireAdmin, async (req, res): Promise<void> => {
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
  requireAdmin,
  async (req, res): Promise<void> => {
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
        // Routing config — fall back to current live value for old presets missing these fields.
        autoThreshold: snapshot.autoThreshold ?? config.autoThreshold,
        triggerWeight: snapshot.triggerWeight ?? config.triggerWeight,
        negativeTriggerWeight: snapshot.negativeTriggerWeight ?? config.negativeTriggerWeight,
        ambiguousGap: snapshot.ambiguousGap ?? config.ambiguousGap,
        llmConfidenceThreshold: snapshot.llmConfidenceThreshold ?? config.llmConfidenceThreshold,
        coverBoost: snapshot.coverBoost ?? config.coverBoost,
        boostTailorPlusJob: snapshot.boostTailorPlusJob ?? config.boostTailorPlusJob,
        boostResumePlusJob: snapshot.boostResumePlusJob ?? config.boostResumePlusJob,
        boostAuditTailoredJob: snapshot.boostAuditTailoredJob ?? config.boostAuditTailoredJob,
        boostAuditTailoredOnly: snapshot.boostAuditTailoredOnly ?? config.boostAuditTailoredOnly,
        historyTurnLimit: snapshot.historyTurnLimit ?? config.historyTurnLimit,
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
