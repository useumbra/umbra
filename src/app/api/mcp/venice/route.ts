import { models, type ModelConfig } from "../../../../config/models";
import { requireApiAuth } from "../../../../lib/api-auth";

export const runtime = "nodejs";

const timeoutMs = 20_000;
const veniceBaseUrl = "https://api.venice.ai/api/v1";
const protocolVersion = "2024-11-05";

type JsonRpcId = string | number | null;
type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const jsonRpc = (id: JsonRpcId, result: unknown) =>
  Response.json({ jsonrpc: "2.0", id, result });

const jsonRpcError = (
  id: JsonRpcId,
  code: number,
  message: string,
  status = 200,
) =>
  Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });

const textContent = (text: string) => ({
  content: [{ type: "text", text }],
});

const tools = [
  {
    name: "venice_web_answer",
    description:
      "Answer a question with Venice web search and return cited sources.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 2000 },
        model: {
          type: "string",
          enum: ["venice-private", "venice-flash", "venice-deep"],
          default: "venice-flash",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "venice_characters_search",
    description: "Search Venice characters by name, description, or tags.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 64 },
        limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "venice_models",
    description: "List models available from the Venice API.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["text", "image", "embedding"],
          default: "text",
        },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
      },
      additionalProperties: false,
    },
  },
] as const;

const veniceModels = () =>
  models.filter((model) => model.provider === "venice");

const selectedVeniceModel = (value: unknown): ModelConfig | undefined => {
  if (value === undefined)
    return veniceModels().find((model) => model.id === "venice-flash");
  if (typeof value !== "string") return undefined;
  return veniceModels().find((model) => model.id === value);
};

