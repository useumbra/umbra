import { NextRequest } from "next/server";
import { limitsForTier } from "@/lib/holder-limits";
import { tierFromRequest } from "@/lib/holder-request";
import { priorityForTier, retryableProviderStatuses } from "@/lib/priority";
import { availableModels, providerFor } from "@/lib/providers/select";
import type { ReasoningEffort } from "@/lib/providers/types";
import { UpstreamError } from "@/lib/providers/upstream";
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
  const tier = tierFromRequest(request);
  const limits = limitsForTier(tier);
  const priority = priorityForTier(tier);
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
      ? route(routingPrompt, configuredModels, {
          upgradeGeneralRoute: priority.upgradeGeneralRoute,
        })
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
  for (let attempt = 0; attempt <= priority.retries; attempt += 1) {
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
          "X-Umbra-Tier-Retries": String(priority.retries),
        },
      });
    } catch (error) {
      if (
        !(error instanceof UpstreamError) ||
        !retryableProviderStatuses.has(error.status) ||
        attempt === priority.retries
      )
        return new Response("Provider unavailable", { status: 502 });
      const delay = [300, 900, 1800][attempt] ?? 1800;
      await new Promise<void>((resolve) =>
        setTimeout(resolve, delay * (0.75 + Math.random() * 0.5)),
      );
    }
  }
  return new Response("Provider unavailable", { status: 502 });
}
