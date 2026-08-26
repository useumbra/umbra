import { NextRequest } from "next/server";
import {
  parseMcpResponse,
  readMcpBody,
  validateMcpRequest,
} from "../../../lib/mcp";

const timeoutMs = 15_000;

const jsonError = (error: unknown, status: number) =>
  Response.json(
    {
      error:
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "MCP proxy request failed.",
    },
    { status },
  );

export async function POST(request: NextRequest) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }
  const parsed = validateMcpRequest(input);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const { value } = parsed;
  const headers: Record<string, string> = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  };
  if (value.header) headers[value.header.name] = value.header.value;
  let upstream: Response;
  try {
    upstream = await fetch(value.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: value.method,
        params: value.params,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return jsonError("MCP endpoint could not be reached.", 502);
  }
  let parsedResponse: unknown;
  try {
    parsedResponse = parseMcpResponse(
      await readMcpBody(upstream),
      upstream.headers.get("content-type") ?? "",
    );
  } catch (error) {
    return jsonError(error, 502);
  }
  if (!upstream.ok)
    return Response.json(
      {
        error: {
          type: "upstream",
          status: upstream.status,
          response: parsedResponse,
        },
      },
      { status: 502 },
    );
  if (
    typeof parsedResponse === "object" &&
    parsedResponse !== null &&
    Object.hasOwn(parsedResponse, "error")
  )
    return Response.json(
      { error: { type: "json-rpc", response: parsedResponse } },
      { status: 502 },
    );
  return Response.json(parsedResponse);
}
