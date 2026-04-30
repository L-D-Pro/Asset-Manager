import { describe, expect, it, vi } from "vitest";

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
  return res;
}

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
};

const tables = {
  jobSourcesTable: { id: "id", name: "name", isActive: "isActive" },
  jobListingsTable: {
    id: "id", sourceId: "sourceId", sourceKey: "sourceKey",
    sourceItemId: "sourceItemId", title: "title", isActive: "isActive",
    publishedAt: "publishedAt", location: "location",
  },
  trendsCacheTable: {
    id: "id", queryHash: "queryHash", expiresAt: "expiresAt",
    analysisJson: "analysisJson", jobTitle: "jobTitle", location: "location",
    experienceLevel: "experienceLevel", salaryTarget: "salaryTarget",
    jobMatchesCount: "jobMatchesCount",
  },
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  ...tables,
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  like: vi.fn(),
  desc: vi.fn(),
}));

vi.mock("../../lib/pipelines/market-research.js", () => ({
  runMarketResearchPipeline: vi.fn(),
}));

const sampleAnalysis = {
  marketOverview: {
    demandLevel: "high" as const,
    competition: "medium" as const,
    salaryAlignment: "at" as const,
    summary: "Software engineering demand is strong.",
  },
  requiredSkills: [
    { skill: "TypeScript", frequency: "required" as const, category: "technical" as const },
    { skill: "React", frequency: "common" as const, category: "technical" as const },
    { skill: "Communication", frequency: "common" as const, category: "soft" as const },
  ],
  certifications: [
    { name: "AWS Solutions Architect", demand: "high" as const, estimatedValue: "Essential for cloud roles", provider: "Amazon" },
  ],
  trends: {
    emerging: ["AI/ML integration"],
    declining: ["jQuery"],
    industryShifts: ["Remote-first"],
  },
  actionPlan: {
    immediate: ["Update LinkedIn"],
    shortTerm: ["Build portfolio"],
    longTerm: ["Learn Rust"],
  },
  salaryInsights: {
    rangeLow: 90000, rangeHigh: 180000, median: 130000,
    factors: ["Location", "Experience"],
  },
};

function makeJoinResult(jobListingData: Record<string, unknown>) {
  return {
    from() {
      return {
        innerJoin() {
          return {
            where() {
              return { limit() { return [{ job_listings: jobListingData }]; } };
            },
          };
        },
      };
    },
  };
}

function makeListingsResult(jobListingData: Record<string, unknown>) {
  return {
    from() {
      return {
        innerJoin() {
          return {
            where() {
              return {
                orderBy() {
                  return { limit() { return [{ job_listings: jobListingData }]; } };
                },
              };
            },
          };
        },
      };
    },
  };
}

function makeCacheHit(cachedData: Record<string, unknown>) {
  return {
    from() {
      return {
        where() {
          return { limit() { return [cachedData]; } };
        },
      };
    },
  };
}

function makeCacheMiss() {
  return {
    from() {
      return {
        where() {
          return { limit() { return []; } };
        },
      };
    },
  };
}

