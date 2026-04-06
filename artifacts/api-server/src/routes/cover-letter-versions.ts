import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, coverLetterVersionsTable } from "@workspace/db";
import {
  ListCoverLetterVersionsQueryParams,
  ListCoverLetterVersionsResponse,
  GetCoverLetterVersionParams,
  GetCoverLetterVersionResponse,
  UpdateCoverLetterVersionParams,
  UpdateCoverLetterVersionBody,
  UpdateCoverLetterVersionResponse,
  DeleteCoverLetterVersionParams,
  ApproveCoverLetterVersionParams,
  ApproveCoverLetterVersionResponse,
  RejectCoverLetterVersionParams,
  RejectCoverLetterVersionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/cover-letter-versions", async (req, res): Promise<void> => {
  req.log.info("Listing cover letter versions");
  const query = ListCoverLetterVersionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.jobId != null) {
    conditions.push(eq(coverLetterVersionsTable.jobId, query.data.jobId));
  }
  if (query.data.status != null) {
    conditions.push(eq(coverLetterVersionsTable.status, query.data.status));
  }

  const rows = await db
    .select()
    .from(coverLetterVersionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(coverLetterVersionsTable.createdAt);
  res.json(ListCoverLetterVersionsResponse.parse(rows));
});

router.get("/cover-letter-versions/:id", async (req, res): Promise<void> => {
  const params = GetCoverLetterVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(coverLetterVersionsTable)
    .where(eq(coverLetterVersionsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Cover letter version not found" });
    return;
  }
  res.json(GetCoverLetterVersionResponse.parse(row));
});

router.patch("/cover-letter-versions/:id", async (req, res): Promise<void> => {
  const params = UpdateCoverLetterVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCoverLetterVersionBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid update cover letter body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(coverLetterVersionsTable)
    .set(parsed.data)
    .where(eq(coverLetterVersionsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Cover letter version not found" });
    return;
  }
  res.json(UpdateCoverLetterVersionResponse.parse(row));
});

router.delete("/cover-letter-versions/:id", async (req, res): Promise<void> => {
  const params = DeleteCoverLetterVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(coverLetterVersionsTable)
    .where(eq(coverLetterVersionsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Cover letter version not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/cover-letter-versions/:id/approve", async (req, res): Promise<void> => {
  const params = ApproveCoverLetterVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .update(coverLetterVersionsTable)
    .set({ status: "approved" })
    .where(eq(coverLetterVersionsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Cover letter version not found" });
    return;
  }
  req.log.info({ id: params.data.id }, "Cover letter version approved");
  res.json(ApproveCoverLetterVersionResponse.parse(row));
});

router.post("/cover-letter-versions/:id/reject", async (req, res): Promise<void> => {
  const params = RejectCoverLetterVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .update(coverLetterVersionsTable)
    .set({ status: "rejected" })
    .where(eq(coverLetterVersionsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Cover letter version not found" });
    return;
  }
  req.log.info({ id: params.data.id }, "Cover letter version rejected");
  res.json(RejectCoverLetterVersionResponse.parse(row));
});

export default router;
