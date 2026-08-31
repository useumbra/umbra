import {
  connectAddress,
  formatUnits,
  getTokenDecimals,
  readTokenBalance,
  type Eip1193Provider,
} from "./wallet";

export type HolderTierId = "base" | "holder" | "circle" | "council";

export type HolderTier = {
  id: HolderTierId;
  name: string;
  minTokens: number;
  perks: readonly string[];
};

export const holderTiers = [
  {
    id: "base",
    name: "Base",
    minTokens: 0,
    perks: ["Every Umbra surface already works without holding anything."],
  },
  {
    id: "holder",
    name: "Holder",
    minTokens: 100_000,
    perks: ["Credits at a holder rate", "Early access to new surfaces"],
  },
  {
    id: "circle",
    name: "Circle",
    minTokens: 1_000_000,
    perks: [
      "Everything in Holder",
      "Higher UmbraCode and Council limits",
      "Priority routing on premium models",
    ],
  },
  {
    id: "council",
    name: "Council",
    minTokens: 10_000_000,
    perks: [
      "Everything in Circle",
      "A holder quota on the OpenAI-compatible API",
      "A vote on new providers and detectors",
    ],
  },
] as const;

export const tokensToWei = (tokens: number, decimals: number): bigint =>
  BigInt(tokens) * BigInt(10) ** BigInt(decimals);

export const tierForBalance = (raw: bigint, decimals: number): HolderTier => {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255)
    throw new Error("Invalid token decimals");
  let tier: HolderTier = holderTiers[0];
  for (const candidate of holderTiers) {
    if (raw < tokensToWei(candidate.minTokens, decimals)) break;
    tier = candidate;
  }
  return tier;
};

export const nextTier = (tier: HolderTier): HolderTier | undefined => {
  const index = holderTiers.findIndex((candidate) => candidate.id === tier.id);
  return index === -1 ? undefined : holderTiers[index + 1];
};

export type HolderStatus = {
  address: string;
  raw: bigint;
  decimals: number;
  balance: string;
  tier: HolderTier;
};

export const readHolderStatus = async (
  provider: Eip1193Provider | undefined,
  token: string,
): Promise<HolderStatus> => {
  const address = await connectAddress(provider);
  const [decimals, raw] = await Promise.all([
    getTokenDecimals(token),
    readTokenBalance(token, address),
  ]);
  return {
    address,
    raw,
    decimals,
    balance: formatUnits(raw, decimals, 2),
    tier: tierForBalance(raw, decimals),
  };
};
