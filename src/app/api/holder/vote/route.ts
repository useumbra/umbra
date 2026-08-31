import { createHash } from "node:crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readHolderProof } from "@/lib/holder-proof";
import {
  canVote,
  findPoll,
  isPollOption,
  voteWeight,
  type Poll,
} from "@/lib/holder-vote";

export const runtime = "nodejs";

type VoteMetadata = {
  o?: unknown;
  w?: unknown;
};

type VoteKey = {
  name: string;
  metadata?: VoteMetadata;
};

type VoteListResult = {
  keys: VoteKey[];
  list_complete?: boolean;
  cursor?: string;
};

type VoteStore = {
  put: (
    key: string,
    value: string,
    options: {
      metadata: { o: string; w: number };
      expirationTtl: number;
    },
  ) => Promise<void>;
  list: (options: {
    prefix: string;
    cursor?: string;
  }) => Promise<VoteListResult>;
};

type VoteTallyOption = {
  id: string;
  label: string;
  weight: number;
  voters: number;
};

type VoteTally = {
  pollId: string;
  options: VoteTallyOption[];
  totalWeight: number;
  totalVoters: number;
};

const invalid = (message: string) =>
  Response.json(
    { error: { message, type: "invalid_request_error" } },
    { status: 400 },
  );

const unavailable = () =>
  Response.json(
    {
      error: {
        message: "Voting storage is unavailable",
        type: "api_error",
      },
    },
    { status: 503 },
  );

const zeroTally = (poll: Poll): VoteTally => ({
  pollId: poll.id,
  options: poll.options.map((option) => ({
    ...option,
    weight: 0,
    voters: 0,
  })),
  totalWeight: 0,
  totalVoters: 0,
});

const getVoteStore = async (): Promise<VoteStore | undefined> => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv & { UMBRA_KEYS?: VoteStore }).UMBRA_KEYS;
  } catch {
    return undefined;
  }
};

const voteKey = (pollId: string, address: string) =>
  `vote:${pollId}:${createHash("sha256")
    .update(address.toLowerCase())
    .digest("hex")}`;

const readTally = async (
  store: VoteStore | undefined,
  poll: Poll,
): Promise<VoteTally> => {
  if (!store) return zeroTally(poll);
  const tally = zeroTally(poll);
  const byOption = new Map(
    tally.options.map((option) => [option.id, option] as const),
  );
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    let result: VoteListResult;
    try {
      result = await store.list({
        prefix: `vote:${poll.id}:`,
        ...(cursor ? { cursor } : {}),
      });
    } catch {
      return zeroTally(poll);
    }
    for (const key of result.keys) {
      const optionId = key.metadata?.o;
      const weight = key.metadata?.w;
      if (
        typeof optionId !== "string" ||
        !isPollOption(poll.id, optionId) ||
        typeof weight !== "number" ||
        !Number.isFinite(weight) ||
        weight <= 0
      )
        continue;
      const option = byOption.get(optionId);
      if (!option) continue;
      option.weight += weight;
      option.voters += 1;
      tally.totalWeight += weight;
      tally.totalVoters += 1;
    }
    if (result.list_complete || !result.cursor) break;
    cursor = result.cursor;
  }
  return tally;
};

const pollIdFromRequest = (request: Request) =>
  new URL(request.url).searchParams.get("pollId") ?? "";

export async function GET(request: Request) {
  const poll = findPoll(pollIdFromRequest(request));
  if (!poll) return invalid("Unknown poll");
  return Response.json(await readTally(await getVoteStore(), poll));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid("Request body must be valid JSON");
  }
  if (typeof body !== "object" || body === null)
    return invalid("proof, pollId, and optionId are required");
  const data = body as Record<string, unknown>;
  if (
    typeof data.proof !== "string" ||
    typeof data.pollId !== "string" ||
    typeof data.optionId !== "string"
  )
    return invalid("proof, pollId, and optionId are required");
  const claims = readHolderProof(data.proof);
  if (!claims) return invalid("holder proof is invalid or expired");
  if (!canVote(claims.tier))
    return Response.json(
      {
        error: {
          message: "Voting is open to verified $UMBRA holders",
          type: "permission_error",
        },
      },
      { status: 403 },
    );
  const poll = findPoll(data.pollId);
  if (!poll) return invalid("Unknown poll");
  if (!isPollOption(poll.id, data.optionId))
    return invalid("Unknown poll option");
  const store = await getVoteStore();
  if (!store) return unavailable();
  const weight = voteWeight(claims.tier);
  try {
    await store.put(voteKey(poll.id, claims.addr), "", {
      metadata: { o: data.optionId, w: weight },
      expirationTtl: 31_536_000,
    });
  } catch {
    return unavailable();
  }
  return Response.json({
    ...(await readTally(store, poll)),
    choice: data.optionId,
    weight,
  });
}