const fetchVenice = async (path: string, init?: RequestInit) => {
  const key = process.env.VENICE_API_KEY?.trim();
  if (!key) throw new Error("Venice is not configured");
  let response: Response;
  try {
    response = await fetch(`${veniceBaseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new Error("Venice request failed");
  }
  if (!response.ok) throw new Error("Venice request failed");
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error("Venice request failed");
  }
};

const stringValue = (value: unknown) =>
  typeof value === "string" ? value : undefined;

const isIntegerInRange = (value: unknown, minimum: number, maximum: number) =>
  value === undefined ||
  (typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum);

const webAnswer = async (args: RecordValue) => {
  if (
    Object.keys(args).some((key) => !["query", "model"].includes(key)) ||
    typeof args.query !== "string" ||
    !args.query.trim() ||
    args.query.length > 2000
  )
    throw new Error("Invalid venice_web_answer arguments");
  const chosen = selectedVeniceModel(args.model);
  if (!chosen) throw new Error("Invalid venice_web_answer model");
  const response = await fetchVenice("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: chosen.upstreamSlug,
      messages: [{ role: "user", content: args.query }],
      stream: false,
      max_tokens: 800,
      ...(chosen.capabilities.reasoning ? { reasoning_effort: "none" } : {}),
      venice_parameters: {
        enable_web_search: "on",
        enable_web_citations: true,
      },
    }),
  });
  if (!isRecord(response)) throw new Error("Venice request failed");
  const choices = response.choices;
  const firstChoice =
    Array.isArray(choices) && isRecord(choices[0]) ? choices[0] : undefined;
  const message =
    firstChoice && isRecord(firstChoice.message)
      ? firstChoice.message
      : undefined;
  const answer = message ? stringValue(message.content) : undefined;
  if (!answer?.trim()) throw new Error("Venice request failed");
  const parameters = isRecord(response.venice_parameters)
    ? response.venice_parameters
    : undefined;
  const citations = parameters?.web_search_citations;
  const urls = Array.isArray(citations)
    ? Array.from(
        new Set(
          citations.flatMap((citation) => {
            if (!isRecord(citation) || typeof citation.url !== "string")
              return [];
            try {
              return [new URL(citation.url).toString()];
            } catch {
              return [];
            }
          }),
        ),
      )
    : [];
  const sources = urls.length
    ? `\n\nSources:\n${urls.map((url) => `- ${url}`).join("\n")}`
    : "";
  return textContent(`${answer.trim()}${sources}`);
};

const characterSearch = async (args: RecordValue) => {
  if (
    Object.keys(args).some((key) => !["query", "limit"].includes(key)) ||
    typeof args.query !== "string" ||
    !args.query.trim() ||
    args.query.length > 64 ||
    !isIntegerInRange(args.limit, 1, 10)
  )
    throw new Error("Invalid venice_characters_search arguments");
  const limit = typeof args.limit === "number" ? args.limit : 5;
  const response = await fetchVenice("/characters");
  const values =
    isRecord(response) && Array.isArray(response.data) ? response.data : [];
  const query = args.query.toLocaleLowerCase();
  const lines = values
    .filter(isRecord)
    .filter((character) => {
      const haystack = [
        character.name,
        character.description,
        ...(Array.isArray(character.tags) ? character.tags : []),
      ]
        .filter((value): value is string => typeof value === "string")
        .join(" ")
        .toLocaleLowerCase();
      return haystack.includes(query);
    })
    .slice(0, limit)
    .map((character) => {
      const name = stringValue(character.name) ?? "Unnamed";
      const slug = stringValue(character.slug) ?? "";
      const description = stringValue(character.description) ?? "";
      const shareUrl = stringValue(character.shareUrl) ?? "";
      return `${name} — ${slug} — ${description} — ${shareUrl}`;
    });
  return textContent(
    lines.length ? lines.join("\n") : "No matching characters.",
  );
};

const formatModelValue = (value: unknown) => {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
};

const veniceModelList = async (args: RecordValue) => {
  if (
    Object.keys(args).some((key) => !["type", "limit"].includes(key)) ||
    (args.type !== undefined &&
      !["text", "image", "embedding"].includes(String(args.type))) ||
    !isIntegerInRange(args.limit, 1, 20)
  )
    throw new Error("Invalid venice_models arguments");
  const type = typeof args.type === "string" ? args.type : "text";
  const limit = typeof args.limit === "number" ? args.limit : 10;
  const response = await fetchVenice(
    `/models?type=${encodeURIComponent(type)}`,
  );
  const values =
    isRecord(response) && Array.isArray(response.data) ? response.data : [];
  const lines = values
    .filter(isRecord)
    .slice(0, limit)
    .flatMap((model) => {
      const id = stringValue(model.id);
      if (!id) return [];
      const spec = isRecord(model.model_spec) ? model.model_spec : {};
      const displayName =
        stringValue(spec.name) ?? stringValue(model.name) ?? undefined;
      const details = Object.entries({ ...model, ...spec })
        .filter(
          ([key, value]) =>
            /price|pricing|context/i.test(key) && value !== undefined,
        )
        .map(([key, value]) => {
          const formatted = formatModelValue(value);
          return formatted ? `${key}: ${formatted}` : undefined;
        })
        .filter((value): value is string => value !== undefined);
      return [
        `${id}${displayName ? ` — ${displayName}` : ""}${details.length ? ` — ${details.join(", ")}` : ""}`,
      ];
    });
  return textContent(
    lines.length ? lines.join("\n") : "No Venice models found.",
  );
};

const callTool = async (name: unknown, args: unknown) => {
  if (typeof name !== "string" || !isRecord(args))
    throw new Error("Invalid tools/call arguments");
  if (name === "venice_web_answer") return webAnswer(args);
  if (name === "venice_characters_search") return characterSearch(args);
  if (name === "venice_models") return veniceModelList(args);
  throw new Error("Unknown tool");
};

const requestId = (value: RecordValue): JsonRpcId => {
  if (typeof value.id === "string" || typeof value.id === "number")
    return value.id;
  return null;
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, -32600, "Invalid Request", 400);
  }
  if (!isRecord(body))
    return jsonRpcError(null, -32600, "Invalid Request", 400);
  const id = requestId(body);
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return jsonRpcError(id, -32001, "Invalid API key", 401);
  if (!process.env.VENICE_API_KEY?.trim())
    return jsonRpcError(id, -32000, "Venice is not configured", 503);
  if (body.jsonrpc !== "2.0" || typeof body.method !== "string")
    return jsonRpcError(id, -32600, "Invalid Request", 400);
  if (body.method === "initialize")
    return jsonRpc(id, {
      protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: "umbra-venice", version: "1.0.0" },
    });
  if (body.method === "tools/list") return jsonRpc(id, { tools });
  if (body.method !== "tools/call")
    return jsonRpcError(id, -32601, "Method not found");
  if (!isRecord(body.params))
    return jsonRpcError(id, -32602, "Invalid tools/call arguments");
  try {
    const toolArguments = Object.hasOwn(body.params, "arguments")
      ? body.params.arguments
      : {};
    const result = await callTool(body.params.name, toolArguments);
    return jsonRpc(id, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Invalid") || message === "Unknown tool")
      return jsonRpcError(id, -32602, message);
    return jsonRpcError(id, -32000, "Venice request failed", 502);
  }
}
