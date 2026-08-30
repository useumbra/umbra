import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModelConfig } from "../../config/models";
import { VeniceProvider } from "./venice";

const catalog: ModelConfig[] = [
  {
    id: "venice-test",
    label: "Venice Test",
    description: "Test model",
    contextWindow: 32768,
    upstreamSlug: "venice-test-upstream",
    provider: "venice",
    creditPricing: { inPer1M: 1, outPer1M: 2 },
    capabilities: {
      streaming: true,
      vision: false,
      files: false,
      tools: true,
      webSearch: true,
      reasoning: true,
    },
  },
  {
    id: "venice-basic",
    label: "Venice Basic",
    description: "Basic test model",
    contextWindow: 32768,
    upstreamSlug: "venice-basic-upstream",
    provider: "venice",
    creditPricing: { inPer1M: 1, outPer1M: 2 },
    capabilities: {
      streaming: true,
      vision: false,
      files: false,
      tools: false,
      webSearch: false,
      reasoning: false,
    },
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("VeniceProvider", () => {
  it("builds Venice-specific request parameters", async () => {
    vi.stubEnv("VENICE_API_KEY", "test-key");
    let requestBody: Record<string, unknown> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(new ReadableStream<Uint8Array>());
      }),
    );

    await new VeniceProvider(catalog).stream(
      [{ role: "user", content: "Hello" }],
      "venice-test",
      {
        temperature: 3,
        maxTokens: 512,
        reasoningEffort: "high",
        webSearch: true,
      },
    );

    expect(requestBody).toMatchObject({
      model: "venice-test-upstream",
      stream: true,
      stream_options: { include_usage: true },
      temperature: 2,
      max_tokens: 512,
      reasoning_effort: "high",
      venice_parameters: {
        enable_web_search: "on",
        enable_web_citations: true,
      },
    });
  });

  it("maps Umbra reasoning levels to Venice-supported values", async () => {
    vi.stubEnv("VENICE_API_KEY", "test-key");
    let requestBody: Record<string, unknown> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(new ReadableStream<Uint8Array>());
      }),
    );
    const provider = new VeniceProvider(catalog);

    for (const [effort, expected] of [
      ["minimal", "low"],
      ["low", "low"],
      ["medium", "medium"],
      ["high", "high"],
      ["xhigh", "high"],
      ["max", "high"],
    ] as const) {
      await provider.stream(
        [{ role: "user", content: "Hello" }],
        "venice-test",
        { reasoningEffort: effort },
      );
      expect(requestBody).toMatchObject({ reasoning_effort: expected });
    }
  });

  it("disables default reasoning for reasoning-capable models", async () => {
    vi.stubEnv("VENICE_API_KEY", "test-key");
    let requestBody: Record<string, unknown> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(new ReadableStream<Uint8Array>());
      }),
    );

    await new VeniceProvider(catalog).stream(
      [{ role: "user", content: "Hello" }],
      "venice-test",
    );

    expect(requestBody).toMatchObject({ reasoning_effort: "none" });
  });

  it("omits web search and reasoning for unsupported options", async () => {
    vi.stubEnv("VENICE_API_KEY", "test-key");
    let requestBody: Record<string, unknown> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(new ReadableStream<Uint8Array>());
      }),
    );

    await new VeniceProvider(catalog).stream(
      [{ role: "user", content: "Hello" }],
      "venice-basic",
      { temperature: -1, reasoningEffort: "high", webSearch: false },
    );

    expect(requestBody).toMatchObject({ temperature: 0 });
    expect(requestBody).not.toHaveProperty("reasoning_effort");
    expect(requestBody).not.toHaveProperty("venice_parameters");
  });

  it("uses the same unavailable error as the other providers", async () => {
    await expect(
      new VeniceProvider(catalog).stream(
        [{ role: "user", content: "Hello" }],
        "venice-test",
      ),
    ).rejects.toThrow("Provider unavailable");
  });
});
