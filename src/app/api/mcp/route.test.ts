import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const request = (body: unknown) =>
  new NextRequest("http://localhost/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("MCP proxy", () => {
  it("rejects a non-HTTPS URL", async () => {
    const response = await POST(
      request({ url: "http://example.com", method: "initialize", params: {} }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Connector URL must use https.",
    });
  });

  it("rejects localhost HTTP URLs in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await POST(
      request({
        url: "http://localhost:3000/api/mcp",
        method: "initialize",
        params: {},
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Connector URL must use https.",
    });
  });

  it("rejects a disallowed method", async () => {
    const response = await POST(
      request({ url: "https://example.com", method: "ping", params: {} }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a malformed body", async () => {
    const response = await POST(
      request({ url: "https://example.com", method: "initialize" }),
    );
    expect(response.status).toBe(400);
  });

  it("parses an SSE-framed response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            'data: {"jsonrpc":"2.0","id":1,"result":{"tools":[]}}\n\n',
            { headers: { "content-type": "text/event-stream" } },
          ),
      ),
    );
    const response = await POST(
      request({
        url: "https://example.com/mcp",
        method: "tools/list",
        params: {},
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: { tools: [] },
    });
    vi.unstubAllGlobals();
  });

  it("surfaces a JSON-RPC error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              error: { code: -32601, message: "Method not found" },
            }),
            { headers: { "content-type": "application/json" } },
          ),
      ),
    );
    const response = await POST(
      request({
        url: "https://example.com/mcp",
        method: "initialize",
        params: {},
      }),
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        type: "json-rpc",
        response: {
          jsonrpc: "2.0",
          id: 1,
          error: { code: -32601, message: "Method not found" },
        },
      },
    });
    vi.unstubAllGlobals();
  });
});
