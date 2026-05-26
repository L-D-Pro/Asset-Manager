import { describe, expect, it, vi } from "vitest";

// We test approve/reject handlers in-process (no supertest) by locating the
// handler in the router stack and invoking it with req/res stubs.
//
// The key behavior under test: when approve/reject is called and lineage
// validation passes, the route performs an upsert into ai_run_evaluations in the
// same transaction as the status update + event log insert.

type TxMock = {
  update: any;
  insert: any;
};

function makeRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: unknown) => {
    res.payload = payload;
    return res;
  });
  res.sendStatus = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  return res;
}

// Shared db mock that captures transaction activity.
vi.mock("@workspace/db", () => {
  const tx: TxMock = {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => [
            {
              id: 123,
              jobId: 77,
              baseResumeVersionId: null,
              label: null,
              templateId: "software_developer",
              status: "approved",
              tailoredDocumentText: null,
              tailoredBullets: [{ text: "Supported", claimIds: [1] }],
              diffData: {
                templateValidation: { templateId: "software_developer" },
                sourceValidation: { passed: true, validItemCount: 1 },
                semanticValidation: { passed: true, sectionCounts: { summary: 1, experience: 4, education: 2, skills: 3 } },
              },
              claimIds: [],
              fileUrl: null,
              rawContent: null,
              notes: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [{ id: 555 }]),
        onConflictDoUpdate: vi.fn(() => undefined),
      })),
    })),
  };

  const dbMock = {
    select: vi.fn(),
    transaction: vi.fn(async (fn: (tx: any) => any) => fn(tx)),
  };

  // Minimal table stubs used by the routes.
  const resumeVersionsTable = { id: "id", status: "status", userId: "user_id" };
  const coverLetterVersionsTable = { id: "id", status: "status", userId: "user_id" };
  const eventLogsTable = { id: "id" };
  const aiRunEvaluationsTable = {
    id: "id",
    runId: "run_id",
    taskScope: "task_scope",
    entityType: "entity_type",
    entityId: "entity_id",
  };

  return {
    db: dbMock,
    resumeVersionsTable,
    coverLetterVersionsTable,
    eventLogsTable,
    aiRunEvaluationsTable,
    __approvalEvalCaptureTest: { dbMock, tx },
  };
});

// We mock lineage validation to ensure the transaction path is exercised.
vi.mock("../../lib/lineage", () => {
  return {
    validateLineage: vi.fn(async () => ({ ok: true, status: "valid", diagnostics: { reasons: [] } })),
  };
});

