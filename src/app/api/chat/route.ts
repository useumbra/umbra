import { NextRequest } from "next/server";
import { OpenRouterProvider } from "@/lib/providers/openrouter";
import { StubProvider } from "@/lib/providers/stub";
import type { ReasoningEffort } from "@/lib/providers/types";
import { models } from "@/config/models";
import { route } from "@/lib/router";
export const runtime = "edge";
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    messages: { role: "user" | "assistant" | "system"; content: string }[];
    model?: string;
    effort?: ReasoningEffort;
  };
  // Never log message content at this boundary; prompts are user-private data.
  const requestedModel = body.model ?? "umbra-auto";
  const lastPrompt =
    [...body.messages].reverse().find((message) => message.role === "user")
      ?.content ?? "";
  const decision =
    requestedModel === "umbra-auto"
      ? route(lastPrompt, models)
      : {
          model: requestedModel,
          reason: "selected manually",
        };
  const provider = process.env.OPENROUTER_API_KEY
    ? new OpenRouterProvider()
    : new StubProvider();
  try {
    const stream = await provider.stream(body.messages, decision.model, {
      reasoningEffort: body.effort,
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Umbra-Route-Model": decision.model,
        "X-Umbra-Route-Reason": decision.reason,
      },
    });
  } catch {
    return new Response("Provider unavailable", { status: 502 });
  }
}
