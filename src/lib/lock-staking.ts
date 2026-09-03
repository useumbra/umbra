import {
  encodeAddressCall,
  encodeAllowance,
  encodeAmountCall,
  encodeNoArgCall,
  encodeWord,
} from "./staking";
import {
  hexToBigInt,
  readCall,
  readTokenBalance,
  sendContractTx,
  type Eip1193Provider,
} from "./wallet";

export const LOCK_STAKE_SELECTOR = "0x10087fb1";
export const LOCK_WITHDRAW_SELECTOR = "0x2e1a7d4d";
export const LOCK_EMERGENCY_WITHDRAW_SELECTOR = "0x5312ea8e";
export const LOCK_WITHDRAW_ALL_SELECTOR = "0x853828b6";
export const LOCK_QUOTE_REWARD_SELECTOR = "0xfdd75d77";
export const LOCK_AVAILABLE_REWARDS_SELECTOR = "0x879d9090";
export const LOCK_TOTAL_STAKED_SELECTOR = "0x817b1cd2";
export const LOCK_RESERVED_REWARDS_SELECTOR = "0xaf5ce104";
export const LOCK_POSITIONS_OF_SELECTOR = "0xf867d46b";
export const LOCK_POSITIONS_SELECTOR = "0x99fbab88";
export const LOCK_TIERS_SELECTOR = "0x4a95d9d5";
export const LOCK_STAKING_PAUSED_SELECTOR = "0xbbb781cc";

const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const wordLength = 64;
const secondsPerYear = BigInt(31_536_000);

export type LockTier = {
  id: number;
  durationSeconds: number;
  aprBps: number;
};

export type LockPosition = {
  id: bigint;
  amount: bigint;
  reward: bigint;
  start: number;
  unlockAt: number;
  tier: number;
  closed: boolean;
};

export type LockPoolSnapshot = {
  tiers: LockTier[];
  totalStaked: bigint;
  reservedRewards: bigint;
  availableRewards: bigint;
  paused: boolean;
};

export type LockWalletSnapshot = {
  walletBalance: bigint;
  allowance: bigint;
  positions: LockPosition[];
};

const validateAddress = (value: string, message: string) => {
  if (!addressPattern.test(value)) throw new Error(message);
};

const wordAt = (data: string, index: number) => {
  if (!/^0x[0-9a-f]+$/i.test(data))
    throw new Error("Invalid hexadecimal value");
  const start = 2 + index * wordLength;
  const end = start + wordLength;
  if (data.length < end) throw new Error("Invalid ABI response");
  return BigInt(`0x${data.slice(start, end)}`);
};

const arrayStart = (data: string) => {
  const offset = wordAt(data, 0);
  if (offset % BigInt(32) !== BigInt(0))
    throw new Error("Invalid ABI array offset");
  const start = Number(offset / BigInt(32));
  if (!Number.isSafeInteger(start))
    throw new Error("ABI array offset is too large");
  return start;
};

export const decodeLockTiers = (data: string): LockTier[] => {
  const start = arrayStart(data);
  const length = Number(wordAt(data, start));
  if (!Number.isSafeInteger(length))
    throw new Error("ABI array length is too large");
  return Array.from({ length }, (_, index) => {
    const base = start + 1 + index * 2;
    return {
      id: index,
      durationSeconds: Number(wordAt(data, base)),
      aprBps: Number(wordAt(data, base + 1)),
    };
  });
};

export const decodeLockPositionIds = (data: string) => {
  const start = arrayStart(data);
  const length = Number(wordAt(data, start));
  if (!Number.isSafeInteger(length))
    throw new Error("ABI array length is too large");
  return Array.from({ length }, (_, index) => wordAt(data, start + 1 + index));
};

export const decodeLockPosition = (id: bigint, data: string): LockPosition => ({
  id,
  amount: wordAt(data, 0),
  reward: wordAt(data, 1),
  start: Number(wordAt(data, 2)),
  unlockAt: Number(wordAt(data, 3)),
  tier: Number(wordAt(data, 4)),
  closed: wordAt(data, 5) !== BigInt(0),
});

