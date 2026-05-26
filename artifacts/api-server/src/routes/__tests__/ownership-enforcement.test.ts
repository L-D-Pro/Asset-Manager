import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  eventLogsTable: {},
}));

vi.mock("@workspace/api-zod", () => ({
  ListEventLogsQueryParams: {},
  ListEventLogsResponse: {},
  GetEventLogParams: {},
  GetEventLogResponse: {},
}));

describe("server-derived ownership primitives", () => {
  it("derives the owner from the authenticated session", async () => {
    const { currentUserId } = await import("../../lib/ownership");

    expect(currentUserId({ session: { adminId: 27 } } as any)).toBe(27);
  });

  it("strips internal ownership fields from raw route responses", async () => {
    const { withoutUserId } = await import("../../lib/ownership");

    expect(withoutUserId({ id: 4, userId: 27, title: "Private" })).toEqual({
      id: 4,
      title: "Private",
    });
  });
});

describe("event log boundary", () => {
  it("does not expose an authenticated client mutation route for audit rows", async () => {
    const { default: eventLogsRouter } = await import("../event-logs");
    const routes = (eventLogsRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: layer.route.methods,
      }));

    expect(routes).not.toContainEqual({
      path: "/event-logs",
      methods: expect.objectContaining({ post: true }),
    });
  });
});
