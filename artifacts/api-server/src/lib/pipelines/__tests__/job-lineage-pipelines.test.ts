import { beforeEach, describe, expect, it, vi } from "vitest";

const resumeInsertValuesMock = vi.fn();
const coverInsertValuesMock = vi.fn();
const dbInsertMock = vi.fn((table: unknown) => {
  if (table === resumeVersionsTableMock) {
    return { values: resumeInsertValuesMock };
  }
  if (table === coverLetterVersionsTableMock) {
    return { values: coverInsertValuesMock };
  }
  throw new Error("Unexpected insert table");
});
const dbSelectWhereMock = vi.fn();
const dbSelectFromMock = vi.fn(() => ({ where: dbSelectWhereMock }));
const dbSelectMock = vi.fn(() => ({ from: dbSelectFromMock }));

const resumeVersionsTableMock = { $inferSelect: {}, id: "resume-id" };
const coverLetterVersionsTableMock = { $inferSelect: {}, id: "cover-id" };
const baseResumeVersionsTableMock = { isCurrent: "isCurrent" };

const callAIMock = vi.fn();
const parseJsonResponseMock = vi.fn();
const matchClaimsToJobMock = vi.fn();
const validateBulletMock = vi.fn();
const validateParagraphMock = vi.fn();
const assertMinimumContentMock = vi.fn();
const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

class TruthLockViolation extends Error {
  details: Record<string, unknown>;
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "TruthLockViolation";
    this.details = details;
  }
}

vi.mock("@workspace/db", () => ({
  db: {
    insert: dbInsertMock,
    select: dbSelectMock,
  },
  resumeVersionsTable: resumeVersionsTableMock,
  coverLetterVersionsTable: coverLetterVersionsTableMock,
  baseResumeVersionsTable: baseResumeVersionsTableMock,
}));

vi.mock("../ai-client", () => ({
  callAI: callAIMock,
  parseJsonResponse: parseJsonResponseMock,
}));

vi.mock("../scoring", () => ({
  matchClaimsToJob: matchClaimsToJobMock,
}));

vi.mock("../logger", () => ({
  logger: loggerMock,
}));

vi.mock("../validation", () => ({
  validateBullet: validateBulletMock,
  validateParagraph: validateParagraphMock,
  assertMinimumContent: assertMinimumContentMock,
  TruthLockViolation,
}));

