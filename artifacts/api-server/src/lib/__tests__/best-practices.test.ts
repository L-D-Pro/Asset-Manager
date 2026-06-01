import { describe, expect, it } from "vitest";
import { formatBestPracticesForPrompt } from "../best-practices";
import type { BestPracticesConfig } from "../best-practices";

function makeConfig(
  items: BestPracticesConfig["items"],
  hardcodedGuards: Record<string, boolean> = {},
): BestPracticesConfig {
  return { domain: "general", title: "Test", hardcodedGuards, items };
}

describe("formatBestPracticesForPrompt", () => {
  it("includes active items in the prompt", () => {
    const config = makeConfig([
      { description: "Always quantify achievements", source: "hardcoded", active: true },
    ]);
    const result = formatBestPracticesForPrompt(config);
    expect(result).toContain("Always quantify achievements");
  });

  it("excludes items where active is false", () => {
    const config = makeConfig([
      { description: "Rule A — should appear", source: "hardcoded", active: true },
      { description: "Rule B — should be hidden", source: "hardcoded", active: false },
    ]);
    const result = formatBestPracticesForPrompt(config);
    expect(result).toContain("Rule A — should appear");
    expect(result).not.toContain("Rule B — should be hidden");
  });

  it("treats items with no active field as active", () => {
    const config = makeConfig([
      { description: "Implicit active rule", source: "hardcoded" },
    ]);
    const result = formatBestPracticesForPrompt(config);
    expect(result).toContain("Implicit active rule");
  });

  it("returns empty string when all items are inactive", () => {
    const config = makeConfig([
      { description: "Disabled rule", source: "hardcoded", active: false },
    ]);
    const result = formatBestPracticesForPrompt(config);
    expect(result).toBe("");
  });

  it("preserves rationale in prompt output for active items", () => {
    const config = makeConfig([
      { description: "Use plain text", source: "hardcoded", active: true, rationale: "ATS strips markdown" },
    ]);
    const result = formatBestPracticesForPrompt(config);
    expect(result).toContain("Use plain text");
    expect(result).toContain("ATS strips markdown");
  });

  it("does not include rationale for inactive items", () => {
    const config = makeConfig([
      { description: "Inactive rule", source: "hardcoded", active: false, rationale: "Should not appear" },
    ]);
    const result = formatBestPracticesForPrompt(config);
    expect(result).not.toContain("Should not appear");
  });

  it("excludes item when its guardKey is set to false in hardcodedGuards", () => {
    const config = makeConfig(
      [
        { description: "Rule A — gated by guard", source: "hardcoded", guardKey: "myGuard" },
        { description: "Rule B — normal rule", source: "hardcoded" },
      ],
      { myGuard: false },
    );
    const result = formatBestPracticesForPrompt(config);
    expect(result).not.toContain("Rule A — gated by guard");
    expect(result).toContain("Rule B — normal rule");
  });

  it("includes item when its guardKey is missing from hardcodedGuards", () => {
    const config = makeConfig(
      [
        { description: "Rule A — gated by guard", source: "hardcoded", guardKey: "myGuard" },
      ],
      {},
    );
    const result = formatBestPracticesForPrompt(config);
    expect(result).toContain("Rule A — gated by guard");
  });
});