describe("POST /api/trends/research", () => {
  it("returns 400 when jobTitle is missing", async () => {
    const { default: trendsRouter } = await import("../trends");
    const layer = (trendsRouter as any).stack.find(
      (l: any) => l.route?.path === "/trends/research" && l.route?.methods?.post,
    );
    expect(layer).toBeTruthy();

    const handler = layer.route.stack[0].handle;
    const req: any = { body: {}, log: { info: vi.fn() } };
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toHaveProperty("error");
  });

  it("returns cached analysis on cache hit", async () => {
    mockDb.select.mockReset();
    mockDb.insert.mockReset();

    mockDb.select.mockReturnValueOnce(makeCacheHit({ id: 1, analysisJson: sampleAnalysis }));
    mockDb.select.mockReturnValueOnce(makeJoinResult({ id: 1, title: "Software Engineer" }));

    const { default: trendsRouter } = await import("../trends");
    const layer = (trendsRouter as any).stack.find(
      (l: any) => l.route?.path === "/trends/research" && l.route?.methods?.post,
    );
    expect(layer).toBeTruthy();

    const handler = layer.route.stack[0].handle;
    const req: any = { body: { jobTitle: "Software Engineer" }, log: { info: vi.fn() } };
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toHaveProperty("cached", true);
    expect(res.payload).toHaveProperty("analysis");
    expect(res.payload).toHaveProperty("jobMatches");
  });

  it("calls AI pipeline and returns fresh analysis on cache miss", async () => {
    mockDb.select.mockReset();
    mockDb.insert.mockReset();

    mockDb.select.mockReturnValueOnce(makeCacheMiss());
    mockDb.select.mockReturnValueOnce(makeJoinResult({ id: 2, title: "Senior Software Engineer" }));
    mockDb.insert.mockReturnValue({ values: vi.fn() } as any);

    const { runMarketResearchPipeline } = await import("../../lib/pipelines/market-research.js");
    (runMarketResearchPipeline as any).mockResolvedValueOnce(sampleAnalysis);

    const { default: trendsRouter } = await import("../trends");
    const layer = (trendsRouter as any).stack.find(
      (l: any) => l.route?.path === "/trends/research" && l.route?.methods?.post,
    );
    expect(layer).toBeTruthy();

    const handler = layer.route.stack[0].handle;
    const req: any = {
      body: { jobTitle: "Software Engineer", location: "Remote", experienceLevel: "mid", salaryTarget: 120000 },
      log: { info: vi.fn() },
    };
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toHaveProperty("cached", false);
    expect(res.payload).toHaveProperty("analysis");
    expect(res.payload).toHaveProperty("jobMatches");
    expect(runMarketResearchPipeline).toHaveBeenCalledWith({
      jobTitle: "Software Engineer",
      location: "Remote",
      experienceLevel: "mid",
      salaryTarget: 120000,
    });
  });
});

describe("GET /api/job-board/listings", () => {
  it("returns listings with meta", async () => {
    mockDb.select.mockReset();

    mockDb.select.mockReturnValueOnce(makeListingsResult({ id: 1, title: "Software Engineer" }));
    mockDb.select.mockReturnValueOnce({
      from() { return [{ key: "src1" }, { key: "src2" }]; },
    });
    mockDb.select.mockReturnValueOnce({
      from() { return [{ id: 1 }, { id: 2 }]; },
    });

    const { default: jobBoardRouter } = await import("../job-board");
    const layer = (jobBoardRouter as any).stack.find(
      (l: any) => l.route?.path === "/job-board/listings" && l.route?.methods?.get,
    );
    expect(layer).toBeTruthy();

    const handler = layer.route.stack[0].handle;
    const req: any = { query: { limit: "10" } };
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toHaveProperty("jobs");
    expect(res.payload).toHaveProperty("meta");
    expect(res.payload.meta).toHaveProperty("sourceCount");
    expect(res.payload.meta).toHaveProperty("listingCount");
    expect(Array.isArray(res.payload.jobs)).toBe(true);
  });
});

describe("GET /api/job-board/sources", () => {
  it("returns sources ordered by name", async () => {
    mockDb.select.mockReset();

    mockDb.select.mockReturnValue({
      from() {
        return {
          orderBy() {
            return [{ id: 1, key: "src1", name: "Example Careers", feedUrl: "https://example.com/feed.xml", sourceType: "rss" }];
          },
        };
      },
    });

    const { default: jobBoardRouter } = await import("../job-board");
    const layer = (jobBoardRouter as any).stack.find(
      (l: any) => l.route?.path === "/job-board/sources" && l.route?.methods?.get,
    );
    expect(layer).toBeTruthy();

    const handler = layer.route.stack[0].handle;
    const req: any = {};
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.payload)).toBe(true);
    expect(res.payload.length).toBe(1);
    expect(res.payload[0]).toHaveProperty("key", "src1");
  });
});
