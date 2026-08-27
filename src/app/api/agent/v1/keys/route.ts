import { createApiTokenDetails, validateApiKeyOptions } from "@/lib/api-auth";

export const runtime = "nodejs";

const invalid = (message: string) =>
  Response.json(
    { error: { message, type: "invalid_request_error" } },
    { status: 400 },
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export async function POST(request: Request) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return invalid("Request body must be valid JSON");
  }
  const options = validateApiKeyOptions(isRecord(body) ? body : {});
  if (typeof options === "string") return invalid(options);
  const { token, claims } = createApiTokenDetails(
    "developer",
    options.days * 86_400,
    options.label,
  );
  return Response.json({
    key: token,
    jti: claims.jti,
    label: claims.label,
    createdAt: new Date(claims.iat * 1000).toISOString(),
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  });
}
