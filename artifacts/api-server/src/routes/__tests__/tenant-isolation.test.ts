import { describe, expect, it, vi } from "vitest";

const { whereCalls, insertMock } = vi.hoisted(() => ({
  whereCalls: [] as unknown[],
  insertMock: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (column: unknown, value: unknown) => ({ column, value }),
    and: (...terms: unknown[]) => terms,
  };
});

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: (predicate: unknown) => {
          whereCalls.push(predicate);
          return [];
        },
      }),
    })),
    insert: insertMock,
  },
  roleProfilesTable: { id: "role_profiles.id", userId: "role_profiles.user_id" },
  applicationsTable: { id: "applications.id", userId: "applications.user_id" },
  jobsTable: { id: "jobs.id", userId: "jobs.user_id" },
  resumeVersionsTable: { id: "resume_versions.id", userId: "resume_versions.user_id" },
  coverLetterVersionsTable: { id: "cover_letter_versions.id", userId: "cover_letter_versions.user_id" },
  eventLogsTable: {},
  siteAdaptersTable: {},
  applicationSessionsTable: { id: "application_sessions.id", userId: "application_sessions.user_id" },
  applicationFormFieldsTable: {},
  applicationActionsTable: {},
  insertSiteAdapterSchema: {},
  insertApplicationSessionSchema: {},
  insertApplicationFormFieldSchema: { safeParse: vi.fn() },
  insertApplicationActionSchema: {},
  freelanceProfilesTable: { id: "freelance_profiles.id", userId: "freelance_profiles.user_id" },
  projectSourcesTable: { id: "project_sources.id", userId: "project_sources.user_id" },
  freelanceProjectsTable: { id: "freelance_projects.id", userId: "freelance_projects.user_id" },
  proposalVersionsTable: { id: "proposal_versions.id", userId: "proposal_versions.user_id" },
  proposalOutcomesTable: {},
  clientMessageTemplatesTable: {},
  insertFreelanceProfileSchema: {},
  insertProjectSourceSchema: {},
  insertFreelanceProjectSchema: {},
  insertProposalVersionSchema: { safeParse: vi.fn(({ projectId }) => ({ success: true, data: { projectId } })) },
  insertProposalOutcomeSchema: {},
  insertClientMessageTemplateSchema: {},
}));

vi.mock("@workspace/api-zod", () => ({
  GetRoleProfileParams: { safeParse: vi.fn(({ id }) => ({ success: true, data: { id: Number(id) } })) },
  GetRoleProfileResponse: { parse: (row: unknown) => row },
  CreateApplicationBody: { safeParse: vi.fn((body) => ({ success: true, data: body })) },
}));

vi.mock("../../lib/pipelines/proposal-draft", () => ({
  draftProposalForProject: vi.fn(),
}));

function response() {
  const res: any = {};
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

function handler(router: any, method: string, path: string) {
  const route = router.stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method]);
  return route.route.stack[route.route.stack.length - 1].handle;
}

describe("cross-user private resource isolation", () => {
  it("scopes by-id private reads to the session owner, including for an admin account", async () => {
    whereCalls.length = 0;
    const { default: router } = await import("../role-profiles");
    const res = response();

    await handler(router, "get", "/role-profiles/:id")(
      { params: { id: "41" }, session: { adminId: 1 } },
      res,
    );

    expect(res.statusCode).toBe(404);
    expect(whereCalls[0]).toContainEqual({ column: "role_profiles.user_id", value: 1 });
  });

  it("does not create an application linked to another user's job", async () => {
    whereCalls.length = 0;
    insertMock.mockClear();
    const { default: router } = await import("../applications");
    const res = response();

    await handler(router, "post", "/applications")(
      { body: { jobId: 41 }, session: { adminId: 202 }, log: { warn: vi.fn(), info: vi.fn() } },
      res,
    );

    expect(res.statusCode).toBe(404);
    expect(whereCalls[0]).toContainEqual({ column: "jobs.user_id", value: 202 });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("does not add assisted-apply children through another user's session", async () => {
    whereCalls.length = 0;
    insertMock.mockClear();
    const { default: router } = await import("../assisted-apply");
    const res = response();

    await handler(router, "post", "/application-sessions/:id/fields")(
      { params: { id: "91" }, body: {}, session: { adminId: 202 } },
      res,
    );

    expect(res.statusCode).toBe(404);
    expect(whereCalls[0]).toContainEqual({ column: "application_sessions.user_id", value: 202 });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("does not create proposals against another user's freelance project", async () => {
    whereCalls.length = 0;
    insertMock.mockClear();
    const { default: router } = await import("../freelance");
    const res = response();

    await handler(router, "post", "/proposal-versions")(
      { body: { projectId: 73 }, session: { adminId: 202 } },
      res,
    );

    expect(res.statusCode).toBe(404);
    expect(whereCalls[0]).toContainEqual({ column: "freelance_projects.user_id", value: 202 });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