describe("approval evaluation capture", () => {
  it("upserts ai_run_evaluations when approving a resume version", async () => {
    const { default: resumeRouter } = await import("../resume-versions");

    // First select() call in route loads existing version.
    (await import("@workspace/db") as any).__approvalEvalCaptureTest.dbMock.select.mockReturnValueOnce({
      from() {
        return {
          where() {
            return [
              {
                id: 123,
                status: "pending_approval",
                jobId: 77,
                runId: "run_20250101t000000z_aaaaaaaaaaaa",
                eventLogId: 501,
                templateId: "software_developer",
                tailoredBullets: [{ text: "Supported", claimIds: [1] }],
                diffData: {
                  templateValidation: { templateId: "software_developer" },
                  sourceValidation: { passed: true, validItemCount: 1 },
                  semanticValidation: { passed: true, sectionCounts: { summary: 1, experience: 4, education: 2, skills: 3 } },
                },
              },
            ];
          },
        };
      },
    });

    const layer = (resumeRouter as any).stack.find(
      (l: any) => l.route?.path === "/resume-versions/:id/approve" && l.route?.methods?.post,
    );
    expect(layer).toBeTruthy();

    const handler = layer.route.stack[0].handle;
    const req: any = {
      params: { id: "123" },
      body: {
        rubric: { truthfulnessScore: 4, relevanceScore: 5, formattingScore: 3, attributionScore: 2 },
        editDistance: 12,
        notes: "LGTM",
      },
      session: { adminId: 27 },
      log: { info: vi.fn(), warn: vi.fn() },
    };
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);

    const { tx } = (await import("@workspace/db") as any).__approvalEvalCaptureTest;

    // We expect 2 inserts in the transaction: event log + ai run evaluation upsert.
    expect(tx.insert).toHaveBeenCalled();

    // Find a call where values included runId + approvalOutcome.
    const insertCalls = tx.insert.mock.calls;
    const valuesCalls = tx.insert.mock.results
      .map((r: any) => r.value?.values?.mock?.calls ?? [])
      .flat();

    const flattened = valuesCalls.map((c: any) => c[0]);
    const evaluationInsert = flattened.find(
      (v: any) => v && v.runId && v.taskScope && v.approvalOutcome,
    );

    expect(evaluationInsert).toBeTruthy();
    expect(evaluationInsert.approvalOutcome).toBe("approved");
    expect(evaluationInsert.userId).toBe(27);
    expect(evaluationInsert.editDistance).toBe(12);
    expect(evaluationInsert.truthfulnessScore).toBe(4);
    expect(evaluationInsert.relevanceScore).toBe(5);
    expect(evaluationInsert.formattingScore).toBe(3);
    expect(evaluationInsert.attributionScore).toBe(2);
    expect(evaluationInsert.notes).toBe("LGTM");
  });

  it("allows rejecting a previously approved resume when it now fails approval validation", async () => {
    const { default: resumeRouter } = await import("../resume-versions");

    (await import("@workspace/db") as any).__approvalEvalCaptureTest.dbMock.select.mockReturnValueOnce({
      from() {
        return {
          where() {
            return [
              {
                id: 123,
                status: "approved",
                jobId: 77,
                runId: "run_20250101t000000z_invalidapproved",
                eventLogId: 501,
                templateId: null,
                tailoredBullets: [],
                diffData: null,
                notes: "Resume must be regenerated before approval",
              },
            ];
          },
        };
      },
    });

    const layer = (resumeRouter as any).stack.find(
      (l: any) => l.route?.path === "/resume-versions/:id/reject" && l.route?.methods?.post,
    );
    expect(layer).toBeTruthy();

    const handler = layer.route.stack[0].handle;
    const req: any = {
      params: { id: "123" },
      body: { notes: "Regenerate invalid approved draft" },
      session: { adminId: 27 },
      log: { info: vi.fn(), warn: vi.fn() },
    };
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
  });

  it("upserts ai_run_evaluations when rejecting a cover letter version", async () => {
    const { default: coverRouter } = await import("../cover-letter-versions");

    (await import("@workspace/db") as any).__approvalEvalCaptureTest.dbMock.select.mockReturnValueOnce({
      from() {
        return {
          where() {
            return [
              {
                id: 456,
                status: "pending_approval",
                jobId: 88,
                runId: "run_20250101t000000z_bbbbbbbbbbbb",
                eventLogId: 502,
              },
            ];
          },
        };
      },
    });

    const layer = (coverRouter as any).stack.find(
      (l: any) => l.route?.path === "/cover-letter-versions/:id/reject" && l.route?.methods?.post,
    );
    expect(layer).toBeTruthy();

    const handler = layer.route.stack[0].handle;
    const req: any = {
      params: { id: "456" },
      body: { editDistance: 0, notes: "Not usable" },
      session: { adminId: 27 },
      log: { info: vi.fn(), warn: vi.fn() },
    };
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);

    const { tx } = (await import("@workspace/db") as any).__approvalEvalCaptureTest;

    const valuesCalls = tx.insert.mock.results
      .map((r: any) => r.value?.values?.mock?.calls ?? [])
      .flat();
    const flattened = valuesCalls.map((c: any) => c[0]);
    const evaluationInsert = flattened.find(
      (v: any) => v && v.runId && v.taskScope === "cover_letter_review" && v.approvalOutcome,
    );

    expect(evaluationInsert).toBeTruthy();
    expect(evaluationInsert.approvalOutcome).toBe("rejected");
    expect(evaluationInsert.userId).toBe(27);
    expect(evaluationInsert.editDistance).toBe(0);
    expect(evaluationInsert.notes).toBe("Not usable");
  });
});
