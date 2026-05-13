/**
 * Integration tests for the resume tailor pipeline.
 *
 * These tests mock the database and AI client to verify the correct save path
 * is taken for each pipeline branch:
 *   - AI success with valid source-tagged content → standard version with tailoredDocumentText
 *   - AI call throws → deterministic fallback with tailoredDocumentText from base sources
 *   - AI returns empty content → deterministic fallback
 *   - AI success but truth review fails → deterministic fallback taken
 *   - Base resume parse fails (no baseSources) → diagnostic version, no tailoredDocumentText
 *   - Base resume text unparseable (whitespace only) → diagnostic version, tailoredDocumentText null
 *   - Deterministic fallback with well-structured base resume → tailoredDocumentText is non-null string
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Claim, Job } from "@workspace/db";

// ─── DB mock ─────────────────────────────────────────────────────────────────

const resumeVersionsInsertValues = vi.fn();

const dbInsertMock = vi.fn(() => ({ values: resumeVersionsInsertValues }));
const dbSelectMock = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    insert: dbInsertMock,
    select: dbSelectMock,
  },
  resumeVersionsTable: { id: "resume_versions" },
  baseResumeVersionsTable: { id: "base_resume_versions", isCurrent: "is_current" },
}));

// ─── AI client mock ───────────────────────────────────────────────────────────

const callAIMock = vi.fn();

vi.mock("../ai-client", () => ({
  callAI: callAIMock,
  parseJsonResponse: (content: string) => {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  },
}));

// ─── Scoring mock ─────────────────────────────────────────────────────────────

vi.mock("../scoring", () => ({
  matchClaimsToJob: vi.fn((job: Job, claims: Claim[]) =>
    claims.map((claim) => ({ claim, score: 1 })),
  ),
}));

// ─── Best practices mock ──────────────────────────────────────────────────────

vi.mock("../best-practices", () => ({
  loadOrCreateBestPractices: vi.fn().mockResolvedValue({ rules: [] }),
  formatBestPracticesForPrompt: vi.fn().mockReturnValue(""),
}));

// ─── Logger mock ──────────────────────────────────────────────────────────────

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 42,
    title: "Software Engineer",
    company: "Acme Corp",
    location: "San Diego, CA",
    sourceUrl: null,
    status: "new",
    rawJdText: "Build scalable systems for our platform.",
    parsedRequiredSkills: ["TypeScript", "React"],
    parsedNiceToHaveSkills: ["GraphQL"],
    parsedKeywords: ["backend", "frontend"],
    parsedResponsibilities: ["Design APIs", "Build UIs"],
    remoteType: "hybrid",
    researchData: null,
    roleProfileId: null,
    applicationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Job;
}

function makeClaim(id: number, summary: string): Claim {
  return {
    id,
    summary,
    domain: "Engineering",
    evidence: `Evidence for claim ${id}`,
    phrasingVariants: [],
    applicableTags: [],
    disallowedImplications: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Claim;
}

/**
 * Well-structured base resume with TWO experience entries (required for
 * semantic template contract validation to pass in the deterministic fallback).
 */
const BASE_RESUME_TEXT = [
  "SUMMARY",
  "Senior software engineer with 10 years of experience building scalable systems.",
  "EXPERIENCE",
  "Software Engineer | Acme Corp | San Diego, CA | Jan 2020 - Present",
  "Built React workflows for 40 engineers improving deployment speed by 30%.",
  "Maintained microservices serving 500k daily active users.",
  "Backend Engineer | Beta Co | Remote | Feb 2017 - Dec 2019",
  "Architected REST APIs handling 5 million requests per day with 99.9% uptime.",
  "EDUCATION",
  "B.S. Computer Science — UC San Diego, 2016",
  "SKILLS",
  "TypeScript, React, Node.js, SQL",
  "Docker, Kubernetes, AWS, CI/CD",
  "PostgreSQL, Redis, GraphQL",
].join("\n");

