import {
  createApiTokenDetails,
  dailyQuotaForTier,
  validateApiKeyOptions,
} from "@/lib/api-auth";
import { readHolderProof } from "@/lib/holder-proof";

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
  const proof =
    isRecord(body) && body.proof !== undefined ? body.proof : undefined;
  if (proof !== undefined && typeof proof !== "string")
    return invalid("holder proof is invalid or expired");
  const holderProof = proof !== undefined ? readHolderProof(proof) : undefined;
  if (proof !== undefined && !holderProof)
    return invalid("holder proof is invalid or expired");
  const tier = holderProof?.tier;
  const { token, claims } = createApiTokenDetails(
    "developer",
    options.days * 86_400,
    options.label,
    tier,
  );
  return Response.json({
    key: token,
    jti: claims.jti,
    label: claims.label,
    createdAt: new Date(claims.iat * 1000).toISOString(),
    expiresAt: new Date(claims.exp * 1000).toISOString(),
    tier: tier ?? "base",
    dailyQuota: dailyQuotaForTier(tier),
  });
}
