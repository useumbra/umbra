import type { Provider, ProviderMessage, ProviderOptions } from "./types";
import { models } from "../../config/models";
import { brand } from "../../config/brand";
import { UpstreamError } from "./upstream";
export class OpenRouterProvider implements Provider {
  async stream(
    messages: ProviderMessage[],
    model: string,
    options?: ProviderOptions,
  ) {
    const chosen = models.find((item) => item.id === model) ?? models[0];
    const reasoning =
      chosen.capabilities.reasoning && options?.reasoningEffort
        ? { effort: options.reasoningEffort, exclude: true }
        : undefined;
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": `https://${brand.domain}`,
        },
        body: JSON.stringify({
          model: chosen.upstreamSlug,
          messages,
          stream: true,
          usage: { include: true },
          ...(reasoning ? { reasoning } : {}),
          ...(options?.maxTokens !== undefined
            ? { max_tokens: options.maxTokens }
            : {}),
          ...(options?.webSearch
            ? { plugins: [{ id: "web", max_results: 3 }] }
            : {}),
          ...(options?.temperature !== undefined
            ? { temperature: Math.min(2, Math.max(0, options.temperature)) }
            : {}),
        }),
      },
    );
    if (!response.ok)
      throw new UpstreamError(response.status, "Provider unavailable");
    if (!response.body) throw new UpstreamError(502, "Provider unavailable");
    return response.body;
  }
}
