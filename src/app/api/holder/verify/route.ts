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
import { formatUnits, readTokenBalance } from "@/lib/wallet";
import { UpstreamError } from "@/lib/providers/upstream";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createHash } from "node:crypto";

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

type BalanceStore = {
  get: (key: string) => Promise<string | null>;
  put: (
    key: string,
    value: string,
    options: { expirationTtl: number },
  ) => Promise<void>;
};

const getBalanceStore = async (): Promise<BalanceStore | undefined> => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv & { UMBRA_KEYS?: BalanceStore }).UMBRA_KEYS;
  } catch {
    return undefined;
  }
};

const balanceCacheKey = (address: string) =>
  `bal:${createHash("sha256").update(address).digest("hex")}`;

const readCachedBalance = async (
  store: BalanceStore | undefined,
  key: string,
) => {
  if (!store) return undefined;
  try {
    return await store.get(key);
  } catch {
    return undefined;
  }
};

const writeCachedBalance = async (
  store: BalanceStore | undefined,
  key: string,
  raw: bigint,
) => {
  if (!store) return;
  try {
    await store.put(key, raw.toString(10), { expirationTtl: 60 });
  } catch {
    // Cache failures must not block holder verification.
  }
};

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
  let raw: bigint;
  try {
    const store = await getBalanceStore();
    const key = balanceCacheKey(normalizedAddress);
    const cached = await readCachedBalance(store, key);
    let fromCache = false;
    if (cached !== null && cached !== undefined) {
      try {
        raw = BigInt(cached);
        fromCache = true;
      } catch {
        raw = await readTokenBalance(brand.token.address, normalizedAddress);
      }
    } else {
      raw = await readTokenBalance(brand.token.address, normalizedAddress);
    }
    if (!fromCache) await writeCachedBalance(store, key, raw);
  } catch (error) {
    return Response.json(
      {
        error: {
          message: "Robinhood Chain RPC is unavailable",
          type: "api_error",
        },
        ...(error instanceof UpstreamError ? { upstream: error.status } : {}),
      },
      { status: 502 },
    );
  }
  const balance = formatUnits(raw, brand.token.decimals, 2);
  const tier = tierForBalance(raw, brand.token.decimals);
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