export const readLockPool = async (
  staking: string,
): Promise<LockPoolSnapshot> => {
  validateAddress(staking, "Invalid lock staking address");
  const [
    tiersHex,
    totalStakedHex,
    reservedRewardsHex,
    availableRewardsHex,
    pausedHex,
  ] = await Promise.all([
    readCall(staking, encodeNoArgCall(LOCK_TIERS_SELECTOR)),
    readCall(staking, encodeNoArgCall(LOCK_TOTAL_STAKED_SELECTOR)),
    readCall(staking, encodeNoArgCall(LOCK_RESERVED_REWARDS_SELECTOR)),
    readCall(staking, encodeNoArgCall(LOCK_AVAILABLE_REWARDS_SELECTOR)),
    readCall(staking, encodeNoArgCall(LOCK_STAKING_PAUSED_SELECTOR)),
  ]);
  return {
    tiers: decodeLockTiers(tiersHex),
    totalStaked: hexToBigInt(totalStakedHex),
    reservedRewards: hexToBigInt(reservedRewardsHex),
    availableRewards: hexToBigInt(availableRewardsHex),
    paused: wordAt(pausedHex, 0) !== BigInt(0),
  };
};

export const readLockWallet = async (
  staking: string,
  token: string,
  address: string,
): Promise<LockWalletSnapshot> => {
  validateAddress(staking, "Invalid lock staking address");
  validateAddress(token, "Invalid token address");
  validateAddress(address, "Invalid wallet address");
  const [walletBalance, allowanceHex, positionsHex] = await Promise.all([
    readTokenBalance(token, address),
    readCall(token, encodeAllowance(address, staking)),
    readCall(staking, encodeAddressCall(LOCK_POSITIONS_OF_SELECTOR, address)),
  ]);
  const ids = decodeLockPositionIds(positionsHex);
  const positions = await Promise.all(
    ids.map(async (id) => {
      const positionHex = await readCall(
        staking,
        encodeAmountCall(LOCK_POSITIONS_SELECTOR, id),
      );
      return decodeLockPosition(id, positionHex);
    }),
  );
  return {
    walletBalance,
    allowance: hexToBigInt(allowanceHex),
    positions,
  };
};

export const quoteReward = (amount: bigint, tier: LockTier): bigint => {
  if (amount < BigInt(0)) throw new Error("Stake amount cannot be negative");
  return (
    (amount * BigInt(tier.aprBps) * BigInt(tier.durationSeconds)) /
    (BigInt(10_000) * secondsPerYear)
  );
};

export const maxStakeForTier = (available: bigint, tier: LockTier): bigint => {
  if (available < BigInt(0))
    throw new Error("Available rewards cannot be negative");
  return (
    (available * BigInt(10_000) * secondsPerYear) /
    (BigInt(tier.aprBps) * BigInt(tier.durationSeconds))
  );
};

type LockAmountTransaction = {
  from: string;
  staking: string;
  amount: bigint;
};

type LockIdTransaction = {
  from: string;
  staking: string;
  id: bigint;
};

export const lockStake = (
  provider: Eip1193Provider | undefined,
  { from, staking, amount, tier }: LockAmountTransaction & { tier: number },
) =>
  sendContractTx(provider, {
    from,
    to: staking,
    data: `${encodeAmountCall(LOCK_STAKE_SELECTOR, amount)}${encodeWord(BigInt(tier))}`,
    rejectedMessage: "Lock staking was rejected.",
  });

export const lockWithdraw = (
  provider: Eip1193Provider | undefined,
  { from, staking, id }: LockIdTransaction,
) =>
  sendContractTx(provider, {
    from,
    to: staking,
    data: encodeAmountCall(LOCK_WITHDRAW_SELECTOR, id),
    rejectedMessage: "Lock withdrawal was rejected.",
  });

export const lockEmergencyWithdraw = (
  provider: Eip1193Provider | undefined,
  { from, staking, id }: LockIdTransaction,
) =>
  sendContractTx(provider, {
    from,
    to: staking,
    data: encodeAmountCall(LOCK_EMERGENCY_WITHDRAW_SELECTOR, id),
    rejectedMessage: "Emergency withdrawal was rejected.",
  });

export const lockWithdrawAll = (
  provider: Eip1193Provider | undefined,
  { from, staking }: { from: string; staking: string },
) =>
  sendContractTx(provider, {
    from,
    to: staking,
    data: LOCK_WITHDRAW_ALL_SELECTOR,
    rejectedMessage: "Withdraw all was rejected.",
  });
