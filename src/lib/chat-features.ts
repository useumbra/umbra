export type Citation = {
  url: string;
  title: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const extractCitations = (value: unknown): Citation[] => {
  if (!Array.isArray(value)) return [];
  const citations: Citation[] = [];
  for (const item of value) {
    if (!isRecord(item) || item.type !== "url_citation") continue;
    const citation = item.url_citation;
    if (!isRecord(citation) || typeof citation.url !== "string") continue;
    let url: URL;
    try {
      url = new URL(citation.url);
    } catch {
      continue;
    }
    if (!["http:", "https:"].includes(url.protocol)) continue;
    if (citations.some((entry) => entry.url === url.toString())) continue;
    citations.push({
      url: url.toString(),
      title:
        typeof citation.title === "string" && citation.title.trim()
          ? citation.title.trim()
          : url.hostname,
    });
  }
  return citations;
};

export type ToolCall =
  | { kind: "none" }
  | { kind: "invalid"; error: string }
  | { kind: "call"; tool: string; arguments: Record<string, unknown> };

export const parseToolCall = (
  text: string,
  availableTools?: Iterable<string>,
): ToolCall => {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return { kind: "none" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { kind: "invalid", error: "The tool request was not valid JSON." };
  }
  if (!isRecord(parsed) || typeof parsed.tool !== "string") {
    return { kind: "none" };
  }
  if (
    !Object.keys(parsed).every((key) => key === "tool" || key === "arguments")
  )
    return {
      kind: "invalid",
      error: "The tool request contained extra fields.",
    };
  if (!parsed.tool.trim())
    return { kind: "invalid", error: "The tool request did not name a tool." };
  if (
    !isRecord(parsed.arguments) ||
    Array.isArray(parsed.arguments) ||
    parsed.arguments === null
  )
    return {
      kind: "invalid",
      error: "The tool request arguments must be a JSON object.",
    };
  const known = availableTools && new Set(availableTools);
  if (known && !known.has(parsed.tool))
    return { kind: "invalid", error: `Unknown tool requested: ${parsed.tool}` };
  return { kind: "call", tool: parsed.tool, arguments: parsed.arguments };
};

export const schemaSummary = (schema: unknown) => {
  if (!isRecord(schema)) return "{}";
  const properties = isRecord(schema.properties)
    ? Object.keys(schema.properties)
    : [];
  const required = Array.isArray(schema.required)
    ? schema.required.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  return JSON.stringify({ properties, required });
};