describe("job lineage pipelines", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    dbSelectWhereMock.mockResolvedValue([{ id: 5, contentText: "Base resume text" }]);
    resumeInsertValuesMock.mockReturnValue({ returning: async () => [{ id: 901 }] });
    coverInsertValuesMock.mockReturnValue({ returning: async () => [{ id: 902 }] });
    matchClaimsToJobMock.mockReturnValue([]);
  });

  it("persists the callAI runId and eventLogId on successful resume generations", async () => {
    callAIMock.mockResolvedValue({
      content: '{"documentText":"Tailored","bullets":[{"text":"Bullet","claimIds":[1],"section":"experience","isAggregated":false,"originalText":"Orig"}],"summary":"Done"}',
      modelName: "test/model",
      provider: "openrouter",
      taskScope: "resume_tailoring",
      promptTokens: 10,
      completionTokens: 20,
      promptVersionId: 12,
      runId: "run_resume_success_1234567890",
      eventLogId: 321,
    });
    parseJsonResponseMock.mockReturnValue({
      documentText: "Tailored",
      bullets: [{ text: "Bullet", claimIds: [1], section: "experience", isAggregated: false, originalText: "Orig" }],
      addedBullets: [],
      removedBullets: [],
      reorderedSections: [],
      summary: "Done",
    });
    validateBulletMock.mockImplementation((bullet) => bullet);
    assertMinimumContentMock.mockImplementation(() => undefined);

    const { runResumeTailorPipeline } = await import("../resume-tailor");
  });

  it("persists lineage on resume truth-lock failures so failed generations remain diagnosable", async () => {
    callAIMock.mockResolvedValue({
      content: '{"documentText":"Tailored","bullets":[{"text":"Bad","claimIds":[999],"section":"experience","isAggregated":false,"originalText":"Orig"}]}',
      modelName: "test/model",
      provider: "openrouter",
      taskScope: "resume_tailoring",
      promptTokens: 10,
      completionTokens: 20,
      promptVersionId: 12,
      runId: "run_resume_failure_1234567890",
      eventLogId: 654,
    });
    parseJsonResponseMock.mockReturnValue({
      documentText: "Tailored",
      bullets: [{ text: "Bad", claimIds: [999], section: "experience", isAggregated: false, originalText: "Orig" }],
    });
    validateBulletMock.mockReturnValue(null);
    assertMinimumContentMock.mockImplementation(() => {
      throw new TruthLockViolation("zero valid bullets", { discarded: 1 });
    });

    const { runResumeTailorPipeline } = await import("../resume-tailor");

    await runResumeTailorPipeline(
      { id: 11, title: "Engineer", company: "Acme" } as never,
      [{ id: 1, summary: "Built feature", evidence: null } as never],
      [1],
    );

    const inserted = resumeInsertValuesMock.mock.calls.at(-1)?.[0];
    expect(inserted.label).toContain("truth lock failure");
    expect(inserted.runId).toBe("run_resume_failure_1234567890");
    expect(inserted.eventLogId).toBe(654);
  });

  it("persists the callAI runId and eventLogId on successful cover-letter generations", async () => {
    callAIMock.mockResolvedValue({
      content: '{"subject":"Application","paragraphs":[{"text":"Intro","claimIds":[1],"role":"body"}],"fullText":"Intro"}',
      modelName: "test/model",
      provider: "openrouter",
      taskScope: "cover_letter",
      promptTokens: 10,
      completionTokens: 20,
      promptVersionId: 12,
      runId: "run_cover_success_1234567890",
      eventLogId: 987,
    });
    parseJsonResponseMock.mockReturnValue({
      subject: "Application",
      paragraphs: [{ text: "Intro", claimIds: [1], role: "body" }],
      fullText: "Intro",
    });
    validateParagraphMock.mockImplementation((paragraph) => paragraph);
    assertMinimumContentMock.mockImplementation(() => undefined);

    const { runCoverLetterPipeline } = await import("../cover-letter-draft");

    await runCoverLetterPipeline(
      { id: 22, title: "Engineer", company: "Acme", location: null, remoteType: null } as never,
      null,
      [{ id: 1, summary: "Built feature", evidence: null } as never],
      [1],
    );

    const inserted = coverInsertValuesMock.mock.calls.at(-1)?.[0];
    expect(inserted.runId).toBe("run_cover_success_1234567890");
    expect(inserted.eventLogId).toBe(987);
  });

  it("persists lineage on malformed cover-letter generations", async () => {
    callAIMock.mockResolvedValue({
      content: "not valid json",
      modelName: "test/model",
      provider: "openrouter",
      taskScope: "cover_letter",
      promptTokens: 10,
      completionTokens: 20,
      promptVersionId: 12,
      runId: "run_cover_failure_1234567890",
      eventLogId: 222,
    });
    parseJsonResponseMock.mockReturnValue(null);

    const { runCoverLetterPipeline } = await import("../cover-letter-draft");

    await runCoverLetterPipeline(
      { id: 22, title: "Engineer", company: "Acme", location: null, remoteType: null } as never,
      null,
      [{ id: 1, summary: "Built feature", evidence: null } as never],
      [1],
    );

    const inserted = coverInsertValuesMock.mock.calls.at(-1)?.[0];
    expect(inserted.label).toContain("generation failed");
    expect(inserted.runId).toBe("run_cover_failure_1234567890");
    expect(inserted.eventLogId).toBe(222);
  });
});
