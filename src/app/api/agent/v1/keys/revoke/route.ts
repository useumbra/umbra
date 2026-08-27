import { revokeApiToken } from "@/lib/api-auth";

export const runtime = "nodejs";

const invalid = (message: string) =>
  Response.json(
    { error: { message, type: "invalid_request_error" } },
    { status: 400 },
  );

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid("Request body must be valid JSON");
  }
  const key =
    typeof body === "object" &&
    body !== null &&
    "key" in body &&
    typeof body.key === "string"
      ? body.key
      : undefined;
  if (!key) return invalid("key is required");
  const claims = await revokeApiToken(key);
  if (!claims?.jti) return invalid("Invalid API key");
  return Response.json({ revoked: true, jti: claims.jti });
}
