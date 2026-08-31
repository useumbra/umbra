import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { models } from "@/config/models";
import { createHolderProof } from "@/lib/holder-proof";
import { UpstreamError } from "@/lib/providers/upstream";

const mockProvider = vi.hoisted(() => ({
  stream: vi.fn(),
}));

vi.mock("@/lib/providers/select", () => ({
  availableModels: () => models,
  providerFor: () => mockProvider,
}));

import { POST } from "./route";

const privateKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const address = `0x${hex(
  keccak_256(secp256k1.getPublicKey(privateKey, false).slice(1)),
).slice(-40)}`;

afterEach(() => {
  mockProvider.stream.mockReset();
  vi.restoreAllMocks();
});

const request = (proof?: string) =>
  new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(proof ? { "x-umbra-holder-proof": proof } : {}),
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Give me three dinner ideas." }],
      model: "umbra-auto",
    }),
  });

const councilProof = () => createHolderProof(address, "council", "0");

describe("chat holder priority", () => {
  it("retries a congested provider for a Council proof", async () => {
    mockProvider.stream
      .mockRejectedValueOnce(new UpstreamError(429, "Provider unavailable"))
      .mockResolvedValueOnce(new ReadableStream<Uint8Array>());

    const response = await POST(request(councilProof()));

    expect(response.status).toBe(200);
    expect(mockProvider.stream).toHaveBeenCalledTimes(2);
    expect(mockProvider.stream.mock.calls[0]?.[1]).toBe("sage-sonnet");
    expect(response.headers.get("X-Umbra-Tier-Retries")).toBe("3");
  });

  it("does not retry a congested provider for Base", async () => {
    mockProvider.stream.mockRejectedValueOnce(
      new UpstreamError(429, "Provider unavailable"),
    );

    const response = await POST(request());

    expect(response.status).toBe(502);
    expect(mockProvider.stream).toHaveBeenCalledTimes(1);
    expect(mockProvider.stream.mock.calls[0]?.[1]).toBe("nova-4");
    expect(response.headers.get("X-Umbra-Tier-Retries")).toBeNull();
  });
});
