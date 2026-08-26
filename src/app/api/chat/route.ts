import { NextRequest } from "next/server";
import { OpenRouterProvider } from "@/lib/providers/openrouter";
import { StubProvider } from "@/lib/providers/stub";
import type { ReasoningEffort } from "@/lib/providers/types";
export const runtime = "edge";
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    messages: { role: "user" | "assistant" | "system"; content: string }[];
    model?: string;
    effort?: ReasoningEffort;
  };
  // Never log message content at this boundary; prompts are user-private data.
  const provider = process.env.OPENROUTER_API_KEY
    ? new OpenRouterProvider()
    : new StubProvider();
  try {
    const stream = await provider.stream(
      body.messages,
      body.model ?? "umbra-auto",
      { reasoningEffort: body.effort },
    );
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new Response("Provider unavailable", { status: 502 });
  }
}
