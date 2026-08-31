import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { challengeMessage, challengeNonce } from "../../../../lib/holder-proof";
import { POST } from "./route";

const getCloudflareContext = vi.hoisted(() => vi.fn());
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));

const privateKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const address = `0x${hex(
  keccak_256(secp256k1.getPublicKey(privateKey, false).slice(1)),
).slice(-40)}`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const request = (body: unknown) =>
  new NextRequest("http://localhost/api/holder/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const signedBody = () => {
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
  return {
    address,
    nonce,
    expiresAt,
    signature: `0x${hex(signature.toCompactRawBytes())}${(
      signature.recovery + 27
    )
      .toString(16)
      .padStart(2, "0")}`,
  };
};

describe("holder verification upstream status", () => {
  it("returns the RPC upstream status without private RPC details", async () => {
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

    const response = await POST(request(signedBody()));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "Robinhood Chain RPC is unavailable",
        type: "api_error",
      },
      upstream: 502,
    });
  });

  it("uses the configured token decimals and cached balance", async () => {
    const store = {
      get: vi.fn(async (key: string) => {
        void key;
        return "1000000000000000000";
      }),
      put: vi.fn(async () => undefined),
    };
    getCloudflareContext.mockResolvedValue({ env: { UMBRA_KEYS: store } });
    const fetchMock = vi.fn(async () => {
      throw new Error("RPC should not be called for a cached balance");
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request(signedBody()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      balance: "1",
      tier: "base",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.get).toHaveBeenCalledWith(
      expect.stringMatching(/^bal:[0-9a-f]{64}$/),
    );
    expect(store.get.mock.calls[0]?.[0]).not.toContain(address.toLowerCase());
    expect(store.put).not.toHaveBeenCalled();
  });

  it("reads and caches the raw balance without an RPC decimals call", async () => {
    const store = {
      get: vi.fn(async (key: string) => {
        void key;
        return null;
      }),
      put: vi.fn(async () => undefined),
    };
    getCloudflareContext.mockResolvedValue({ env: { UMBRA_KEYS: store } });
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(String(init.body)) as { method: string };
      expect(payload.method).toBe("eth_call");
      return new Response(JSON.stringify({ result: "0xde0b6b3a7640000" }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request(signedBody()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      balance: "1",
      tier: "base",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({ method: "eth_call" });
    expect(store.put).toHaveBeenCalledWith(
      expect.stringMatching(/^bal:[0-9a-f]{64}$/),
      "1000000000000000000",
      { expirationTtl: 60 },
    );
  });
});
