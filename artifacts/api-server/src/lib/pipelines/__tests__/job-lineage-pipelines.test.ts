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
const validateResumeQualityMock = vi.fn();
const validateCoverLetterQualityMock = vi.fn();
const validateSemanticQualityMock = vi.fn();
const reviewGeneratedTruthMock = vi.fn();
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

vi.mock("../../ai-client", () => ({
  callAI: callAIMock,
  parseJsonResponse: parseJsonResponseMock,
}));

vi.mock("../../scoring", () => ({
  matchClaimsToJob: matchClaimsToJobMock,
}));

vi.mock("../../logger", () => ({
  logger: loggerMock,
}));

vi.mock("../../best-practices", () => ({
  loadOrCreateBestPractices: vi.fn(async () => ({
    domain: "test",
    title: "Test practices",
    items: [],
    hardcodedGuards: {},
  })),
  formatBestPracticesForPrompt: vi.fn(() => ""),
}));

vi.mock("../validation", () => ({
  validateBullet: validateBulletMock,
  validateParagraph: validateParagraphMock,
  assertMinimumContent: assertMinimumContentMock,
  validateResumeQuality: validateResumeQualityMock,
  validateCoverLetterQuality: validateCoverLetterQualityMock,
  validateSemanticQuality: validateSemanticQualityMock,
  reviewGeneratedTruth: reviewGeneratedTruthMock,
  stripClaimIdRefs: (text: string) => text,
  TruthLockViolation,
}));

