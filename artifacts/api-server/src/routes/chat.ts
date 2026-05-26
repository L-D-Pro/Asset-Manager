import { Router, type IRouter } from "express";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod/v4";

import {
  db,
  conversations,
  messages,
  eventLogsTable,
  aiRunEvaluationsTable,
  type MessageAttachment,
} from "@workspace/db";

import type { JobOpsRequest } from "../lib/http-types";
import { logger } from "../lib/logger";
import { streamChatCompletion, loadConversationMessages } from "../lib/chat/stream-openrouter";
import { extractTextFromDocumentFile, getUploadedDocument, parseSingleDocumentUpload, UploadValidationError, MAX_AI_SOURCE_CHARS } from "../lib/document-text";

const router: IRouter = Router();

// ── Validation schemas ────────────────────────────────────────────────────

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createThreadSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

const updateThreadSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  archived: z.boolean().optional(),
}).refine((v) => v.title !== undefined || v.archived !== undefined, {
  message: "Provide at least one of `title` or `archived`",
});

const attachmentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("base_resume"),
    refId: z.number().int().positive().optional(),
    snapshot: z.object({
      version: z.number().int().optional(),
      capturedAt: z.string().optional(),
      contentText: z.string().min(1),
    }),
  }),
  z.object({
    kind: z.literal("job"),
    refId: z.number().int().positive().optional(),
    snapshot: z.object({
      title: z.string().min(1),
      company: z.string().optional(),
      location: z.string().optional(),
      jdText: z.string().min(1),
    }),
  }),
  z.object({
    kind: z.literal("claims"),
    refId: z.number().int().positive().optional(),
    snapshot: z.object({
      claims: z.array(
        z.object({
          text: z.string().min(1),
          verified: z.boolean(),
        }),
      ).min(1),
    }),
  }),
  z.object({
    kind: z.literal("document"),
    snapshot: z.object({
      filename: z.string().min(1).max(260),
      contentText: z.string().min(1).max(MAX_AI_SOURCE_CHARS),
    }),
  }),
]);

const postMessageSchema = z.object({
  content: z.string().min(1).max(20000),
  attachments: z.array(attachmentSchema).max(20).optional().default([]),
  modelConfigId: z.number().int().positive().optional(),
  jdParseEnabled: z.boolean().optional().default(false),
  explicitSkillSlugs: z.array(z.string().min(1).max(120)).max(2).optional(),
});

const feedbackSchema = z.object({
  outcome: z.enum(["approved", "rejected"]),
  notes: z.string().max(2000).optional(),
});

// ── Threads CRUD ──────────────────────────────────────────────────────────

router.get("/chat/threads", async (req, res): Promise<void> => {
  const r = req as JobOpsRequest;
  const userId = r.session.adminId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const includeArchived = req.query.include_archived === "1" || req.query.include_archived === "true";

  const rows = await db
    .select()
    .from(conversations)
    .where(
      includeArchived
        ? eq(conversations.userId, userId)
        : and(eq(conversations.userId, userId), isNull(conversations.archivedAt)),
    )
    .orderBy(desc(conversations.updatedAt));

  res.json(rows);
});

router.post("/chat/threads", async (req, res): Promise<void> => {
  const r = req as JobOpsRequest;
  const userId = r.session.adminId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = createThreadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .insert(conversations)
    .values({
      userId,
      title: parsed.data.title ?? "New chat",
    })
    .returning();

  res.status(201).json(row);
});

router.patch("/chat/threads/:id", async (req, res): Promise<void> => {
  const r = req as JobOpsRequest;
  const userId = r.session.adminId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = idParamSchema.safeParse(req.params);
  const body = updateThreadSchema.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.data.title !== undefined) updates.title = body.data.title;
  if (body.data.archived !== undefined) updates.archivedAt = body.data.archived ? new Date() : null;

  const [row] = await db
    .update(conversations)
    .set(updates)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)))
    .returning();

  if (!row) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.json(row);
});

router.delete("/chat/threads/:id", async (req, res): Promise<void> => {
  const r = req as JobOpsRequest;
  const userId = r.session.adminId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = idParamSchema.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [row] = await db
    .delete(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });

  if (!row) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.status(204).end();
});

// ── Messages ──────────────────────────────────────────────────────────────

