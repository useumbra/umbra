import { models, type ModelConfig } from "../../config/models";
import type {
  Provider,
  ProviderMessage,
  ProviderOptions,
  ReasoningEffort,
} from "./types";

const mapReasoningEffort = (
  effort: ReasoningEffort,
): "low" | "medium" | "high" =>
  effort === "minimal"
    ? "low"
    : effort === "xhigh" || effort === "max"
      ? "high"
      : effort;

export class VeniceProvider implements Provider {
  constructor(private readonly catalog: ModelConfig[] = models) {}

  async stream(
    messages: ProviderMessage[],
    model: string,
    options?: ProviderOptions,
  ) {
    if (!process.env.VENICE_API_KEY) throw new Error("Provider unavailable");
    const chosen =
      this.catalog.find((item) => item.id === model) ?? this.catalog[0];
    if (!chosen) throw new Error("Provider unavailable");
    const reasoning =
      chosen.capabilities.reasoning && options?.reasoningEffort
        ? mapReasoningEffort(options.reasoningEffort)
        : undefined;
    const response = await fetch(
      "https://api.venice.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.VENICE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: chosen.upstreamSlug,
          messages,
          stream: true,
          stream_options: { include_usage: true },
          ...(reasoning ? { reasoning_effort: reasoning } : {}),
          ...(options?.maxTokens !== undefined
            ? { max_tokens: options.maxTokens }
            : {}),
          ...(options?.webSearch
            ? {
                venice_parameters: {
                  enable_web_search: "on",
                  enable_web_citations: true,
                },
              }
            : {}),
          ...(options?.temperature !== undefined
            ? { temperature: Math.min(2, Math.max(0, options.temperature)) }
            : {}),
        }),
      },
    );
    if (!response.ok || !response.body) throw new Error("Provider unavailable");
    return response.body;
  }
}
