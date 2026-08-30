import { availableModels, providerFor } from "@/lib/providers/select";
import { route } from "@/lib/router";
import { requireApiAuth } from "@/lib/api-auth";
import type { ProviderMessage } from "@/lib/providers/types";

export const runtime = "nodejs";

type IncomingMessage = {
  role: "user" | "assistant" | "system" | "developer";
  content: string | { type: "text"; text: string }[];
};

const normalizeMessages = (messages: IncomingMessage[]): ProviderMessage[] =>
  messages.map((message) => ({
    role: message.role === "developer" ? "system" : message.role,
    content:
      typeof message.content === "string"
        ? message.content
        : message.content.map((part) => part.text).join(""),
  }));

const readProvider = async (
  stream: ReadableStream<Uint8Array>,
  onText?: (text: string) => void,
) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let text = "";
  const consume = (line: string) => {
    if (!line) return;
    if (/^(?:event|id|retry):/.test(line)) return;
    if (!line.startsWith("data:")) {
      text += line;
      onText?.(line);
      return;
    }
    const payload = line.startsWith("data: ") ? line.slice(6) : line.slice(5);
    if (payload === "[DONE]") return;
    try {
      const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
      if (typeof delta === "string") {
        text += delta;
        onText?.(delta);
      }
    } catch {
      // Ignore malformed upstream protocol lines.
    }
  };
  while (true) {
    const result = await reader.read();
    pending += decoder.decode(result.value, { stream: !result.done });
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    lines.forEach(consume);
    if (result.done) {
      consume(pending);
      break;
    }
  }
  return text;
};

const chunk = (id: string, model: string, content: string) =>
  `data: ${JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
  })}\n\n`;

export async function POST(request: Request) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as {
    model?: string;
    messages?: IncomingMessage[];
    stream?: boolean;
  };
  if (!body.messages?.length)
    return Response.json(
      {
        error: {
          message: "messages is required",
          type: "invalid_request_error",
        },
      },
      { status: 400 },
    );
  const messages = normalizeMessages(body.messages);
  const requestedModel = body.model ?? "umbra-auto";
  const configuredModels = availableModels();
  const lastContent =
    [...messages].reverse().find((message) => message.role === "user")
      ?.content ?? "";
  const lastPrompt =
    typeof lastContent === "string"
      ? lastContent
      : lastContent
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join(" ");
  const decision =
    requestedModel === "umbra-auto"
      ? route(lastPrompt, configuredModels)
      : { model: requestedModel, reason: "selected manually" };
  if (!configuredModels.some((model) => model.id === decision.model))
    return Response.json(
      { error: { message: "Unknown model", type: "invalid_request_error" } },
      { status: 400 },
    );
  const provider = providerFor(decision.model);
  const upstream = await provider.stream(messages, decision.model);
  const completionId = `umbra-${crypto.randomUUID()}`;
  if (!body.stream) {
    const content = await readProvider(upstream);
    return Response.json({
      id: completionId,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: decision.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
      route: decision,
    });
  }
  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        await readProvider(upstream, (content) =>
          controller.enqueue(
            encoder.encode(chunk(completionId, decision.model, content)),
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch {
        controller.error(new Error("Provider unavailable"));
      }
    },
  });
  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Umbra-Route-Model": decision.model,
      "X-Umbra-Route-Reason": decision.reason,
    },
  });
}