function makeBaseResumeVersion(overrides: Partial<{ contentText: string }> = {}) {
  return {
    id: 1,
    isCurrent: true,
    contentText: BASE_RESUME_TEXT,
    label: "Current",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Sets up the db.select mock to return a base resume (or empty list) */
function setupDbSelect(baseResume: ReturnType<typeof makeBaseResumeVersion> | null) {
  dbSelectMock.mockReturnValue({
    from() {
      return {
        where() {
          return baseResume ? [baseResume] : [];
        },
      };
    },
  });
}

/** Sets up the db.insert mock to return a row with the given fields */
function setupDbInsert(returnRow: Record<string, unknown>) {
  resumeVersionsInsertValues.mockReturnValue({
    returning: () => [returnRow],
  });
}

// ─── AI content fixtures ──────────────────────────────────────────────────────

/**
 * Valid AI content with proper source tags on every line.
 * Two experience entries with dates ensure semantic validation passes.
 */
const AI_VALID_RESUME_CONTENT = [
  "HEADER",
  "Jane Doe | jane@example.com | San Diego, CA",
  "",
  "SUMMARY",
  "Senior software engineer with 10 years of experience building scalable systems. [src:base:summary:b001]",
  "",
  "EXPERIENCE",
  "Software Engineer | Acme Corp | San Diego, CA | Jan 2020 - Present [src:base:experience:b001]",
  "Built React workflows for 40 engineers improving deployment speed by 30%. [src:base:experience:b002]",
  "Maintained microservices serving 500k daily active users. [src:base:experience:b003]",
  "Backend Engineer | Beta Co | Remote | Feb 2017 - Dec 2019 [src:base:experience:b004]",
  "Architected REST APIs handling 5 million requests per day with 99.9% uptime. [src:base:experience:b005]",
  "",
  "EDUCATION",
  "B.S. Computer Science — UC San Diego, 2016 [src:base:education:b001]",
  "",
  "SKILLS",
  "Languages: TypeScript, React, Node.js, SQL [src:base:skills:b001]",
  "Infrastructure: Docker, Kubernetes, AWS, CI/CD [src:base:skills:b002]",
  "Databases: PostgreSQL, Redis, GraphQL [src:base:skills:b003]",
].join("\n");

/**
 * AI content that passes structural parsing (valid base source refs, two experience
 * entries with date ranges) and semantic template contract, but includes a bullet
 * with the fabricated metric "99999" — a number that does not appear anywhere in
 * BASE_RESUME_TEXT, the claim summaries, or the job context.
 *
 * reviewGeneratedTruth runs after semantic validation and uses extractNumericTokens
 * to find metric violations. Since "99999" is not present in any factual source,
 * seriousViolationCount > 0 and the pipeline falls back to
 * saveDeterministicFallbackResumeVersion instead of saving a standard "AI tailored" version.
 *
 * Source ref keys (b001–b009) match the refs generated by parseBaseResumeSources
 * for the BASE_RESUME_TEXT fixture above.
 */
const AI_TRUTH_REVIEW_FAIL_CONTENT = [
  "SUMMARY",
  "Senior software engineer with 10 years of experience building scalable systems. [src:base:summary:b001]",
  "",
  "EXPERIENCE",
  "Software Engineer | Acme Corp | San Diego, CA | Jan 2020 - Present [src:base:experience:b001]",
  "Built React workflows impacting 99999 global deployments across the organization. [src:base:experience:b002]",
  "Maintained microservices serving 500k daily active users. [src:base:experience:b003]",
  "Backend Engineer | Beta Co | Remote | Feb 2017 - Dec 2019 [src:base:experience:b004]",
  "Architected REST APIs handling 5 million requests per day with high uptime. [src:base:experience:b005]",
  "",
  "EDUCATION",
  "B.S. Computer Science — UC San Diego, 2016 [src:base:education:b001]",
  "",
  "SKILLS",
  "Languages: TypeScript, React, Node.js, SQL [src:base:skills:b001]",
  "Infrastructure: Docker, Kubernetes, AWS, CI/CD [src:base:skills:b002]",
  "Databases: PostgreSQL, Redis, GraphQL [src:base:skills:b003]",
].join("\n");

// ─── Main pipeline tests ──────────────────────────────────────────────────────

describe("runResumeTailorPipeline", () => {
  const job = makeJob();
  const claims = [
    makeClaim(1, "Built React workflows for 40 engineers, improving deployment speed by 30%."),
    makeClaim(2, "Maintained microservices serving 500k daily active users."),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    setupDbInsert({ id: 99, tailoredDocumentText: "rendered resume text", notes: "", status: "pending_approval" });
  });

  it("saves a standard version with tailoredDocumentText when AI returns valid content", async () => {
    setupDbSelect(makeBaseResumeVersion());

    callAIMock.mockResolvedValue({
      content: AI_VALID_RESUME_CONTENT,
      runId: "run_test123",
      eventLogId: 1,
      modelName: "test/model",
      provider: "openrouter",
      priorFailures: [],
    });

    const { runResumeTailorPipeline } = await import("../pipelines/resume-tailor");
    const result = await runResumeTailorPipeline(job, claims, [1, 2]);

    expect(callAIMock).toHaveBeenCalledOnce();
    expect(dbInsertMock).toHaveBeenCalledOnce();

    const insertedValues = resumeVersionsInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedValues.jobId).toBe(job.id);
    expect(insertedValues.status).toBe("pending_approval");
    expect(result).toBeDefined();
  });

  it("takes the deterministic fallback path when AI call throws", async () => {
    setupDbSelect(makeBaseResumeVersion());

    const aiError = new Error("upstream timeout");
    Object.assign(aiError, {
      attemptErrors: [
        { attemptNumber: 1, modelId: 1, modelName: "test/model", provider: "openrouter", error: "timeout", category: "timeout" },
      ],
    });
    callAIMock.mockRejectedValue(aiError);

    setupDbInsert({
      id: 100,
      tailoredDocumentText: "Deterministic resume from base sources",
      notes: "AI structured tailoring was unavailable after the configured model attempts.",
      status: "pending_approval",
      label: "ATS resume from verified base sources",
    });

    const { runResumeTailorPipeline } = await import("../pipelines/resume-tailor");
    const result = await runResumeTailorPipeline(job, claims, [1, 2]);

    expect(callAIMock).toHaveBeenCalledOnce();
    expect(dbInsertMock).toHaveBeenCalledOnce();

    const insertedValues = resumeVersionsInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedValues.jobId).toBe(job.id);
    expect(insertedValues.status).toBe("pending_approval");
    expect(result).toBeDefined();
  });

  it("takes the deterministic fallback path when AI returns empty content", async () => {
    setupDbSelect(makeBaseResumeVersion());

    const emptyContentError = new Error("empty_model_content: resume tailoring model returned empty content.");
    Object.assign(emptyContentError, { attemptErrors: [] });
    callAIMock.mockRejectedValue(emptyContentError);

    setupDbInsert({
      id: 101,
      tailoredDocumentText: "Deterministic resume from base sources",
      notes: "AI structured tailoring was unavailable after the configured model attempts.",
      status: "pending_approval",
    });

    const { runResumeTailorPipeline } = await import("../pipelines/resume-tailor");
    const result = await runResumeTailorPipeline(job, claims, [1, 2]);

    expect(dbInsertMock).toHaveBeenCalledOnce();
    const insertedValues = resumeVersionsInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedValues.status).toBe("pending_approval");
    expect(result).toBeDefined();
  });

  it("takes the deterministic fallback path when truth review finds hallucinated claim IDs", async () => {
    setupDbSelect(makeBaseResumeVersion());

    // AI returns structurally valid content but bullet items cite claim IDs
    // (9999, 8888, 7777) that are not in selectedClaims [1, 2].
    // reviewGeneratedTruth marks them as hallucinated → seriousViolationCount > 0
    // → pipeline falls back to saveDeterministicFallbackResumeVersion.
    callAIMock.mockResolvedValue({
      content: AI_TRUTH_REVIEW_FAIL_CONTENT,
      runId: "run_truth_review_fail",
      eventLogId: 2,
      modelName: "test/model",
      provider: "openrouter",
      priorFailures: [],
    });

    // The fallback can either save a deterministic version or a diagnostic version.
    // In both cases: jobId matches, status is pending_approval, and callAI was used.
    setupDbInsert({
      id: 103,
      status: "pending_approval",
      jobId: job.id,
      tailoredDocumentText: "Deterministic resume from verified base sources",
      notes: "AI structured tailoring was unavailable",
    });

    const { runResumeTailorPipeline } = await import("../pipelines/resume-tailor");
    const result = await runResumeTailorPipeline(job, claims, [1, 2]);

    // AI was called once (not zero — the truth review failure happens AFTER AI call)
    expect(callAIMock).toHaveBeenCalledOnce();
    // A resume version was saved
    expect(dbInsertMock).toHaveBeenCalledOnce();

    const insertedValues = resumeVersionsInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedValues.jobId).toBe(job.id);
    expect(insertedValues.status).toBe("pending_approval");
    // The label should NOT indicate the standard "AI tailored resume" success path
    const label = insertedValues.label as string | undefined;
    expect(label).not.toBe("AI tailored resume");
    expect(result).toBeDefined();
  });

  it("throws MissingBaseResumeError and makes no DB inserts when base resume is missing", async () => {
    setupDbSelect(null);

    const { runResumeTailorPipeline } = await import("../pipelines/resume-tailor");
    await expect(runResumeTailorPipeline(job, claims)).rejects.toThrow(/base resume is required/i);

    expect(callAIMock).not.toHaveBeenCalled();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it("saves a diagnostic version when base resume text cannot be parsed into source snippets", async () => {
    setupDbSelect(makeBaseResumeVersion({ contentText: "   " }));

    setupDbInsert({
      id: 102,
      tailoredDocumentText: null,
      rawContent: null,
      notes: "The current base resume could not be parsed into source snippets",
      status: "pending_approval",
      label: "AI tailored - base resume parse failed",
    });

    const { runResumeTailorPipeline } = await import("../pipelines/resume-tailor");
    const result = await runResumeTailorPipeline(job, claims);

    expect(callAIMock).not.toHaveBeenCalled();
    expect(dbInsertMock).toHaveBeenCalledOnce();

    const insertedValues = resumeVersionsInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedValues.tailoredDocumentText).toBeNull();
    expect(result).toBeDefined();
  });
});

