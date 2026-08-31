import { brand } from "@/config/brand";
import {
  challengeMessage,
  createHolderProof,
  isAddress,
  readHolderProof,
  recoverSigner,
  verifyChallenge,
} from "@/lib/holder-proof";
import { tierForBalance } from "@/lib/holder";
import { formatUnits, getTokenDecimals, readTokenBalance } from "@/lib/wallet";

export const runtime = "nodejs";

const invalid = (message: string) =>
  Response.json(
    { error: { message, type: "invalid_request_error" } },
    { status: 400 },
  );

const authenticationError = (message: string) =>
  Response.json(
    { error: { message, type: "authentication_error" } },
    { status: 401 },
  );

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid("Request body must be valid JSON");
  }
  const data =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const address = typeof data.address === "string" ? data.address : undefined;
  const nonce = typeof data.nonce === "string" ? data.nonce : undefined;
  const expiresAt =
    typeof data.expiresAt === "number" ? data.expiresAt : undefined;
  const signature =
    typeof data.signature === "string" ? data.signature : undefined;
  if (
    !address ||
    !isAddress(address) ||
    !nonce ||
    expiresAt === undefined ||
    !Number.isInteger(expiresAt) ||
    !signature
  )
    return invalid("address, nonce, expiresAt, and signature are required");
  const normalizedAddress = address.toLowerCase();
  if (!verifyChallenge(normalizedAddress, expiresAt, nonce))
    return authenticationError("Challenge expired or invalid");
  const message = challengeMessage(normalizedAddress, expiresAt, nonce);
  const signer = recoverSigner(message, signature);
  if (!signer || signer.toLowerCase() !== normalizedAddress)
    return authenticationError("Signature does not match the address");
  let decimals: number;
  let raw: bigint;
  try {
    [decimals, raw] = await Promise.all([
      getTokenDecimals(brand.token.address),
      readTokenBalance(brand.token.address, normalizedAddress),
    ]);
  } catch {
    return Response.json(
      {
        error: {
          message: "Robinhood Chain RPC is unavailable",
          type: "api_error",
        },
      },
      { status: 502 },
    );
  }
  const balance = formatUnits(raw, decimals, 2);
  const tier = tierForBalance(raw, decimals);
  const proof = createHolderProof(normalizedAddress, tier.id, balance);
  const proofClaims = readHolderProof(proof);
  if (!proofClaims)
    return Response.json(
      {
        error: {
          message: "Could not create holder proof",
          type: "api_error",
        },
      },
      { status: 500 },
    );
  return Response.json({
    address: normalizedAddress,
    balance,
    tier: tier.id,
    tierName: tier.name,
    proof,
    expiresAt: proofClaims.exp,
  });
}
