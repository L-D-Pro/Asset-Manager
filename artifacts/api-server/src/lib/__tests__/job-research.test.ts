import { beforeEach, describe, expect, it, vi } from "vitest";

const callAIMock = vi.fn();
const parseJsonResponseMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("../ai-client", () => ({
  callAI: callAIMock,
  parseJsonResponse: parseJsonResponseMock,
}));

describe("job research provenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("returns explicit unavailable state when TAVILY_API_KEY is missing", async () => {
    const { searchWeb } = await import("../tavily-client");

    const result = await searchWeb("Acme research");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "unavailable",
      reason: "missing_api_key",
      query: "Acme research",
      results: [],
    });
  });

  it("returns explicit unavailable state when Tavily responds with an error", async () => {
    vi.stubEnv("TAVILY_API_KEY", "test-key");
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    });

    const { searchWeb } = await import("../tavily-client");

    const result = await searchWeb("Acme research");

    expect(result).toMatchObject({
      status: "unavailable",
      reason: "request_failed",
      query: "Acme research",
      results: [],
    });
  });

  it("stores explicit unavailable research instead of fabricating company facts", async () => {
    const { runJobResearchPipeline } = await import("../pipelines/job-research");

    const result = await runJobResearchPipeline(
      "TypeScript Engineer",
      "Acme",
      "Build APIs",
      10,
      20,
    );

    expect(callAIMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "unavailable",
      reason: "missing_api_key",
      query: 'Acme company recent news engineering culture "TypeScript Engineer"',
      sources: [],
    });
    expect(JSON.stringify(result).toLowerCase()).not.toContain("funding round");
    expect(JSON.stringify(result).toLowerCase()).not.toContain("innovative approaches");
  });

  it("keeps real sourced research when Tavily and synthesis succeed", async () => {
    vi.stubEnv("TAVILY_API_KEY", "test-key");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        query: "Acme company recent news engineering culture \"TypeScript Engineer\"",
        responseTime: 12,
        results: [
          {
            title: "Acme launches observability suite",
            url: "https://example.com/acme-launch",
            content: "Acme launched a new observability suite for enterprise teams.",
            score: 0.91,
          },
        ],
      }),
    });
    callAIMock.mockResolvedValue({
      content: '{"companyOverview":"Acme builds enterprise software.","recentNewsOrProjects":"Launched an observability suite.","cultureAndValues":"Engineering teams emphasize platform reliability.","interviewStrategy":"Speak to platform ownership.","roleSpecificAdvice":"Highlight TypeScript API work."}',
    });
    parseJsonResponseMock.mockReturnValue({
      companyOverview: "Acme builds enterprise software.",
      recentNewsOrProjects: "Launched an observability suite.",
      cultureAndValues: "Engineering teams emphasize platform reliability.",
      interviewStrategy: "Speak to platform ownership.",
      roleSpecificAdvice: "Highlight TypeScript API work.",
    });

    const { runJobResearchPipeline } = await import("../pipelines/job-research");

    const result = await runJobResearchPipeline(
      "TypeScript Engineer",
      "Acme",
      "Build APIs",
      10,
      20,
    );

    expect(callAIMock).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: "verified",
      companyOverview: "Acme builds enterprise software.",
      recentNewsOrProjects: "Launched an observability suite.",
      sources: [
        expect.objectContaining({
          title: "Acme launches observability suite",
          url: "https://example.com/acme-launch",
        }),
      ],
    });
  });
});
