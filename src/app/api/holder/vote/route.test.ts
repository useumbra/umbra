import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createHolderProof } from "../../../../lib/holder-proof";
import { polls } from "../../../../lib/holder-vote";
import { GET, POST } from "./route";

const getCloudflareContext = vi.hoisted(() => vi.fn());
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));

type Entry = {
  metadata: { o: string; w: number };
};

const entries = new Map<string, Entry>();
const store = {
  put: vi.fn(
    async (
      key: string,
      _value: string,
      options: { metadata: { o: string; w: number }; expirationTtl: number },
    ) => {
      entries.set(key, { metadata: options.metadata });
    },
  ),
  list: vi.fn(async (options: { prefix: string; cursor?: string }) => {
    const keys = [...entries.entries()]
      .filter(([key]) => key.startsWith(options.prefix))
      .map(([name, value]) => ({ name, metadata: value.metadata }));
    const start = options.cursor ? Number(options.cursor) : 0;
    const page = keys.slice(start, start + 2);
    const next = start + page.length;
    return {
      keys: page,
      list_complete: next >= keys.length,
      ...(next < keys.length ? { cursor: String(next) } : {}),
    };
  }),
};

afterEach(() => {
  entries.clear();
  vi.clearAllMocks();
});

const request = (pollId: string) =>
  new NextRequest(`http://localhost/api/holder/vote?pollId=${pollId}`);

const postRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/holder/vote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const key = (pollId: string, address: string) =>
  `vote:${pollId}:${createHash("sha256")
    .update(address.toLowerCase())
    .digest("hex")}`;

const addresses = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
];

describe("holder vote route", () => {
  it("rejects an unknown poll", async () => {
    const response = await GET(request("missing"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { message: "Unknown poll", type: "invalid_request_error" },
    });
  });

  it("tallies metadata across paginated KV results", async () => {
    entries.set(key("provider", addresses[0]), {
      metadata: { o: "anthropic", w: 1 },
    });
    entries.set(key("provider", addresses[1]), {
      metadata: { o: "anthropic", w: 3 },
    });
    entries.set(key("provider", addresses[2]), {
      metadata: { o: "groq", w: 10 },
    });
    getCloudflareContext.mockResolvedValue({ env: { UMBRA_KEYS: store } });

    const response = await GET(request("provider"));
    const body = (await response.json()) as {
      options: { id: string; weight: number; voters: number }[];
      totalWeight: number;
      totalVoters: number;
    };

    expect(response.status).toBe(200);
    expect(body.options[0]).toMatchObject({
      id: "anthropic",
      weight: 4,
      voters: 2,
    });
    expect(body.options[1]).toMatchObject({
      id: "groq",
      weight: 10,
      voters: 1,
    });
    expect(body.totalWeight).toBe(14);
    expect(body.totalVoters).toBe(3);
    expect(store.list).toHaveBeenCalledTimes(2);
  });

  it("rejects missing and invalid proofs, and denies base holders", async () => {
    const missing = await POST(postRequest({}));
    expect(missing.status).toBe(400);
    const invalid = await POST(
      postRequest({ proof: "garbage", pollId: "provider", optionId: "groq" }),
    );
    expect(invalid.status).toBe(400);
    const base = await POST(
      postRequest({
        proof: createHolderProof(addresses[0], "base", "0"),
        pollId: "provider",
        optionId: "groq",
      }),
    );
    expect(base.status).toBe(403);
  });

  it("stores a holder vote and replaces a prior choice for that address", async () => {
    getCloudflareContext.mockResolvedValue({ env: { UMBRA_KEYS: store } });
    const proof = createHolderProof(addresses[0], "holder", "100000");
    const first = await POST(
      postRequest({
        proof,
        pollId: "provider",
        optionId: "anthropic",
      }),
    );
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({
      choice: "anthropic",
      weight: 1,
      totalWeight: 1,
      totalVoters: 1,
    });

    const second = await POST(
      postRequest({
        proof,
        pollId: "provider",
        optionId: "groq",
      }),
    );
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as {
      choice: string;
      weight: number;
      totalWeight: number;
      totalVoters: number;
      options: { id: string; weight: number; voters: number }[];
    };
    expect(secondBody).toMatchObject({
      choice: "groq",
      weight: 1,
      totalWeight: 1,
      totalVoters: 1,
    });
    expect(secondBody.options).toEqual(
      expect.arrayContaining([
        { id: "anthropic", label: "Anthropic direct", weight: 0, voters: 0 },
        { id: "groq", label: "Groq", weight: 1, voters: 1 },
      ]),
    );
    expect(entries).toHaveLength(1);
    expect(store.put).toHaveBeenCalledTimes(2);
  });

  it("rejects an unknown option and reports unavailable storage", async () => {
    getCloudflareContext.mockResolvedValue({ env: { UMBRA_KEYS: store } });
    const proof = createHolderProof(addresses[0], "holder", "100000");
    const unknown = await POST(
      postRequest({ proof, pollId: "provider", optionId: "missing" }),
    );
    expect(unknown.status).toBe(400);

    getCloudflareContext.mockResolvedValue({ env: {} });
    const unavailable = await POST(
      postRequest({ proof, pollId: "provider", optionId: "groq" }),
    );
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({
      error: { message: "Voting storage is unavailable", type: "api_error" },
    });
  });

  it("keeps the public option order", async () => {
    getCloudflareContext.mockResolvedValue({ env: { UMBRA_KEYS: store } });
    const response = await GET(request("provider"));
    const body = (await response.json()) as { options: { id: string }[] };
    expect(body.options.map((option) => option.id)).toEqual(
      polls[0]?.options.map((option) => option.id),
    );
  });
});
