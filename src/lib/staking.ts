import {
  hexToBigInt,
  readCall,
  readTokenBalance,
  sendContractTx,
  type Eip1193Provider,
} from "./wallet";

export const STAKE_SELECTOR = "0xa694fc3a";
export const WITHDRAW_SELECTOR = "0x2e1a7d4d";
export const GET_REWARD_SELECTOR = "0x3d18b912";
export const EXIT_SELECTOR = "0xe9fad8ee";
export const EMERGENCY_WITHDRAW_SELECTOR = "0xdb2e21bc";
export const STAKED_OF_SELECTOR = "0xaf500ba3";
export const EARNED_SELECTOR = "0x008cc262";
export const TOTAL_STAKED_SELECTOR = "0x817b1cd2";
export const PERIOD_FINISH_SELECTOR = "0xebe2b12b";
export const REWARD_RATE_SELECTOR = "0x7b0a47ee";
export const APPROVE_SELECTOR = "0x095ea7b3";
export const ALLOWANCE_SELECTOR = "0xdd62ed3e";

const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const selectorPattern = /^0x[0-9a-fA-F]{8}$/;

const normalizeSelector = (selector: string) => {
  if (!selectorPattern.test(selector))
    throw new Error("Invalid function selector");
  return selector.toLowerCase();
};

const encodeWord = (amount: bigint) => {
  if (amount < BigInt(0)) throw new Error("Transfer amount cannot be negative");
  const encoded = amount.toString(16);
  if (encoded.length > 64) throw new Error("Transfer amount is too large");
  return encoded.padStart(64, "0");
};

const encodeAddressWord = (address: string) => {
  if (!addressPattern.test(address))
    throw new Error("Invalid recipient address");
  return address.slice(2).toLowerCase().padStart(64, "0");
};

export const encodeAmountCall = (selector: string, amount: bigint) =>
  `${normalizeSelector(selector)}${encodeWord(amount)}`;

export const encodeAddressCall = (selector: string, address: string) =>
  `${normalizeSelector(selector)}${encodeAddressWord(address)}`;

export const encodeApprove = (spender: string, amount: bigint) =>
  `${APPROVE_SELECTOR}${encodeAddressWord(spender)}${encodeWord(amount)}`;

export const encodeAllowance = (owner: string, spender: string) =>
  `${ALLOWANCE_SELECTOR}${encodeAddressWord(owner)}${encodeAddressWord(spender)}`;

export type StakingSnapshot = {
  walletBalance: bigint;
  allowance: bigint;
  staked: bigint;
  earned: bigint;
  totalStaked: bigint;
  periodFinish: bigint;
  rewardRate: bigint;
};

const encodeNoArgCall = (selector: string) => normalizeSelector(selector);

export const readStakingSnapshot = async (
  staking: string,
  token: string,
  address: string,
): Promise<StakingSnapshot> => {
  if (!addressPattern.test(staking)) throw new Error("Invalid staking address");
  if (!addressPattern.test(token)) throw new Error("Invalid token address");
  if (!addressPattern.test(address)) throw new Error("Invalid wallet address");
  const [
    walletBalanceHex,
    allowanceHex,
    stakedHex,
    earnedHex,
    totalStakedHex,
    periodFinishHex,
    rewardRateHex,
  ] = await Promise.all([
    readTokenBalance(token, address),
    readCall(token, encodeAllowance(address, staking)),
    readCall(staking, encodeAddressCall(STAKED_OF_SELECTOR, address)),
    readCall(staking, encodeAddressCall(EARNED_SELECTOR, address)),
    readCall(staking, encodeNoArgCall(TOTAL_STAKED_SELECTOR)),
    readCall(staking, encodeNoArgCall(PERIOD_FINISH_SELECTOR)),
    readCall(staking, encodeNoArgCall(REWARD_RATE_SELECTOR)),
  ]);
  return {
    walletBalance: walletBalanceHex,
    allowance: hexToBigInt(allowanceHex),
    staked: hexToBigInt(stakedHex),
    earned: hexToBigInt(earnedHex),
    totalStaked: hexToBigInt(totalStakedHex),
    periodFinish: hexToBigInt(periodFinishHex),
    rewardRate: hexToBigInt(rewardRateHex),
  };
};

type StakingAmountTransaction = {
  from: string;
  staking: string;
  amount: bigint;
};

type StakingTransaction = {
  from: string;
  staking: string;
};

export const stake = (
  provider: Eip1193Provider | undefined,
  { from, staking, amount }: StakingAmountTransaction,
) =>
  sendContractTx(provider, {
    from,
    to: staking,
    data: encodeAmountCall(STAKE_SELECTOR, amount),
    rejectedMessage: "Staking was rejected.",
  });

export const withdraw = (
  provider: Eip1193Provider | undefined,
  { from, staking, amount }: StakingAmountTransaction,
) =>
  sendContractTx(provider, {
    from,
    to: staking,
    data: encodeAmountCall(WITHDRAW_SELECTOR, amount),
    rejectedMessage: "Withdrawal was rejected.",
  });

export const getReward = (
  provider: Eip1193Provider | undefined,
  { from, staking }: StakingTransaction,
) =>
  sendContractTx(provider, {
    from,
    to: staking,
    data: GET_REWARD_SELECTOR,
    rejectedMessage: "Reward claim was rejected.",
  });

export const exit = (
  provider: Eip1193Provider | undefined,
  { from, staking }: StakingTransaction,
) =>
  sendContractTx(provider, {
    from,
    to: staking,
    data: EXIT_SELECTOR,
    rejectedMessage: "Exit was rejected.",
  });

export const emergencyWithdraw = (
  provider: Eip1193Provider | undefined,
  { from, staking }: StakingTransaction,
) =>
  sendContractTx(provider, {
    from,
    to: staking,
    data: EMERGENCY_WITHDRAW_SELECTOR,
    rejectedMessage: "Emergency withdrawal was rejected.",
  });

export const approve = (
  provider: Eip1193Provider | undefined,
  {
    from,
    token,
    spender,
    amount,
  }: { from: string; token: string; spender: string; amount: bigint },
) =>
  sendContractTx(provider, {
    from,
    to: token,
    data: encodeApprove(spender, amount),
    rejectedMessage: "Token approval was rejected.",
  });
