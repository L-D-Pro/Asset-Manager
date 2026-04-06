import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, feedbackSignalsTable, applicationsTable, eventLogsTable } from "@workspace/db";
import {
  ListFeedbackSignalsQueryParams,
  ListFeedbackSignalsResponse,
  CreateFeedbackSignalBody,
  GetFeedbackSignalParams,
  GetFeedbackSignalResponse,
  UpdateFeedbackSignalParams,
  UpdateFeedbackSignalBody,
  UpdateFeedbackSignalResponse,
  DeleteFeedbackSignalParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/feedback-signals", async (req, res): Promise<void> => {
  req.log.info("Listing feedback signals");
  const query = ListFeedbackSignalsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.applicationId != null) {
    conditions.push(eq(feedbackSignalsTable.applicationId, query.data.applicationId));
  }
  if (query.data.outcome != null) {
    conditions.push(eq(feedbackSignalsTable.outcome, query.data.outcome));
  }

  const rows = await db
    .select()
    .from(feedbackSignalsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(feedbackSignalsTable.createdAt);
  res.json(ListFeedbackSignalsResponse.parse(rows));
});

router.post("/feedback-signals", async (req, res): Promise<void> => {
  const parsed = CreateFeedbackSignalBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid create feedback signal body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existingApp] = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.id, parsed.data.applicationId));

  const outcomesToStatus: Record<string, string> = {
    rejected: "rejected",
    offer: "offer_received",
    hired: "hired",
    ghosted: "ghosted",
  };
  const newStatus = outcomesToStatus[parsed.data.outcome];

  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(feedbackSignalsTable)
      .values(parsed.data)
      .returning();

    if (newStatus && existingApp) {
      const previousStatus = existingApp.status;
      await tx
        .update(applicationsTable)
        .set({ status: newStatus })
        .where(eq(applicationsTable.id, parsed.data.applicationId));
      await tx.insert(eventLogsTable).values({
        entityType: "application",
        entityId: parsed.data.applicationId,
        applicationId: parsed.data.applicationId,
        jobId: existingApp.jobId,
        eventType: "status_transition",
        previousState: previousStatus,
        nextState: newStatus,
        actorType: "system",
        metadata: {
          triggeredBy: "feedback_signal",
          feedbackSignalId: inserted.id,
          outcome: parsed.data.outcome,
          signalType: parsed.data.signalType,
        },
      });
    }
    return inserted;
  });

  if (newStatus && existingApp) {
    req.log.info(
      {
        applicationId: parsed.data.applicationId,
        outcome: parsed.data.outcome,
        from: existingApp.status,
        to: newStatus,
      },
      "Application status updated from feedback signal; EventLog written atomically",
    );
  }

  res.status(201).json(GetFeedbackSignalResponse.parse(row));
});

router.get("/feedback-signals/:id", async (req, res): Promise<void> => {
  const params = GetFeedbackSignalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(feedbackSignalsTable)
    .where(eq(feedbackSignalsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Feedback signal not found" });
    return;
  }
  res.json(GetFeedbackSignalResponse.parse(row));
});

router.patch("/feedback-signals/:id", async (req, res): Promise<void> => {
  const params = UpdateFeedbackSignalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateFeedbackSignalBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ error: parsed.error.message }, "Invalid update feedback signal body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(feedbackSignalsTable)
    .set(parsed.data)
    .where(eq(feedbackSignalsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Feedback signal not found" });
    return;
  }
  res.json(UpdateFeedbackSignalResponse.parse(row));
});

router.delete("/feedback-signals/:id", async (req, res): Promise<void> => {
  const params = DeleteFeedbackSignalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(feedbackSignalsTable)
    .where(eq(feedbackSignalsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Feedback signal not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
