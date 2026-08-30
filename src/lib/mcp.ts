const allowedMethods = ["initialize", "tools/list", "tools/call"] as const;
const responseLimit = 1024 * 1024;

export type JsonRpcMethod = (typeof allowedMethods)[number];
export type Header = { name: string; value: string };
export type McpProxyRequest = {
  url: string;
  method: JsonRpcMethod;
  params: unknown;
  header?: Header;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).every((key) => keys.includes(key));

const isJsonRpcMethod = (value: unknown): value is JsonRpcMethod =>
  typeof value === "string" &&
  allowedMethods.some((method) => method === value);

export const validateMcpRequest = (
  input: unknown,
): { ok: true; value: McpProxyRequest } | { ok: false; error: string } => {
  if (
    !isRecord(input) ||
    !hasOnlyKeys(input, ["url", "method", "params", "header"])
  )
    return {
      ok: false,
      error: "Request must be a JSON object with known fields.",
    };
  if (typeof input.url !== "string" || !input.url.trim())
    return { ok: false, error: "A URL is required." };
  if (!Object.hasOwn(input, "params"))
    return { ok: false, error: "MCP params are required." };
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.url);
  } catch {
    return { ok: false, error: "The connector URL is invalid." };
  }
  const isLocalDevelopment =
    process.env.NODE_ENV !== "production" &&
    parsedUrl.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname);
  if (parsedUrl.protocol !== "https:" && !isLocalDevelopment)
    return { ok: false, error: "Connector URL must use https." };
  if (!isJsonRpcMethod(input.method))
    return { ok: false, error: "MCP method is not allowed." };
  let header: Header | undefined;
  if (Object.hasOwn(input, "header")) {
    const candidate = input.header;
    if (
      !isRecord(candidate) ||
      !hasOnlyKeys(candidate, ["name", "value"]) ||
      typeof candidate.name !== "string" ||
      typeof candidate.value !== "string" ||
      !candidate.name ||
      !candidate.value
    )
      return { ok: false, error: "Header must include a name and value." };
    header = { name: candidate.name, value: candidate.value };
  }
  return {
    ok: true,
    value: {
      url: parsedUrl.toString(),
      method: input.method,
      params: input.params,
      ...(header ? { header } : {}),
    },
  };
};

export const parseMcpResponse = (
  body: string,
  contentType: string,
): unknown => {
  if (contentType.toLowerCase().includes("text/event-stream")) {
    for (const line of body.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed: unknown = JSON.parse(data);
        return parsed;
      } catch {
        continue;
      }
    }
    throw new Error("MCP SSE response did not contain a JSON data event.");
  }
  const parsed: unknown = JSON.parse(body);
  return parsed;
};

export const readMcpBody = async (response: Response) => {
  if (!response.body) {
    const body = await response.text();
    if (body.length > responseLimit)
      throw new Error("MCP response is too large.");
    return body;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > responseLimit) {
      await reader.cancel();
      throw new Error("MCP response is too large.");
    }
    chunks.push(value);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(output);
};
