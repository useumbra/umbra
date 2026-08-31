import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { signPayload, verifySignedPayload } from "./api-auth";

export const CHALLENGE_TTL_SECONDS = 300;
const holderTierIds = new Set(["base", "holder", "circle", "council"]);

export const isAddress = (value: string) => /^0x[0-9a-fA-F]{40}$/.test(value);

export const challengeNonce = (address: string, expiresAt: number) =>
  signPayload(`holder-challenge:${address.toLowerCase()}:${expiresAt}`);

export const challengeMessage = (
  address: string,
  expiresAt: number,
  nonce: string,
): string => `Umbra holder verification

Address: ${address.toLowerCase()}
Nonce: ${nonce}
Expires: ${new Date(expiresAt * 1000).toISOString()}

Signing proves you control this wallet. It costs no gas and authorizes no transaction.`;

export const createChallenge = (address: string) => {
  const expiresAt = Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS;
  const nonce = challengeNonce(address, expiresAt);
  return {
    expiresAt,
    nonce,
    message: challengeMessage(address, expiresAt, nonce),
  };
};

export const verifyChallenge = (
  address: string,
  expiresAt: number,
  nonce: string,
) =>
  Number.isInteger(expiresAt) &&
  expiresAt > Math.floor(Date.now() / 1000) &&
  verifySignedPayload(
    `holder-challenge:${address.toLowerCase()}:${expiresAt}`,
    nonce,
  );

const hexBytes = (value: string) =>
  Uint8Array.from(
    value.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
  );

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const recoverSigner = (
  message: string,
  signature: string,
): string | undefined => {
  try {
    if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) return undefined;
    const bytes = new TextEncoder().encode(message);
    const prefix = new TextEncoder().encode(
      `\x19Ethereum Signed Message:\n${bytes.length}`,
    );
    const digest = keccak_256(Uint8Array.from([...prefix, ...bytes]));
    const signatureBytes = hexBytes(signature.slice(2));
    const recovery = signatureBytes[64];
    const recoveryBit = recovery >= 27 ? recovery - 27 : recovery;
    if (recoveryBit !== 0 && recoveryBit !== 1) return undefined;
    const publicKey = secp256k1.Signature.fromCompact(
      signatureBytes.slice(0, 64),
    )
      .addRecoveryBit(recoveryBit)
      .recoverPublicKey(digest)
      .toRawBytes(false);
    return `0x${hex(keccak_256(publicKey.slice(1))).slice(-40)}`;
  } catch {
    return undefined;
  }
};

export type HolderProofClaims = {
  addr: string;
  tier: string;
  bal: string;
  iat: number;
  exp: number;
};

const encode = (value: string) => Buffer.from(value).toString("base64url");

export const createHolderProof = (
  address: string,
  tier: string,
  balance: string,
  lifetimeSeconds = 86_400,
): string => {
  const now = Math.floor(Date.now() / 1000);
  const claims: HolderProofClaims = {
    addr: address.toLowerCase(),
    tier,
    bal: balance,
    iat: now,
    exp: now + lifetimeSeconds,
  };
  const payload = encode(JSON.stringify(claims));
  return `${payload}.${signPayload(payload)}`;
};

export const readHolderProof = (
  token: string,
): HolderProofClaims | undefined => {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return undefined;
    const [payload, signature] = parts;
    if (!payload || !signature || !verifySignedPayload(payload, signature))
      return undefined;
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<HolderProofClaims>;
    const { addr, tier, bal, iat, exp } = claims;
    if (
      typeof addr !== "string" ||
      !isAddress(addr) ||
      typeof tier !== "string" ||
      !holderTierIds.has(tier) ||
      typeof bal !== "string" ||
      typeof iat !== "number" ||
      typeof exp !== "number" ||
      !Number.isInteger(iat) ||
      !Number.isInteger(exp) ||
      exp <= Math.floor(Date.now() / 1000)
    )
      return undefined;
    return {
      addr: addr.toLowerCase(),
      tier,
      bal,
      iat,
      exp,
    };
  } catch {
    return undefined;
  }
};