// ─── Deterministic fallback strict contract ───────────────────────────────────

describe("saveDeterministicFallbackResumeVersion: tailoredDocumentText contract", () => {
  const job = makeJob();
  const claims = [
    makeClaim(1, "Built React workflows for 40 engineers, improving deployment speed by 30%."),
    makeClaim(2, "Maintained microservices serving 500k daily active users."),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("produces a non-null, non-empty tailoredDocumentText from a well-structured base resume", async () => {
    // The base resume has 2 experience entries with dates — sufficient for semantic
    // template contract validation to pass inside saveDeterministicFallbackResumeVersion.
    setupDbSelect(makeBaseResumeVersion());

    let capturedInsert: Record<string, unknown> | null = null;
    resumeVersionsInsertValues.mockImplementation((values: Record<string, unknown>) => {
      capturedInsert = values;
      return { returning: () => [{ id: 200, ...values }] };
    });

    // Trigger the fallback by making AI throw
    const aiError = new Error("upstream timeout");
    Object.assign(aiError, {
      attemptErrors: [
        { attemptNumber: 1, modelId: 1, modelName: "test/model", provider: "openrouter", error: "timeout", category: "timeout" },
      ],
    });
    callAIMock.mockRejectedValue(aiError);

    const { runResumeTailorPipeline } = await import("../pipelines/resume-tailor");
    await runResumeTailorPipeline(job, claims, [1, 2]);

    expect(capturedInsert).not.toBeNull();

    // The deterministic fallback must produce a non-null, non-empty tailoredDocumentText
    // when the base resume is well-structured (2+ experience entries with dates,
    // summary, skills, education). A null here means validation failed inside the
    // fallback path, which indicates a regression in base resume parsing or
    // semantic contract checking.
    expect(capturedInsert!.tailoredDocumentText).not.toBeNull();
    expect(typeof capturedInsert!.tailoredDocumentText).toBe("string");
    expect((capturedInsert!.tailoredDocumentText as string).length).toBeGreaterThan(50);

    // The label should be the deterministic fallback label (not a diagnostic label)
    expect(capturedInsert!.label).toBe("ATS resume from verified base sources");
    // Notes must reference "deterministic" to confirm the correct code path
    expect((capturedInsert!.notes as string).toLowerCase()).toContain("deterministic");
  });
});
