import { limitsForTier } from "@/lib/holder-limits";
import { readHolderProof } from "@/lib/holder-proof";
import { holderBonusPercent } from "@/lib/credits/holder-rate";
import { unlockedFeatures } from "@/lib/holder-features";

export const runtime = "nodejs";

const invalid = () =>
  Response.json(
    {
      error: {
        message: "holder proof is invalid or expired",
        type: "invalid_request_error",
      },
    },
    { status: 400 },
  );

export async function POST(request: Request) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return invalid();
  }
  const proof =
    typeof body === "object" &&
    body !== null &&
    "proof" in body &&
    typeof body.proof === "string"
      ? body.proof
      : undefined;
  if (
    typeof body === "object" &&
    body !== null &&
    "proof" in body &&
    body.proof !== undefined &&
    typeof body.proof !== "string"
  )
    return invalid();
  const claims = proof ? readHolderProof(proof) : undefined;
  if (proof && !claims) return invalid();
  const tier = claims?.tier;
  return Response.json({
    tier: tier ?? "base",
    limits: limitsForTier(tier),
    ...(claims ? { address: claims.addr } : {}),
    creditBonusPercent: holderBonusPercent(tier),
    features: unlockedFeatures(tier).map((feature) => feature.id),
  });
}
