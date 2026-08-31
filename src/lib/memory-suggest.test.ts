import { describe, expect, it } from "vitest";
import { suggestMemories } from "./memory-suggest";

const none = () => suggestMemories("", [], []);

describe("memory suggestions", () => {
  it.each([
    ["my name is Alice", "Name: Alice"],
    ["call me Ali", "Prefers to be called Ali"],
    ["I work at Umbra", "Works at Umbra"],
    ["I am a designer", "Works as a designer"],
    ["I live in Tokyo", "Based in Tokyo"],
    ["I prefer tea", "Prefers tea"],
    ["I use TypeScript", "Uses TypeScript"],
    ["remember that coding standards matter", "Coding standards matter"],
    ["please always use bullets", "Always use bullets"],
  ])("extracts %s", (text, expected) => {
    expect(suggestMemories(text, [], [])).toEqual([expected]);
  });

  it("dedupes, filters existing and dismissed memories, and caps at two", () => {
    expect(
      suggestMemories(
        "My name is Alice and I prefer concise answers. I use TypeScript.",
        [{ id: "1", text: "Name: Alice", createdAt: 1 }],
        ["prefers concise answers"],
      ),
    ).toEqual(["Uses TypeScript"]);
  });

  it("returns no more than two suggestions in pattern order", () => {
    expect(
      suggestMemories(
        "My name is Alice. Call me Ali. I work at Umbra.",
        [],
        [],
      ),
    ).toEqual(["Name: Alice", "Prefers to be called Ali"]);
  });

  it("truncates at a word boundary and ignores empty text", () => {
    const text = `I prefer ${"very long wording ".repeat(20)}`;
    const result = suggestMemories(text, [], []);
    expect(result).toHaveLength(1);
    expect(result[0].length).toBeLessThanOrEqual(140);
    expect(result[0]).not.toMatch(/\s$/);
    expect(none()).toEqual([]);
  });
});
