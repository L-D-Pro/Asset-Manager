import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractJdParseSource } from "../jd-source";
import type { MessageAttachment } from "@workspace/db";

// ── Mock parseJdText for getCachedJdParse tests ──────────────────────────────

vi.mock("../jd-parse-preprocess", () => ({
  parseJdText: vi.fn(),
}));

import { parseJdText } from "../jd-parse-preprocess";
import { getCachedJdParse, resetCacheForTesting } from "../jd-source";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJobAtt(jdText: string | null, title?: string): MessageAttachment {
  return {
    kind: "job",
    snapshot: { jdText, title: title ?? "Software Engineer", company: "Acme" },
  } as MessageAttachment;
}

function makeDocAtt(contentText: string, filename?: string): MessageAttachment {
  return {
    kind: "document",
    snapshot: { contentText, filename: filename ?? "jd.pdf" },
  } as MessageAttachment;
}

// A string with 3+ JD signals
const JD_DOC_STRONG =
  "This role has responsibilities in building features. " +
  "Requirements include TypeScript. Preferred: 3+ years. " +
  "Qualifications: degree in CS. Location: Remote. salary negotiable.";

// A string with exactly 2 JD signals (should NOT match 3+ threshold)
const JD_DOC_WEAK =
  "responsibilities of the role include writing code. " +
  "requirements include attention to detail. " +
  "This is a great place to work with friendly people.";

// A long user message (>200 chars) with 2+ JD signals
const JD_USER_MSG =
  "We are looking for a senior engineer. responsibilities include building scalable systems. " +
  "requirements include 5+ years of TypeScript experience. " +
  "location is San Francisco. We offer competitive salary and benefits. " +
  "This is a full-time position at an exciting startup with a great team culture.";

// ── extractJdParseSource ──────────────────────────────────────────────────────

describe("extractJdParseSource", () => {
  it("returns job_attachment when job attachment has jdText", () => {
    const result = extractJdParseSource({
      userMessage: "please tailor my resume",
      attachments: [makeJobAtt("We need a senior TypeScript developer. responsibilities and requirements are broad.")],
    });
    expect(result.source).toBe("job_attachment");
    expect(result.text).toContain("TypeScript");
  });

  it("falls through to document_attachment when job attachment has no jdText", () => {
    const result = extractJdParseSource({
      userMessage: "tailor my resume",
      attachments: [makeJobAtt(null), makeDocAtt(JD_DOC_STRONG)],
    });
    expect(result.source).toBe("document_attachment");
    expect(result.text).toBe(JD_DOC_STRONG);
  });

  it("returns document_attachment for document with 3+ JD signals", () => {
    const result = extractJdParseSource({
      userMessage: "help me",
      attachments: [makeDocAtt(JD_DOC_STRONG, "job-posting.pdf")],
    });
    expect(result.source).toBe("document_attachment");
    expect(result.sourceLabel).toBe("job-posting.pdf");
    expect(result.text).toBe(JD_DOC_STRONG);
  });

  it("does NOT return document_attachment for document with only 2 JD signals", () => {
    const result = extractJdParseSource({
      userMessage: "help me",
      attachments: [makeDocAtt(JD_DOC_WEAK)],
    });
    // 2 signals is below the 3-signal threshold for documents
    expect(result.source).not.toBe("document_attachment");
  });

  it("returns none for short user message (< 200 chars)", () => {
    const result = extractJdParseSource({
      userMessage: "responsibilities requirements qualifications",
      attachments: [],
    });
    expect(result.source).toBe("none");
    expect(result.text).toBeNull();
  });

  it("returns user_message for long message (> 200 chars) with 2+ JD signals", () => {
    expect(JD_USER_MSG.length).toBeGreaterThan(200);
    const result = extractJdParseSource({
      userMessage: JD_USER_MSG,
      attachments: [],
    });
    expect(result.source).toBe("user_message");
    expect(result.text).toBe(JD_USER_MSG);
    expect(result.sourceLabel).toBeUndefined();
  });

  it("returns none for long message (> 200 chars) without JD signals", () => {
    const longMsg = "a".repeat(300);
    const result = extractJdParseSource({
      userMessage: longMsg,
      attachments: [],
    });
    expect(result.source).toBe("none");
    expect(result.text).toBeNull();
  });

  it("returns none when no attachments and no JD in message", () => {
    const result = extractJdParseSource({
      userMessage: "what is the weather today?",
      attachments: [],
    });
    expect(result.source).toBe("none");
    expect(result.text).toBeNull();
  });

  it("job_attachment takes priority over JD document attachment", () => {
    const result = extractJdParseSource({
      userMessage: "tailor my resume",
      attachments: [makeJobAtt("Senior TypeScript dev. responsibilities. requirements."), makeDocAtt(JD_DOC_STRONG)],
    });
    expect(result.source).toBe("job_attachment");
  });

  it("includes sourceLabel from job title", () => {
    const result = extractJdParseSource({
      userMessage: "tailor",
      attachments: [makeJobAtt("responsibilities requirements qualifications", "Staff Engineer")],
    });
    expect(result.source).toBe("job_attachment");
    expect(result.sourceLabel).toBe("Staff Engineer");
  });
});

// ── getCachedJdParse ──────────────────────────────────────────────────────────

describe("getCachedJdParse", () => {
  const mockParsedJd = {
    requiredSkills: ["TypeScript"],
    niceToHaveSkills: [],
    keywords: ["distributed systems"],
    senioritySignal: "senior",
    location: null,
    remoteType: "remote",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetCacheForTesting();
  });

  it("first call invokes parseJdText and returns cacheHit: false", async () => {
    vi.mocked(parseJdText).mockResolvedValue(mockParsedJd);
    const result = await getCachedJdParse("senior engineer with responsibilities and requirements", 1);
    expect(parseJdText).toHaveBeenCalledOnce();
    expect(result.cacheHit).toBe(false);
    expect(result.parsedJd).toEqual(mockParsedJd);
  });

  it("second call with same text returns cacheHit: true without calling parseJdText again", async () => {
    vi.mocked(parseJdText).mockResolvedValue(mockParsedJd);
    const text = "senior engineer with responsibilities and requirements";
    await getCachedJdParse(text, 1);
    vi.clearAllMocks();
    const result = await getCachedJdParse(text, 1);
    expect(parseJdText).not.toHaveBeenCalled();
    expect(result.cacheHit).toBe(true);
    expect(result.parsedJd).toEqual(mockParsedJd);
  });

  it("different text uses a different cache entry", async () => {
    vi.mocked(parseJdText).mockResolvedValue(mockParsedJd);
    await getCachedJdParse("job one: responsibilities requirements", 1);
    vi.clearAllMocks();
    const result = await getCachedJdParse("job two: qualifications location salary", 1);
    expect(parseJdText).toHaveBeenCalledOnce();
    expect(result.cacheHit).toBe(false);
  });
});
