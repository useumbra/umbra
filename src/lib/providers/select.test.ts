import { describe, expect, it } from "vitest";
import type { ModelConfig } from "../../config/models";
import { availableModels, providerFor } from "./select";
import { StubProvider } from "./stub";
import { VeniceProvider } from "./venice";
import { route } from "../router";

const catalog: ModelConfig[] = [
  {
    id: "umbra-auto",
    label: "Auto",
    description: "Automatic",
    contextWindow: 128000,
    upstreamSlug: "auto",
    creditPricing: { inPer1M: 1, outPer1M: 1 },
    capabilities: {
      streaming: true,
      vision: false,
      files: false,
      tools: false,
      webSearch: false,
      reasoning: false,
    },
  },
  {
    id: "openrouter-general",
    label: "OpenRouter General",
    description: "General",
    contextWindow: 128000,
    upstreamSlug: "openrouter/general",
    creditPricing: { inPer1M: 1, outPer1M: 1 },
    capabilities: {
      streaming: true,
      vision: false,
      files: false,
      tools: false,
      webSearch: false,
      reasoning: false,
    },
  },
  {
    id: "venice-private",
    label: "Venice Private",
    description: "Private",
    contextWindow: 128000,
    upstreamSlug: "venice/private",
    provider: "venice",
    creditPricing: { inPer1M: 1, outPer1M: 1 },
    capabilities: {
      streaming: true,
      vision: false,
      files: false,
      tools: false,
      webSearch: false,
      reasoning: false,
    },
  },
  {
    id: "venice-coder",
    label: "Venice Coder",
    description: "Coder",
    contextWindow: 128000,
    upstreamSlug: "venice/coder",
    provider: "venice",
    creditPricing: { inPer1M: 1, outPer1M: 1 },
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

describe("provider selection and availability", () => {
  it("selects configured providers and falls back safely", () => {
    expect(
      providerFor("venice-private", catalog, {
        VENICE_API_KEY: "venice-key",
      }),
    ).toBeInstanceOf(VeniceProvider);
    expect(
      providerFor("venice-private", catalog, {
        OPENROUTER_API_KEY: "openrouter-key",
      }),
    ).toBeInstanceOf(StubProvider);
    expect(
      providerFor("openrouter-general", catalog, {
        VENICE_API_KEY: "venice-key",
      }),
    ).toBeInstanceOf(StubProvider);
  });

  it("keeps auto and filters models without provider keys", () => {
    expect(
      availableModels(catalog, { OPENROUTER_API_KEY: "openrouter-key" }).map(
        (model) => model.id,
      ),
    ).toEqual(["umbra-auto", "openrouter-general"]);
    expect(
      availableModels(catalog, { VENICE_API_KEY: "venice-key" }).map(
        (model) => model.id,
      ),
    ).toEqual(["umbra-auto", "venice-private", "venice-coder"]);
    expect(availableModels(catalog, {})).toHaveLength(1);
  });

  it("routes only to an available model", () => {
    const available = availableModels(catalog, {
      OPENROUTER_API_KEY: "openrouter-key",
    });
    const decision = route(
      "Fix this Python function:\n```py\nreturn 1\n```",
      available,
    );
    expect(available.some((model) => model.id === decision.model)).toBe(true);
    expect(decision.model).not.toBe("venice-coder");
    expect(decision.model).toBe("openrouter-general");
  });
});
