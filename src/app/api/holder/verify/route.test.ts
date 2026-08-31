import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { challengeMessage, challengeNonce } from "../../../../lib/holder-proof";
import { POST } from "./route";

const privateKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const address = `0x${hex(
  keccak_256(secp256k1.getPublicKey(privateKey, false).slice(1)),
).slice(-40)}`;

afterEach(() => {
  vi.unstubAllGlobals();
});

const request = (body: unknown) =>
  new NextRequest("http://localhost/api/holder/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("holder verification upstream status", () => {
  it("returns the RPC upstream status without private RPC details", async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 300;
    const nonce = challengeNonce(address, expiresAt);
    const message = challengeMessage(address, expiresAt, nonce);
    const messageBytes = new TextEncoder().encode(message);
    const prefix = new TextEncoder().encode(
      `\x19Ethereum Signed Message:\n${messageBytes.length}`,
    );
    const signature = secp256k1.sign(
      keccak_256(Uint8Array.from([...prefix, ...messageBytes])),
      privateKey,
      { prehash: false },
    );
    const encodedSignature = `0x${hex(signature.toCompactRawBytes())}${(
      signature.recovery + 27
    )
      .toString(16)
      .padStart(2, "0")}`;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: -32000, message: "private RPC detail" },
            }),
            { status: 200 },
          ),
      ),
    );

    const response = await POST(
      request({ address, nonce, expiresAt, signature: encodedSignature }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "Robinhood Chain RPC is unavailable",
        type: "api_error",
      },
      upstream: 502,
    });
  });
});
