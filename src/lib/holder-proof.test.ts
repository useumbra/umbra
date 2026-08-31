import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { describe, expect, it } from "vitest";
import {
  challengeMessage,
  challengeNonce,
  createChallenge,
  createHolderProof,
  readHolderProof,
  recoverSigner,
  verifyChallenge,
} from "./holder-proof";

const privateKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const signerAddress = () =>
  `0x${hex(
    keccak_256(secp256k1.getPublicKey(privateKey, false).slice(1)),
  ).slice(-40)}`;
describe("holder proof", () => {
  it("recovers the signer from EIP-191 signatures", () => {
    for (const recovery of [0, 1]) {
      let message = "";
      let signature;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        message = challengeMessage(
          signerAddress(),
          2_000_000_000,
          `nonce-${attempt}`,
        );
        const bytes = new TextEncoder().encode(message);
        const prefix = new TextEncoder().encode(
          `\x19Ethereum Signed Message:\n${bytes.length}`,
        );
        signature = secp256k1.sign(
          keccak_256(Uint8Array.from([...prefix, ...bytes])),
          privateKey,
          { prehash: false },
        );
        if (signature.recovery === recovery) break;
      }
      expect(signature?.recovery).toBe(recovery);
      const compact = signature!.toCompactRawBytes();
      const encoded = `0x${hex(compact)}${(recovery + 27)
        .toString(16)
        .padStart(2, "0")}`;
      expect(recoverSigner(message, encoded)).toBe(signerAddress());
    }
  });

  it("rejects malformed signatures", () => {
    expect(recoverSigner("message", "0x1234")).toBeUndefined();
    expect(recoverSigner("message", `0x${"00".repeat(64)}1f`)).toBeUndefined();
  });

  it("verifies challenge nonces and expiry", () => {
    const challenge = createChallenge(signerAddress());
    expect(
      verifyChallenge(signerAddress(), challenge.expiresAt, challenge.nonce),
    ).toBe(true);
    expect(
      verifyChallenge(
        signerAddress(),
        challenge.expiresAt,
        challengeNonce(signerAddress(), challenge.expiresAt + 1),
      ),
    ).toBe(false);
    expect(
      verifyChallenge(
        signerAddress(),
        Math.floor(Date.now() / 1000) - 1,
        challenge.nonce,
      ),
    ).toBe(false);
  });

  it("round-trips holder proofs and rejects tampering or expiry", () => {
    const proof = createHolderProof(signerAddress(), "holder", "123.45");
    expect(readHolderProof(proof)).toMatchObject({
      addr: signerAddress(),
      tier: "holder",
      bal: "123.45",
    });
    const [payload, signature] = proof.split(".");
    expect(readHolderProof(`${`${payload}x`}.${signature}`)).toBeUndefined();
    expect(
      readHolderProof(createHolderProof(signerAddress(), "base", "0", -1)),
    ).toBeUndefined();
  });
});
