/**
 * Unit tests for event-logs pagination cursor encode/decode helpers.
 *
 * Full route integration tests require a live database and are outside the
 * scope of this unit test file. The cursor helpers are the only pure logic
 * that can be unit-tested in isolation.
 */
import { describe, expect, it } from "vitest";

import { decodeEventLogCursor, encodeEventLogCursor } from "../event-logs";

describe("encodeEventLogCursor / decodeEventLogCursor", () => {
  it("round-trips a cursor correctly", () => {
    const date = new Date("2025-05-01T12:34:56.789Z");
    const id = 42;
    const encoded = encodeEventLogCursor(date, id);
    const decoded = decodeEventLogCursor(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.createdAt).toBe(date.toISOString());
    expect(decoded!.id).toBe(id);
  });

  it("accepts a string date and normalises to ISO", () => {
    const isoString = "2025-06-15T08:00:00.000Z";
    const encoded = encodeEventLogCursor(isoString, 7);
    const decoded = decodeEventLogCursor(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.createdAt).toBe(isoString);
    expect(decoded!.id).toBe(7);
  });

  it("produces a base64url string (no +, /, or = padding)", () => {
    const encoded = encodeEventLogCursor(new Date("2025-01-01T00:00:00.000Z"), 1);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("returns null for an empty string", () => {
    expect(decodeEventLogCursor("")).toBeNull();
  });

  it("returns null for a non-base64url string", () => {
    expect(decodeEventLogCursor("not-valid-base64url!!!")).toBeNull();
  });

  it("returns null for valid base64url that is not a JSON object with required fields", () => {
    const garbage = Buffer.from(JSON.stringify({ foo: "bar" })).toString("base64url");
    expect(decodeEventLogCursor(garbage)).toBeNull();
  });

  it("returns null when createdAt is missing", () => {
    const bad = Buffer.from(JSON.stringify({ id: 5 })).toString("base64url");
    expect(decodeEventLogCursor(bad)).toBeNull();
  });

  it("returns null when id is missing", () => {
    const bad = Buffer.from(JSON.stringify({ createdAt: "2025-01-01T00:00:00.000Z" })).toString("base64url");
    expect(decodeEventLogCursor(bad)).toBeNull();
  });

  it("returns null when id is a string instead of a number", () => {
    const bad = Buffer.from(
      JSON.stringify({ createdAt: "2025-01-01T00:00:00.000Z", id: "42" }),
    ).toString("base64url");
    expect(decodeEventLogCursor(bad)).toBeNull();
  });

  it("handles large id values correctly", () => {
    const date = new Date("2026-03-15T09:00:00.000Z");
    const id = 999999;
    const encoded = encodeEventLogCursor(date, id);
    const decoded = decodeEventLogCursor(encoded);
    expect(decoded!.id).toBe(id);
    expect(decoded!.createdAt).toBe(date.toISOString());
  });
});
