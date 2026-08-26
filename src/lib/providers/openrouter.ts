import type { Provider, ProviderMessage } from "./types";
import { models } from "@/config/models";
export class OpenRouterProvider implements Provider {
  async stream(messages: ProviderMessage[], model: string) {
    const chosen = models.find((item) => item.id === model) ?? models[0];
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://useumbra.xyz" }, body: JSON.stringify({ model: chosen.upstreamSlug, messages, stream: true }) });
    if (!response.ok || !response.body) throw new Error("Provider unavailable");
    return response.body;
  }
}
