import { NextRequest } from "next/server";
import { limitsForTier } from "@/lib/holder-limits";
import { tierFromRequest } from "@/lib/holder-request";
import { availableModels, providerFor } from "@/lib/providers/select";
import type { ReasoningEffort } from "@/lib/providers/types";
import { route } from "@/lib/router";
import type { ProviderContent } from "@/lib/providers/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    messages: {
      role: "user" | "assistant" | "system";
      content: ProviderContent;
    }[];
    model?: string;
    effort?: ReasoningEffort;
    maxTokens?: number;
    webSearch?: boolean;
    temperature?: number;
  };
  const limits = limitsForTier(tierFromRequest(request));
  // Never log message content at this boundary; prompts are user-private data.
  const requestedModel = body.model ?? "umbra-auto";
  const configuredModels = availableModels();
  const lastPrompt = [...body.messages]
    .reverse()
    .find((message) => message.role === "user")?.content;
  const routingPrompt =
    typeof lastPrompt === "string"
      ? lastPrompt
      : (lastPrompt
          ?.filter((part) => part.type === "text")
          .map((part) => part.text)
          .join(" ") ?? "");
  const decision =
    requestedModel === "umbra-auto"
      ? route(routingPrompt, configuredModels)
      : {
          model: requestedModel,
          reason: "selected manually",
        };
  const provider = providerFor(decision.model);
  const maxTokens =
    typeof body.maxTokens === "number" &&
    Number.isFinite(body.maxTokens) &&
    body.maxTokens >= 256
      ? Math.min(Math.floor(body.maxTokens), limits.chatMaxTokens)
      : undefined;
  const temperature =
    typeof body.temperature === "number" &&
    Number.isFinite(body.temperature) &&
    body.temperature >= 0 &&
    body.temperature <= 2
      ? body.temperature
      : undefined;
  try {
    const stream = await provider.stream(body.messages, decision.model, {
      reasoningEffort: body.effort,
      maxTokens,
      webSearch: body.webSearch === true,
      temperature,
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Umbra-Route-Model": decision.model,
        "X-Umbra-Route-Reason": decision.reason,
        "X-Umbra-Tier-Max-Tokens": String(limits.chatMaxTokens),
      },
    });
  } catch {
    return new Response("Provider unavailable", { status: 502 });
  }
}