describe("job lineage pipelines", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    dbSelectWhereMock.mockResolvedValue([{
      id: 5,
      contentText: [
        "CYRUS SEPASI",
        "cyrus@example.com",
        "SUMMARY",
        "Senior instructional designer with 13 years of experience.",
        "EXPERIENCE",
        "Senior Instructional Designer | Acme Health | San Diego, CA | Jan 2021 - Present",
        "Led learning deployments for healthcare teams.",
        "Built SCORM/xAPI solutions and maintained LMS tracking quality.",
        "Instructional Designer | Beta Learning | Remote | Feb 2018 - Dec 2020",
        "Designed blended programs and stakeholder reviews.",
        "EDUCATION",
        "M.P.A. Cybersecurity Concentration - CSU San Bernardino",
        "B.A. Psychology - CSU Stanislaus",
        "SKILLS",
        "Instructional Design: ADDIE, SAM, Agile",
        "Tools: Storyline, Captivate, SCORM/xAPI, LMS",
      ].join("\n"),
    }]);
    resumeInsertValuesMock.mockReturnValue({ returning: async () => [{ id: 901 }] });
    coverInsertValuesMock.mockReturnValue({ returning: async () => [{ id: 902 }] });
    matchClaimsToJobMock.mockReturnValue([]);
  });

  it("persists the callAI runId and eventLogId on successful resume generations", async () => {
    callAIMock.mockResolvedValue({
      content: [
        "SUMMARY",
        "Senior instructional designer with 13 years delivering enterprise learning systems. [src:base:summary:b001]",
        "EXPERIENCE",
        "Senior Instructional Designer | Acme Health | San Diego, CA | Jan 2021 - Present [src:base:experience:b001]",
        "Led learning deployments for healthcare teams. [src:base:experience:b002]",
        "Built SCORM/xAPI solutions and maintained LMS tracking quality. [src:base:experience:b003]",
        "Instructional Designer | Beta Learning | Remote | Feb 2018 - Dec 2020 [src:base:experience:b004]",
        "Designed blended programs and stakeholder reviews. [src:base:experience:b005]",
        "EDUCATION",
        "M.P.A. Cybersecurity Concentration - CSU San Bernardino [src:base:education:b001]",
        "B.A. Psychology - CSU Stanislaus [src:base:education:b002]",
        "SKILLS",
        "Instructional Design: ADDIE, SAM, Agile [src:base:skills:b001]",
        "Tools: Storyline, Captivate, SCORM/xAPI, LMS [src:base:skills:b002]",
      ].join("\n"),
      modelName: "test/model",
      provider: "openrouter",
      taskScope: "resume_tailoring",
      promptTokens: 10,
      completionTokens: 20,
      promptVersionId: 12,
      runId: "run_resume_success_1234567890",
      eventLogId: 321,
    });
    parseJsonResponseMock.mockReturnValue(null);
    validateBulletMock.mockImplementation((bullet) => bullet);
    assertMinimumContentMock.mockImplementation(() => undefined);
    validateResumeQualityMock.mockImplementation(() => undefined);
    validateSemanticQualityMock.mockResolvedValue(undefined);
    reviewGeneratedTruthMock.mockReturnValue({
      supportStatus: "supported",
      items: [{ supportStatus: "supported" }],
      unsupportedCount: 0,
      partialCount: 0,
      supportedCount: 1,
      seriousViolationCount: 0,
      sourcePolicy: "test",
    });

    const { runResumeTailorPipeline } = await import("../resume-tailor");

    await runResumeTailorPipeline(
      { id: 11, title: "Engineer", company: "Acme" } as never,
      [{ id: 1, summary: "Built feature", evidence: null } as never],
      [1],
    );

    const inserted = resumeInsertValuesMock.mock.calls.at(-1)?.[0];
    expect(inserted.runId).toBe("run_resume_success_1234567890");
    expect(inserted.eventLogId).toBe(321);
  });

  it("persists plain-text resume drafts without running a full-resume repair pass", async () => {
    callAIMock.mockResolvedValue({
      content: [
        "SUMMARY",
        "Senior Instructional Designer with 13+ years delivering enterprise learning systems. [src:claim:1]",
        "EXPERIENCE",
        "Senior Instructional Designer | Acme Health | San Diego, CA | Jan 2021 - Present [src:base:experience:b001]",
        "Led project delivery across learning deployments and stakeholder reviews. [src:claim:1]",
        "Built SCORM/xAPI solutions and maintained LMS tracking quality. [src:base:experience:b003]",
        "Instructional Designer | Beta Learning | Remote | Feb 2018 - Dec 2020 [src:base:experience:b004]",
        "Designed blended programs and stakeholder reviews. [src:base:experience:b005]",
        "EDUCATION",
        "M.P.A. Cybersecurity Concentration - CSU San Bernardino [src:base:education:b001]",
        "B.A. Psychology - CSU Stanislaus [src:base:education:b002]",
        "SKILLS",
        "Instructional Design: ADDIE, SAM, Agile [src:base:skills:b001]",
        "Tools: Storyline, Captivate, SCORM/xAPI, LMS [src:base:skills:b002]",
      ].join("\n"),
      modelName: "test/model",
      provider: "openrouter",
      taskScope: "resume_tailoring",
      promptTokens: 10,
      completionTokens: 20,
      promptVersionId: 12,
      runId: "run_resume_plan_1234567890",
      eventLogId: 321,
    });
    parseJsonResponseMock.mockReturnValue(null);
    validateBulletMock.mockImplementation((bullet) => bullet);
    assertMinimumContentMock.mockImplementation(() => undefined);
    validateResumeQualityMock.mockImplementation(() => undefined);
    validateSemanticQualityMock.mockResolvedValue(undefined);
    reviewGeneratedTruthMock.mockReturnValue({
      supportStatus: "supported",
      items: [{ supportStatus: "supported" }],
      unsupportedCount: 0,
      partialCount: 0,
      supportedCount: 1,
      seriousViolationCount: 0,
      sourcePolicy: "test",
    });

    const { runResumeTailorPipeline } = await import("../resume-tailor");

    await runResumeTailorPipeline(
      { id: 11, title: "Engineer", company: "Acme" } as never,
      [{ id: 1, summary: "Built feature", evidence: null } as never],
      [1],
    );

    expect(callAIMock).toHaveBeenCalledTimes(1);
    const inserted = resumeInsertValuesMock.mock.calls.at(-1)?.[0];
    expect(inserted.label).not.toContain("generation failed");
    expect(inserted.tailoredDocumentText).toContain("EXPERIENCE");
    expect(inserted.tailoredDocumentText).toContain("Led project delivery");
    expect(inserted.templateId).toBe("software_developer");
    expect(inserted.diffData.modelContract).toBe("resume_tailoring_plain_text_v1");
    expect(inserted.runId).toBe("run_resume_plan_1234567890");
    expect(inserted.eventLogId).toBe(321);
  });

  it("persists lineage on resume truth-lock failures so failed generations remain diagnosable", async () => {
    callAIMock.mockResolvedValue({
      content: "EXPERIENCE\nBad unsupported line. [src:claim:999]",
      modelName: "test/model",
      provider: "openrouter",
      taskScope: "resume_tailoring",
      promptTokens: 10,
      completionTokens: 20,
      promptVersionId: 12,
      runId: "run_resume_failure_1234567890",
      eventLogId: 654,
    });
    parseJsonResponseMock.mockReturnValue(null);
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
    expect(inserted.label).toContain("ATS resume from verified base sources");
    expect(inserted.runId).toBe("run_resume_failure_1234567890");
    expect(inserted.eventLogId).toBe(654);
  });

  it("saves a deterministic base-resume fallback when all model attempts fail the plain-text contract", async () => {
    dbSelectWhereMock.mockResolvedValueOnce([{
      id: 5,
      contentText: [
        "CYRUS SEPASI",
        "cyrus@example.com",
        "SUMMARY",
        "Senior instructional designer with 13 years of experience.",
        "EXPERIENCE",
        "Senior Instructional Designer | Acme Health | San Diego, CA | Jan 2021 - Present",
        "Led learning deployments for healthcare teams.",
        "Built SCORM/xAPI solutions and maintained LMS tracking quality.",
        "Instructional Designer | Beta Learning | Remote | Feb 2018 - Dec 2020",
        "Designed blended programs and stakeholder reviews.",
        "EDUCATION",
        "M.P.A. Cybersecurity Concentration - CSU San Bernardino",
        "B.A. Psychology - CSU Stanislaus",
        "SKILLS",
        "Instructional Design: ADDIE, SAM, Agile",
        "Tools: Storyline, Captivate, SCORM/xAPI, LMS",
      ].join("\n"),
    }]);
    callAIMock.mockRejectedValue(
      Object.assign(new Error("AI call failed after fallback chain"), {
        runId: "run_terminal_contract_failure_1234567890",
        eventLogId: 777,
        attemptErrors: [
          {
            attemptNumber: 1,
            modelId: 1,
            modelName: "test/model",
            provider: "openrouter",
            error: "structured JSON required",
            category: "content_contract",
            elapsedMs: 10,
          },
        ],
      }),
    );

    const { runResumeTailorPipeline } = await import("../resume-tailor");

    await runResumeTailorPipeline(
      { id: 11, title: "Engineer", company: "Acme" } as never,
      [{ id: 1, summary: "Built feature", evidence: null } as never],
      [1],
    );

    const inserted = resumeInsertValuesMock.mock.calls.at(-1)?.[0];
    expect(inserted.label).toContain("ATS resume from verified base sources");
    expect(inserted.tailoredDocumentText).toContain("Senior Instructional Designer | Acme Health");
    expect(inserted.diffData.aiAttemptSummary).toContain("test/model: content_contract");
    expect(inserted.runId).toBe("run_terminal_contract_failure_1234567890");
    expect(inserted.eventLogId).toBe(777);
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
    validateCoverLetterQualityMock.mockImplementation(() => undefined);
    validateSemanticQualityMock.mockResolvedValue(undefined);
    reviewGeneratedTruthMock.mockReturnValue({
      supportStatus: "supported",
      items: [{ supportStatus: "supported" }],
      unsupportedCount: 0,
      partialCount: 0,
      supportedCount: 1,
      seriousViolationCount: 0,
      sourcePolicy: "test",
    });

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
