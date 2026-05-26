/**
 * Integration tests for the cover letter drafting pipeline.
 *
 * These tests mock the database, AI client, scoring, best-practices, and the
 * quality-validation functions to verify the correct save path is taken for
 * each pipeline branch:
 *   - AI success with valid paragraphs → standard version with draftContent and annotatedParagraphs
 *   - AI call throws → generation-failed version with empty draftContent
 *   - AI returns unparseable JSON → generation-failed version storing raw content
 *   - All paragraphs cite hallucinated claim IDs → truth-lock failure version
 *   - No claims selected → no-claims version with descriptive notes
 *   - Quality violation → quality-check-failed version with violation notes
 *   - Role profile provided → callAI prompt includes role profile context
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Claim, Job, RoleProfile } from "@workspace/db";

// ─── DB mock ─────────────────────────────────────────────────────────────────

const coverLetterVersionsInsertValues = vi.fn();
const baseResumeVersionsSelectResult: Record<string, unknown>[] = [];

const dbInsertMock = vi.fn(() => ({ values: coverLetterVersionsInsertValues }));
const dbSelectMock = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    insert: dbInsertMock,
    select: dbSelectMock,
  },
  coverLetterVersionsTable: { id: "cover_letter_versions" },
  baseResumeVersionsTable: {
    id: "base_resume_versions",
    isCurrent: "is_current",
  },
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
  matchClaimsToJob: vi.fn((_job: Job, claims: Claim[]) =>
    claims.map((claim) => ({ claim, score: 1 })),
  ),
}));

// ─── Best practices mock ──────────────────────────────────────────────────────

vi.mock("../best-practices", () => ({
  loadOrCreateBestPractices: vi.fn().mockResolvedValue({
    domain: "cover_letter",
    title: "Cover Letter Best Practices",
    items: [],
    hardcodedGuards: {},
  }),
  formatBestPracticesForPrompt: vi.fn().mockReturnValue(""),
}));

// ─── Validation mock ──────────────────────────────────────────────────────────
//
// We override only the quality-validation functions so we can simulate a
// quality violation in a targeted test while keeping all other validation
// logic (validateParagraph, assertMinimumContent, reviewGeneratedTruth, etc.)
// real.  The mocks default to pass (no throw / resolve undefined) and are
// overridden per-test only where needed.

const validateCoverLetterQualityMock = vi.fn();
const validateSemanticQualityMock = vi.fn();

vi.mock("../pipelines/validation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../pipelines/validation")>();
  return {
    ...actual,
    validateCoverLetterQuality: validateCoverLetterQualityMock,
    validateSemanticQuality: validateSemanticQualityMock,
  };
});

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
    id: 55,
    title: "TypeScript Engineer",
    company: "StreamTech",
    location: "San Francisco, CA",
    sourceUrl: null,
    status: "new",
    rawJdText: "We need a TypeScript engineer to build React apps and REST APIs.",
    parsedRequiredSkills: ["TypeScript", "React", "Node.js"],
    parsedNiceToHaveSkills: [],
    parsedKeywords: ["frontend", "backend"],
    parsedResponsibilities: ["Build React apps", "Write REST APIs"],
    remoteType: "remote",
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
  } as unknown as Claim;
}

function makeBaseResumeVersion() {
  return {
    id: 1,
    isCurrent: true,
    contentText: [
      "SUMMARY",
      "Software engineer with 5 years TypeScript experience.",
      "EXPERIENCE",
      "Engineer | TechCo | Remote | Jan 2020 - Present",
      "Built scalable React dashboards used by 10,000 daily users.",
      "SKILLS",
      "TypeScript, React, Node.js, PostgreSQL",
    ].join("\n"),
    label: "Current",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function setupDbSelect(
  baseResume: ReturnType<typeof makeBaseResumeVersion> | null,
) {
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

function setupDbInsert(returnRow: Record<string, unknown>) {
  coverLetterVersionsInsertValues.mockReturnValue({
    returning: () => [returnRow],
  });
}

function makeValidAiResponse(claimId: number): string {
  return JSON.stringify({
    subject: `Application for TypeScript Engineer at StreamTech`,
    fullText:
      "Dear Hiring Manager,\n\nI am excited to apply for the TypeScript Engineer role at StreamTech. " +
      "With 5 years of TypeScript experience building React applications, I bring proven expertise " +
      "in building scalable frontend systems used daily by thousands of users.\n\n" +
      "I look forward to discussing how my background aligns with StreamTech's mission.\n\nSincerely, Jane Doe",
    paragraphs: [
      {
        text: "Dear Hiring Manager, I am excited to apply for the TypeScript Engineer role at StreamTech.",
        claimIds: [],
        role: "opening",
        jobKeywordsUsed: ["TypeScript Engineer"],
        companySourcesUsed: ["StreamTech"],
        gapNotes: [],
        sourceMap: { supportedPhrases: [], sourceClaimIds: [] },
      },
      {
        text: `With 5 years of TypeScript experience building React applications, I bring proven expertise in scalable frontend systems used daily by thousands of users.`,
        claimIds: [claimId],
        role: "body",
        jobKeywordsUsed: ["TypeScript", "React"],
        companySourcesUsed: [],
        gapNotes: [],
        sourceMap: {
          supportedPhrases: ["5 years of TypeScript experience"],
          sourceClaimIds: [claimId],
        },
      },
      {
        text: "I look forward to discussing how my background aligns with StreamTech's mission.",
        claimIds: [],
        role: "closing",
        jobKeywordsUsed: [],
        companySourcesUsed: ["StreamTech"],
        gapNotes: [],
        sourceMap: { supportedPhrases: [], sourceClaimIds: [] },
      },
    ],
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runCoverLetterPipeline", () => {
  const job = makeJob();
  const claims = [
    makeClaim(
      10,
      "Built scalable React dashboards used by 10,000 daily active users.",
    ),
    makeClaim(
      11,
      "Delivered TypeScript REST APIs serving 500 requests per second.",
    ),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Quality validators pass by default — override per-test when needed
    validateCoverLetterQualityMock.mockReturnValue(undefined);
    validateSemanticQualityMock.mockResolvedValue(undefined);
    setupDbSelect(makeBaseResumeVersion());
    setupDbInsert({
      id: 200,
      status: "pending_approval",
      draftContent: "cover letter text",
      annotatedParagraphs: [],
    });
  });

  it("saves a version with draftContent and annotatedParagraphs when AI returns valid paragraphs", async () => {
    callAIMock.mockResolvedValue({
      content: makeValidAiResponse(10),
      runId: "run_cl_test",
      eventLogId: 5,
      modelName: "test/model",
      provider: "openrouter",
      priorFailures: [],
    });

    const { runCoverLetterPipeline } = await import(
      "../pipelines/cover-letter-draft"
    );
    const result = await runCoverLetterPipeline(job, null, claims, [10, 11]);

    expect(callAIMock).toHaveBeenCalledOnce();
    expect(dbInsertMock).toHaveBeenCalledOnce();

    const inserted = coverLetterVersionsInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.jobId).toBe(job.id);
    expect(inserted.status).toBe("pending_approval");
    expect(result).toBeDefined();
    expect(result.id).toBe(200);
  });

  it("saves a generation-failed version with empty draftContent when callAI throws", async () => {
    const aiError = new Error("model quota exceeded");
    Object.assign(aiError, {
      runId: "run_failed_001",
      eventLogId: 6,
      attemptErrors: [
        {
          attemptNumber: 1,
          modelName: "test/model",
          provider: "openrouter",
          error: "quota exceeded",
          category: "rate_limit",
        },
      ],
    });
    callAIMock.mockRejectedValue(aiError);

    setupDbInsert({
      id: 201,
      status: "pending_approval",
      label: "AI drafted — generation failed",
      draftContent: "",
      annotatedParagraphs: [],
    });

    const { runCoverLetterPipeline } = await import(
      "../pipelines/cover-letter-draft"
    );
    const result = await runCoverLetterPipeline(job, null, claims, [10, 11]);

    expect(callAIMock).toHaveBeenCalledOnce();
    expect(dbInsertMock).toHaveBeenCalledOnce();

    const inserted = coverLetterVersionsInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.label).toBe("AI drafted — generation failed");
    expect(inserted.draftContent).toBe("");
    expect(inserted.status).toBe("pending_approval");
    expect(result.id).toBe(201);
  });

  it("saves a generation-failed version storing raw content when AI returns unparseable JSON", async () => {
    callAIMock.mockResolvedValue({
      content: "This is not valid JSON at all",
      runId: "run_cl_bad_json",
      eventLogId: 7,
      modelName: "test/model",
      provider: "openrouter",
      priorFailures: [],
    });

    setupDbInsert({
      id: 202,
      status: "pending_approval",
      label: "AI drafted — generation failed",
      draftContent: "This is not valid JSON at all",
      annotatedParagraphs: [],
    });

    const { runCoverLetterPipeline } = await import(
      "../pipelines/cover-letter-draft"
    );
    const result = await runCoverLetterPipeline(job, null, claims, [10, 11]);

    expect(dbInsertMock).toHaveBeenCalledOnce();
    const inserted = coverLetterVersionsInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.label).toBe("AI drafted — generation failed");
    expect(inserted.draftContent).toBe("This is not valid JSON at all");
    expect(result.id).toBe(202);
  });

  it("saves a truth-lock failure version when all paragraphs cite hallucinated claim IDs", async () => {
    // All paragraphs are body/hook with claim IDs not in selectedClaims [10, 11].
    // validateParagraph drops them all → assertMinimumContent throws TruthLockViolation.
    const hallucinated = JSON.stringify({
      subject: "Application for TypeScript Engineer at StreamTech",
      fullText: "Cover letter with hallucinated claims only.",
      paragraphs: [
        {
          text: "I have extensive experience with quantum computing and blockchain AI, leading teams of 500 engineers across three continents.",
          claimIds: [9999, 8888],
          role: "body",
          jobKeywordsUsed: ["TypeScript"],
          companySourcesUsed: [],
          gapNotes: [],
          sourceMap: { supportedPhrases: ["quantum computing"], sourceClaimIds: [9999] },
        },
        {
          text: "I spearheaded the Apollo mission software stack using proprietary frameworks with guaranteed uptime.",
          claimIds: [7777],
          role: "hook",
          jobKeywordsUsed: ["React"],
          companySourcesUsed: [],
          gapNotes: [],
          sourceMap: { supportedPhrases: ["Apollo mission software"], sourceClaimIds: [7777] },
        },
        {
          text: "My patented AI system eliminated errors across all global offices simultaneously.",
          claimIds: [6666],
          role: "body",
          jobKeywordsUsed: ["Node.js"],
          companySourcesUsed: [],
          gapNotes: [],
          sourceMap: { supportedPhrases: ["patented AI system"], sourceClaimIds: [6666] },
        },
      ],
    });

    callAIMock.mockResolvedValue({
      content: hallucinated,
      runId: "run_cl_hallucinated",
      eventLogId: 8,
      modelName: "test/model",
      provider: "openrouter",
      priorFailures: [],
    });

    setupDbInsert({
      id: 203,
      status: "pending_approval",
      label: "AI drafted — truth lock failure",
      draftContent: hallucinated,
      annotatedParagraphs: [],
    });

    const { runCoverLetterPipeline } = await import(
      "../pipelines/cover-letter-draft"
    );
    const result = await runCoverLetterPipeline(job, null, claims, [10, 11]);

    expect(dbInsertMock).toHaveBeenCalledOnce();
    const inserted = coverLetterVersionsInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.label).toBe("AI drafted — truth lock failure");
    expect(result.id).toBe(203);
  });

  it("saves a no-claims version when no claims are available for the job", async () => {
    setupDbInsert({
      id: 204,
      status: "pending_approval",
      label: "AI drafted — no claims available",
      draftContent: "",
      annotatedParagraphs: [],
      notes: "No matching claims found. Add claims to your Claims Ledger first.",
    });

    const { runCoverLetterPipeline } = await import(
      "../pipelines/cover-letter-draft"
    );
    const result = await runCoverLetterPipeline(job, null, [], []);

    expect(callAIMock).not.toHaveBeenCalled();
    expect(dbInsertMock).toHaveBeenCalledOnce();

    const inserted = coverLetterVersionsInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.label).toBe("AI drafted — no claims available");
    expect(inserted.claimIds).toEqual([]);
    expect(typeof inserted.notes).toBe("string");
    expect((inserted.notes as string).length).toBeGreaterThan(10);
    expect(result.id).toBe(204);
  });

  it("saves a quality-check-failed version when validateCoverLetterQuality throws QualityViolation", async () => {
    // Simulate validateCoverLetterQuality detecting a vague opener — a quality
    // rule that the pipeline catches as QualityViolation and stores without
    // saving the standard pending_approval version.
    const { QualityViolation } = await import("../pipelines/validation");
    validateCoverLetterQualityMock.mockImplementation(() => {
      throw new QualityViolation(
        "Cover letter quality check failed",
        [
          "Vague opener: avoid 'I am excited to apply'",
          "Missing role-specific differentiator in body paragraph",
        ],
        "Dear Hiring Manager,\n\nI am excited to apply...",
      );
    });

    callAIMock.mockResolvedValue({
      content: makeValidAiResponse(10),
      runId: "run_cl_quality_fail",
      eventLogId: 10,
      modelName: "test/model",
      provider: "openrouter",
      priorFailures: [],
    });

    setupDbInsert({
      id: 205,
      status: "pending_approval",
      label: "AI drafted — quality check failed",
      draftContent: "Dear Hiring Manager,\n\nI am excited to apply...",
      annotatedParagraphs: [],
      notes: "Quality check failed:\nVague opener: avoid 'I am excited to apply'\nMissing role-specific differentiator in body paragraph\n\nThe AI output violated best practices. Review and regenerate, or adjust your claims.",
    });

    const { runCoverLetterPipeline } = await import(
      "../pipelines/cover-letter-draft"
    );
    const result = await runCoverLetterPipeline(job, null, claims, [10, 11]);

    // AI was called (quality check fires after successful AI response)
    expect(callAIMock).toHaveBeenCalledOnce();
    expect(dbInsertMock).toHaveBeenCalledOnce();

    const inserted = coverLetterVersionsInsertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.label).toBe("AI drafted — quality check failed");
    expect(inserted.status).toBe("pending_approval");
    expect(typeof inserted.notes).toBe("string");
    expect((inserted.notes as string)).toContain("Quality check failed");
    expect(result.id).toBe(205);
  });

  it("saves a version with role profile context when a roleProfile is provided", async () => {
    const roleProfile: RoleProfile = {
      id: 7,
      name: "Senior Frontend",
      description: "Frontend specialist profile",
      targetTitles: ["Senior Engineer"],
      targetIndustries: ["Tech"],
      targetCompanySize: "startup",
      targetRemoteType: "remote",
      targetSalaryMin: 150000,
      targetSalaryMax: 200000,
      priorityClaimIds: [10],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as RoleProfile;

    callAIMock.mockResolvedValue({
      content: makeValidAiResponse(10),
      runId: "run_cl_with_profile",
      eventLogId: 9,
      modelName: "test/model",
      provider: "openrouter",
      priorFailures: [],
    });

    const { runCoverLetterPipeline } = await import(
      "../pipelines/cover-letter-draft"
    );
    const result = await runCoverLetterPipeline(
      job,
      roleProfile,
      claims,
      [10, 11],
    );

    expect(callAIMock).toHaveBeenCalledOnce();
    const callArgs = callAIMock.mock.calls[0][0] as { userPrompt: string; systemPrompt: string };
    expect(callArgs.userPrompt).toContain("Senior Frontend");
    expect(result).toBeDefined();
  });

  it("does not pass unavailable research state as factual grounding to the cover-letter prompt", async () => {
    const unavailableResearchJob = makeJob({
      researchData: {
        status: "unavailable",
        reason: "missing_api_key",
        message: "Verified company research is currently unavailable.",
        sources: [],
      },
    });

    callAIMock.mockResolvedValue({
      content: makeValidAiResponse(10),
      runId: "run_cl_unavailable_research",
      eventLogId: 11,
      modelName: "test/model",
      provider: "openrouter",
      priorFailures: [],
    });

    const { runCoverLetterPipeline } = await import(
      "../pipelines/cover-letter-draft"
    );

    await runCoverLetterPipeline(unavailableResearchJob, null, claims, [10, 11]);

    const callArgs = callAIMock.mock.calls[0][0] as { userPrompt: string };
    expect(callArgs.userPrompt).toContain("No stored research available.");
    expect(callArgs.userPrompt).not.toContain("Verified company research is currently unavailable.");
    expect(callArgs.userPrompt).not.toContain('"status":"unavailable"');
  });

  it("passes verified sourced research through when it is present", async () => {
    const researchedJob = makeJob({
      researchData: {
        status: "verified",
        companyOverview: "StreamTech builds observability software.",
        recentNewsOrProjects: "Launched a new tracing platform.",
        cultureAndValues: "Values reliability and developer velocity.",
        interviewStrategy: "Discuss platform ownership.",
        roleSpecificAdvice: "Highlight TypeScript APIs.",
        sources: [
          {
            title: "StreamTech launches tracing platform",
            url: "https://example.com/tracing",
            content: "StreamTech launched a tracing platform for enterprise teams.",
            score: 0.92,
          },
        ],
      },
    });

    callAIMock.mockResolvedValue({
      content: makeValidAiResponse(10),
      runId: "run_cl_verified_research",
      eventLogId: 12,
      modelName: "test/model",
      provider: "openrouter",
      priorFailures: [],
    });

    const { runCoverLetterPipeline } = await import(
      "../pipelines/cover-letter-draft"
    );

    await runCoverLetterPipeline(researchedJob, null, claims, [10, 11]);

    const callArgs = callAIMock.mock.calls[0][0] as { userPrompt: string };
    expect(callArgs.userPrompt).toContain('"status":"verified"');
    expect(callArgs.userPrompt).toContain("StreamTech launches tracing platform");
    expect(callArgs.userPrompt).toContain("Launched a new tracing platform.");
  });
});
