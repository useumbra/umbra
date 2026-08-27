import { describe, expect, it } from "vitest";
import {
  extractCitations,
  parseToolCall,
  schemaSummary,
} from "./chat-features";

describe("chat feature parsing", () => {
  it("extracts unique URL citations from provider annotations", () => {
    expect(
      extractCitations([
        {
          type: "url_citation",
          url_citation: {
            url: "https://example.com/article",
            title: "Example article",
          },
        },
        {
          type: "url_citation",
          url_citation: { url: "https://example.com/article" },
        },
        { type: "other" },
      ]),
    ).toEqual([
      { url: "https://example.com/article", title: "Example article" },
    ]);
  });

  it("validates a tool call against the available tool names", () => {
    expect(
      parseToolCall('{"tool":"Calendar/list","arguments":{"limit":3}}', [
        "Calendar/list",
      ]),
    ).toEqual({
      kind: "call",
      tool: "Calendar/list",
      arguments: { limit: 3 },
    });
    expect(
      parseToolCall('{"tool":"Missing/run","arguments":{}}', ["Calendar/list"]),
    ).toEqual({
      kind: "invalid",
      error: "Unknown tool requested: Missing/run",
    });
  });

  it("rejects malformed tool calls without affecting normal answers", () => {
    expect(parseToolCall("A normal answer")).toEqual({ kind: "none" });
    expect(parseToolCall('{"tool":"Calendar/list"}')).toEqual({
      kind: "invalid",
      error: "The tool request arguments must be a JSON object.",
    });
    expect(
      schemaSummary({ properties: { limit: {}, q: {} }, required: ["q"] }),
    ).toBe('{"properties":["limit","q"],"required":["q"]}');
  });
});
