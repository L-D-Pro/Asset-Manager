import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, baseResumeVersionsTable } from "@workspace/db";
import {
  GetBaseResumeResponse,
  ListBaseResumeHistoryResponse,
  CreateBaseResumeBody,
  RestoreBaseResumeVersionParams,
} from "@workspace/api-zod";
import {
  extractTextFromDocumentFile,
  getUploadedDocument,
  parseSingleDocumentUpload,
  UploadValidationError,
} from "../lib/document-text";

const router: IRouter = Router();

function buildDefaultLabel(date = new Date()): string {
  return `Base Resume - ${date.toLocaleString()}`;
}

router.get("/base-resume", async (_req, res): Promise<void> => {
  const [row] = await db
    .select()
    .from(baseResumeVersionsTable)
    .where(eq(baseResumeVersionsTable.isCurrent, true));

  if (!row) {
    res.status(404).json({ error: "Base resume not found" });
    return;
  }

  res.json(GetBaseResumeResponse.parse(row));
});

router.get("/base-resume/history", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(baseResumeVersionsTable)
    .orderBy(desc(baseResumeVersionsTable.createdAt));

  res.json(ListBaseResumeHistoryResponse.parse(rows));
});

router.post("/base-resume", async (req, res): Promise<void> => {
  const parsed = CreateBaseResumeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const row = await db.transaction(async (tx) => {
    await tx
      .update(baseResumeVersionsTable)
      .set({ isCurrent: false })
      .where(eq(baseResumeVersionsTable.isCurrent, true));

    const [created] = await tx
      .insert(baseResumeVersionsTable)
      .values({
        contentText: parsed.data.contentText,
        label: parsed.data.label?.trim() || buildDefaultLabel(),
        isCurrent: true,
      })
      .returning();

    return created!;
  });

  res.status(201).json(GetBaseResumeResponse.parse(row));
});

router.post("/base-resume/import", async (req, res): Promise<void> => {
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
        .where(eq(baseResumeVersionsTable.isCurrent, true));

      const [created] = await tx
        .insert(baseResumeVersionsTable)
        .values({
          contentText,
          label,
          isCurrent: true,
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

router.post("/base-resume/:id/restore", async (req, res): Promise<void> => {
  const params = RestoreBaseResumeVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [source] = await db
    .select()
    .from(baseResumeVersionsTable)
    .where(eq(baseResumeVersionsTable.id, params.data.id));

  if (!source) {
    res.status(404).json({ error: "Base resume version not found" });
    return;
  }

  const row = await db.transaction(async (tx) => {
    await tx
      .update(baseResumeVersionsTable)
      .set({ isCurrent: false })
      .where(eq(baseResumeVersionsTable.isCurrent, true));

    const [created] = await tx
      .insert(baseResumeVersionsTable)
      .values({
        contentText: source.contentText,
        label: `Restored - ${source.label?.trim() || `Version ${source.id}`}`,
        isCurrent: true,
      })
      .returning();

    return created!;
  });

  res.status(201).json(GetBaseResumeResponse.parse(row));
});

export default router;
