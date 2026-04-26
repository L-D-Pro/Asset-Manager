import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, claimsTable } from "@workspace/db";
import {
  ListClaimsQueryParams,
  ListClaimsResponse,
  CreateClaimBody,
  GetClaimParams,
  GetClaimResponse,
  UpdateClaimParams,
  UpdateClaimBody,
  UpdateClaimResponse,
  DeleteClaimParams,
  DraftClaimsResponse,
} from "@workspace/api-zod";
import {
  extractTextFromDocumentFile,
  getUploadedDocument,
  parseSingleDocumentUpload,
  UploadValidationError,
} from "../lib/document-text";
import { draftClaimsFromSource } from "../lib/pipelines/claim-generation";
import { extractClaimsFromChatPipeline } from "../lib/pipelines/gap-analysis";

const router: IRouter = Router();

router.get("/claims", async (req, res): Promise<void> => {
  req.log.info("Listing claims");
  const query = ListClaimsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.domain != null) {
    conditions.push(eq(claimsTable.domain, query.data.domain));
  }
  if (query.data.isActive != null) {
    conditions.push(eq(claimsTable.isActive, query.data.isActive));
  }

  const rows = await db
    .select()
    .from(claimsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(claimsTable.createdAt);
  res.json(ListClaimsResponse.parse(rows));
});

router.post("/claims", async (req, res): Promise<void> => {
  const parsed = CreateClaimBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid create claim body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(claimsTable).values(parsed.data).returning();
  res.status(201).json(GetClaimResponse.parse(row));
});

router.post("/claims/draft", async (req, res): Promise<void> => {
  try {
    await parseSingleDocumentUpload(req, res);

    const sourceText = getStringBodyField(req.body.sourceText);
    const prompt = getStringBodyField(req.body.prompt);
    const file = getUploadedDocument(req);
    const extractedText = file ? await extractTextFromDocumentFile(file) : "";

    if (!sourceText.trim() && !extractedText.trim()) {
      res.status(400).json({ error: "Provide pasted notes or upload a DOCX/PDF source file." });
      return;
    }

    if (file && extractedText.length < 20) {
      res.status(400).json({
        error: "Could not extract enough readable text from this file. For scanned PDFs, paste the text instead.",
      });
      return;
    }

    const result = await draftClaimsFromSource({
      sourceText,
      prompt,
      extractedText,
      filename: file?.originalname ?? null,
    });

    res.json(DraftClaimsResponse.parse(result));
  } catch (err) {
    if (err instanceof UploadValidationError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }

    req.log.error({ err }, "Failed to draft claims");
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to draft claims",
    });
  }
});

router.post("/claims/extract-from-chat", async (req, res): Promise<void> => {
  try {
    const { question, answer, jobId } = req.body;
    if (!question || !answer) {
      res.status(400).json({ error: "question and answer are required" });
      return;
    }
    const result = await extractClaimsFromChatPipeline(question, answer, jobId);
    // Since DraftClaimsResponse expects `draftClaims`, the pipeline returns the correct shape
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to extract claims from chat");
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to extract claims from chat",
    });
  }
});

router.get("/claims/:id", async (req, res): Promise<void> => {
  const params = GetClaimParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(claimsTable)
    .where(eq(claimsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  res.json(GetClaimResponse.parse(row));
});

router.patch("/claims/:id", async (req, res): Promise<void> => {
  const params = UpdateClaimParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateClaimBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid update claim body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(claimsTable)
    .set(parsed.data)
    .where(eq(claimsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  res.json(UpdateClaimResponse.parse(row));
});

router.delete("/claims/:id", async (req, res): Promise<void> => {
  const params = DeleteClaimParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(claimsTable)
    .where(eq(claimsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;

function getStringBodyField(value: unknown): string {
  return typeof value === "string" ? value : "";
}
