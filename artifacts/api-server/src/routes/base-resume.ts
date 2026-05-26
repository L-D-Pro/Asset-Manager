import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, baseResumeVersionsTable } from "@workspace/db";
import {
  GetBaseResumeResponse,
  ListBaseResumeHistoryResponse,
  CreateBaseResumeBody,
  RestoreBaseResumeVersionParams,
  DeleteBaseResumeVersionParams,
} from "@workspace/api-zod";
import {
  extractTextFromDocumentFile,
  getUploadedDocument,
  parseSingleDocumentUpload,
  UploadValidationError,
} from "../lib/document-text";
import type { JobOpsRequest } from "../lib/http-types";
import { currentUserId } from "../lib/ownership";

const router: IRouter = Router();

function buildDefaultLabel(date = new Date()): string {
  return `Base Resume - ${date.toLocaleString()}`;
}

router.get("/base-resume", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const [row] = await db
    .select()
    .from(baseResumeVersionsTable)
    .where(and(eq(baseResumeVersionsTable.userId, userId), eq(baseResumeVersionsTable.isCurrent, true)));

  if (!row) {
    res.status(204).end();
    return;
  }

  res.json(GetBaseResumeResponse.parse(row));
});

router.get("/base-resume/history", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const rows = await db
    .select()
    .from(baseResumeVersionsTable)
    .where(eq(baseResumeVersionsTable.userId, userId))
    .orderBy(desc(baseResumeVersionsTable.createdAt));

  res.json(ListBaseResumeHistoryResponse.parse(rows));
});

router.post("/base-resume", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const parsed = CreateBaseResumeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const row = await db.transaction(async (tx) => {
    await tx
      .update(baseResumeVersionsTable)
      .set({ isCurrent: false })
      .where(and(eq(baseResumeVersionsTable.userId, userId), eq(baseResumeVersionsTable.isCurrent, true)));

    const [created] = await tx
      .insert(baseResumeVersionsTable)
      .values({
        contentText: parsed.data.contentText,
        label: parsed.data.label?.trim() || buildDefaultLabel(),
        isCurrent: true,
        userId,
      })
      .returning();

    return created!;
  });

  res.status(201).json(GetBaseResumeResponse.parse(row));
});

router.post("/base-resume/import", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  try {
    await parseSingleDocumentUpload(req, res);

    const file = getUploadedDocument(req);
    if (!file) {
      res.status(400).json({ error: "Upload a DOCX or PDF resume file." });
      return;
    }

    const contentText = await extractTextFromDocumentFile(file);
    if (contentText.length < 20) {
      res.status(400).json({
        error: "Could not extract enough readable text from this file. For scanned PDFs, paste the resume text instead.",
      });
      return;
    }

    const label = typeof req.body.label === "string" && req.body.label.trim()
      ? req.body.label.trim()
      : `Imported - ${file.originalname}`;

    const row = await db.transaction(async (tx) => {
      await tx
        .update(baseResumeVersionsTable)
        .set({ isCurrent: false })
        .where(and(eq(baseResumeVersionsTable.userId, userId), eq(baseResumeVersionsTable.isCurrent, true)));

      const [created] = await tx
        .insert(baseResumeVersionsTable)
        .values({
          contentText,
          label,
          isCurrent: true,
          userId,
        })
        .returning();

      return created!;
    });

    res.status(201).json(GetBaseResumeResponse.parse(row));
  } catch (err) {
    if (err instanceof UploadValidationError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }

    req.log.error({ err }, "Failed to import base resume");
    res.status(500).json({ error: "Failed to import base resume" });
  }
});

router.post("/base-resume/:id/restore", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = RestoreBaseResumeVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [source] = await db
    .select()
    .from(baseResumeVersionsTable)
    .where(and(eq(baseResumeVersionsTable.id, params.data.id), eq(baseResumeVersionsTable.userId, userId)));

  if (!source) {
    res.status(404).json({ error: "Base resume version not found" });
    return;
  }

  const row = await db.transaction(async (tx) => {
    await tx
      .update(baseResumeVersionsTable)
      .set({ isCurrent: false })
      .where(and(eq(baseResumeVersionsTable.userId, userId), eq(baseResumeVersionsTable.isCurrent, true)));

    const [created] = await tx
      .insert(baseResumeVersionsTable)
      .values({
        contentText: source.contentText,
        label: `Restored - ${source.label?.trim() || `Version ${source.id}`}`,
        isCurrent: true,
        userId,
      })
      .returning();

    return created!;
  });

  res.status(201).json(GetBaseResumeResponse.parse(row));
});

router.delete("/base-resume/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = DeleteBaseResumeVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(baseResumeVersionsTable)
    .where(and(eq(baseResumeVersionsTable.id, params.data.id), eq(baseResumeVersionsTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Base resume version not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
