/**
 * Unit tests for chat pagination cursor encode/decode helpers.
 *
 * Full route integration tests (GET /chat/threads, GET /chat/threads/:id/messages)
 * require a live database and are outside the scope of this unit test file.
 * The cursor helpers are the only pure logic that can be unit-tested in isolation.
 */
import { describe, expect, it } from "vitest";

import { decodeThreadCursor, encodeThreadCursor } from "../chat";

describe("encodeThreadCursor / decodeThreadCursor", () => {
  it("round-trips a cursor correctly", () => {
    const date = new Date("2025-05-01T12:34:56.789Z");
    const id = 42;
    const encoded = encodeThreadCursor(date, id);
    const decoded = decodeThreadCursor(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.updatedAt).toBe(date.toISOString());
    expect(decoded!.id).toBe(id);
  });

  it("produces a base64url string (no +, /, or = padding)", () => {
    const encoded = encodeThreadCursor(new Date("2025-01-01T00:00:00.000Z"), 1);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("returns null for an empty string", () => {
    expect(decodeThreadCursor("")).toBeNull();
  });

  it("returns null for a non-base64url string", () => {
    expect(decodeThreadCursor("not-valid-base64url!!!")).toBeNull();
  });

  it("returns null for valid base64url that is not a JSON object with required fields", () => {
    // Valid base64url but wrong shape
    const garbage = Buffer.from(JSON.stringify({ foo: "bar" })).toString("base64url");
    expect(decodeThreadCursor(garbage)).toBeNull();
  });

  it("returns null when updatedAt is missing", () => {
    const bad = Buffer.from(JSON.stringify({ id: 5 })).toString("base64url");
    expect(decodeThreadCursor(bad)).toBeNull();
  });

  it("returns null when id is missing", () => {
    const bad = Buffer.from(JSON.stringify({ updatedAt: "2025-01-01T00:00:00.000Z" })).toString("base64url");
    expect(decodeThreadCursor(bad)).toBeNull();
  });

  it("returns null when id is a string instead of a number", () => {
    const bad = Buffer.from(JSON.stringify({ updatedAt: "2025-01-01T00:00:00.000Z", id: "42" })).toString("base64url");
    expect(decodeThreadCursor(bad)).toBeNull();
  });

  it("handles large id values correctly", () => {
    const date = new Date("2026-03-15T09:00:00.000Z");
    const id = 999999;
    const encoded = encodeThreadCursor(date, id);
    const decoded = decodeThreadCursor(encoded);
    expect(decoded!.id).toBe(id);
    expect(decoded!.updatedAt).toBe(date.toISOString());
  });
});
