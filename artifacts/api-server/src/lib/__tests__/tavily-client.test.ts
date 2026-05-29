import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("searchWeb — query is always defined in success response", () => {
  it("returns caller's query when Tavily response body omits the query field", async () => {
    vi.stubEnv("TAVILY_API_KEY", "test-key-abc");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          // Tavily body does NOT include query field
          answer: "Some answer",
          responseTime: 123,
          results: [],
        }),
      }),
    );

    const { searchWeb } = await import("../tavily-client");
    const result = await searchWeb("original search query");

    expect(result.status).toBe("ok");
    expect(result.query).toBe("original search query");
  });

  it("returns query from error paths unchanged", async () => {
    vi.stubEnv("TAVILY_API_KEY", "test-key-abc");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    );

    const { searchWeb } = await import("../tavily-client");
    const result = await searchWeb("error query");

    expect(result.status).toBe("unavailable");
    expect(result.query).toBe("error query");
  });
});