router.get("/chat/threads/:id/messages", async (req, res): Promise<void> => {
  const r = req as JobOpsRequest;
  const userId = r.session.adminId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = idParamSchema.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [thread] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)))
    .limit(1);
  if (!thread) { res.status(404).json({ error: "Conversation not found" }); return; }

  const rows = await loadConversationMessages(thread.id);
  res.json(rows);
});

router.post("/chat/threads/:id/messages", async (req, res): Promise<void> => {
  const r = req as JobOpsRequest;
  const userId = r.session.adminId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = idParamSchema.safeParse(req.params);
  const body = postMessageSchema.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  try {
    await streamChatCompletion({
      conversationId: params.data.id,
      userId,
      userMessage: {
        content: body.data.content,
        attachments: (body.data.attachments ?? []) as MessageAttachment[],
      },
      modelConfigId: body.data.modelConfigId,
      jdParseEnabled: body.data.jdParseEnabled,
      explicitSkillSlugs: body.data.explicitSkillSlugs,
      res,
    });
  } catch (err) {
    logger.error({ err, conversationId: params.data.id }, "Chat stream handler crashed");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal chat stream failure" });
    } else {
      res.end();
    }
  }
});

// ── Document parse ────────────────────────────────────────────────────────

router.post("/chat/parse-document", async (req, res): Promise<void> => {
  const r = req as JobOpsRequest;
  if (!r.session.adminId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    await parseSingleDocumentUpload(req, res);
  } catch (err) {
    if (err instanceof UploadValidationError) { res.status(400).json({ error: err.message }); return; }
    logger.error({ err }, "chat/parse-document: unexpected error during multer");
    res.status(500).json({ error: "Upload failed" }); return;
  }

  const file = getUploadedDocument(req);
  if (!file) { res.status(400).json({ error: "No file provided" }); return; }

  try {
    const contentText = await extractTextFromDocumentFile(file);
    res.json({ filename: file.originalname, contentText });
  } catch (err) {
    if (err instanceof UploadValidationError) { res.status(400).json({ error: err.message }); return; }
    logger.error({ err }, "chat/parse-document: text extraction failed");
    res.status(422).json({ error: "Could not extract text from file" });
  }
});

// ── Feedback (writes ai_run_evaluations) ─────────────────────────────────

router.post("/chat/messages/:id/feedback", async (req, res): Promise<void> => {
  const r = req as JobOpsRequest;
  const userId = r.session.adminId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = idParamSchema.safeParse(req.params);
  const body = feedbackSchema.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  // Resolve message → conversation → ownership check.
  const [message] = await db
    .select({
      id: messages.id,
      role: messages.role,
      runId: messages.runId,
      promptVersionId: messages.promptVersionId,
      conversationId: messages.conversationId,
    })
    .from(messages)
    .where(eq(messages.id, params.data.id))
    .limit(1);

  if (!message) { res.status(404).json({ error: "Message not found" }); return; }

  const [thread] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, message.conversationId), eq(conversations.userId, userId)))
    .limit(1);
  if (!thread) { res.status(404).json({ error: "Conversation not found" }); return; }

  if (message.role !== "assistant") {
    res.status(400).json({ error: "Only assistant messages can be rated" });
    return;
  }
  if (!message.runId) {
    res.status(400).json({ error: "Message has no canonical runId — cannot record feedback" });
    return;
  }

  // Find the root event_log row for this runId.
  const [rootEvent] = await db
    .select({ id: eventLogsTable.id })
    .from(eventLogsTable)
    .where(and(
      eq(eventLogsTable.runId, message.runId),
      eq(eventLogsTable.userId, userId),
      eq(eventLogsTable.entityType, "ai_call"),
    ))
    .orderBy(asc(eventLogsTable.createdAt))
    .limit(1);

  if (!rootEvent) {
    res.status(409).json({ error: "No AI lineage event found for this message" });
    return;
  }

  try {
    const [row] = await db
      .insert(aiRunEvaluationsTable)
      .values({
        userId,
        runId: message.runId,
        eventLogId: rootEvent.id,
        promptVersionId: message.promptVersionId,
        taskScope: "chat",
        entityType: "chat_message",
        entityId: message.id,
        approvalOutcome: body.data.outcome,
        evaluatorType: "user",
        notes: body.data.notes ?? null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    // Unique index (runId, taskScope, entityType, entityId) — only one feedback per turn.
    const messageText = err instanceof Error ? err.message : String(err);
    if (/duplicate key|unique/i.test(messageText)) {
      res.status(409).json({ error: "Feedback already recorded for this message" });
      return;
    }
    throw err;
  }
});

export default router;
