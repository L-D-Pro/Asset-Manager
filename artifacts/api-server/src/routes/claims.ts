import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, claimsTable, jobsTable } from "@workspace/db";
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
import {
  draftClaimsFromSource,
  ClaimDraftingUnavailableError,
} from "../lib/pipelines/claim-generation";
import { extractClaimsFromChatPipeline } from "../lib/pipelines/gap-analysis";
import type { JobOpsRequest } from "../lib/http-types";
import { currentUserId } from "../lib/ownership";

const router: IRouter = Router();

router.get("/claims", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  req.log.info("Listing claims");
  const query = ListClaimsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [eq(claimsTable.userId, userId)];
  if (query.data.domain != null) {
    conditions.push(eq(claimsTable.domain, query.data.domain));
  }
  if (query.data.isActive != null) {
    conditions.push(eq(claimsTable.isActive, query.data.isActive));
  }

  const rows = await db
    .select()
    .from(claimsTable)
    .where(and(...conditions))
    .orderBy(claimsTable.createdAt);
  res.json(ListClaimsResponse.parse(rows));
});

router.post("/claims", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const parsed = CreateClaimBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid create claim body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(claimsTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(GetClaimResponse.parse(row));
});

router.post("/claims/draft", async (req: JobOpsRequest, res): Promise<void> => {
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
      userId: currentUserId(req),
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
    if (err instanceof ClaimDraftingUnavailableError) {
      req.log.warn({ err: err.message }, "Claim drafting unavailable");
      res.status(503).json({ error: err.message, retryable: true });
      return;
    }

    req.log.error({ err }, "Failed to draft claims");
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to draft claims",
    });
  }
});

router.post("/claims/extract-from-chat", async (req: JobOpsRequest, res): Promise<void> => {
  try {
    const userId = currentUserId(req);
    const { question, answer, jobId } = req.body;
    if (!question || !answer) {
      res.status(400).json({ error: "question and answer are required" });
      return;
    }
    if (typeof jobId === "number") {
      const [job] = await db
        .select({ id: jobsTable.id })
        .from(jobsTable)
        .where(and(eq(jobsTable.id, jobId), eq(jobsTable.userId, userId)));
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
    }
    const result = await extractClaimsFromChatPipeline(question, answer, jobId, userId);
    // Since DraftClaimsResponse expects `draftClaims`, the pipeline returns the correct shape
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to extract claims from chat");
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to extract claims from chat",
    });
  }
});

router.get("/claims/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = GetClaimParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.id, params.data.id), eq(claimsTable.userId, userId)));
  if (!row) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  res.json(GetClaimResponse.parse(row));
});

router.patch("/claims/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
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
    .where(and(eq(claimsTable.id, params.data.id), eq(claimsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  res.json(UpdateClaimResponse.parse(row));
});

router.delete("/claims/:id", async (req: JobOpsRequest, res): Promise<void> => {
  const userId = currentUserId(req);
  const params = DeleteClaimParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(claimsTable)
    .where(and(eq(claimsTable.id, params.data.id), eq(claimsTable.userId, userId)))
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
