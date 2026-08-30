import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiToken } from "../../../../lib/api-auth";
import { NextRequest } from "next/server";
import { POST } from "./route";

const body = (method: string, params: unknown = {}, id: string | number = 1) =>
  JSON.stringify({ jsonrpc: "2.0", id, method, params });

const request = (
  payload: string,
  authorization = `Bearer ${createApiToken("mcp-test")}`,
) =>
  new NextRequest("http://localhost/api/mcp/venice", {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
    },
    body: payload,
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Venice MCP endpoint", () => {
  it("rejects missing or invalid API keys with a JSON-RPC error", async () => {
    vi.stubEnv("VENICE_API_KEY", "test-venice-key");
    const response = await POST(
      request(body("initialize"), "Bearer not-a-valid-key"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32001, message: "Invalid API key" },
    });
  });

  it("returns the protocol handshake and exactly three tools", async () => {
    vi.stubEnv("VENICE_API_KEY", "test-venice-key");
    const initialize = await POST(request(body("initialize", {}, "init")));
    await expect(initialize.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: "init",
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "umbra-venice", version: "1.0.0" },
      },
    });

    const listed = await POST(request(body("tools/list")));
    const listedBody = await listed.json();
    expect(listedBody.result.tools).toHaveLength(3);
    expect(
      listedBody.result.tools.map((tool: { name: string }) => tool.name),
    ).toEqual([
      "venice_web_answer",
      "venice_characters_search",
      "venice_models",
    ]);
  });

  it("validates tool arguments", async () => {
    vi.stubEnv("VENICE_API_KEY", "test-venice-key");
    const response = await POST(
      request(
        body("tools/call", {
          name: "venice_web_answer",
          arguments: { query: "x".repeat(2001) },
        }),
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: {
        code: -32602,
        message: "Invalid venice_web_answer arguments",
      },
    });
  });

  it("returns an unconfigured error before calling Venice", async () => {
    vi.stubEnv("VENICE_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request(body("tools/list")));

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32000, message: "Venice is not configured" },
    });
  });

  it("calls Venice and returns web citations in the text block", async () => {
    vi.stubEnv("VENICE_API_KEY", "test-venice-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { content: "A cited answer." } }],
              venice_parameters: {
                web_search_citations: [{ url: "https://example.com/source" }],
              },
            }),
          ),
      ),
    );
    const response = await POST(
      request(
        body("tools/call", {
          name: "venice_web_answer",
          arguments: { query: "What is Umbra?", model: "venice-flash" },
        }),
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: {
        content: [
          {
            type: "text",
            text: "A cited answer.\n\nSources:\n- https://example.com/source",
          },
        ],
      },
    });
  });

  it("defaults omitted tool arguments to an empty object", async () => {
    vi.stubEnv("VENICE_API_KEY", "test-venice-key");
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ data: [] })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      request(
        body("tools/call", {
          name: "venice_models",
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: {
        content: [{ type: "text", text: "No Venice models found." }],
      },
    });
  });
});
