export const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const addressPattern = /^0x[0-9a-fA-F]{40}$/;

export const encodeErc20Transfer = (to: string, amount: bigint) => {
  if (!addressPattern.test(to)) throw new Error("Invalid recipient address");
  if (amount < BigInt(0)) throw new Error("Transfer amount cannot be negative");
  const encodedAmount = amount.toString(16);
  if (encodedAmount.length > 64)
    throw new Error("Transfer amount is too large");
  return `0xa9059cbb${to.slice(2).toLowerCase().padStart(64, "0")}${encodedAmount.padStart(64, "0")}`;
};

export const parseAmount = (input: string, decimals: number) => {
  if (!Number.isInteger(decimals) || decimals < 0)
    throw new Error("Invalid token decimals");
  const value = input.trim();
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error("Invalid amount");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals)
    throw new Error("Amount has too many decimal places");
  const amount =
    BigInt(whole) * BigInt(10) ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0");
  if (amount <= BigInt(0)) throw new Error("Amount must be greater than zero");
  return amount;
};

type TransferReceipt = {
  status?: unknown;
  logs?: unknown;
};

type TransferOptions = {
  token: string;
  treasury: string;
};

export const findTransferToTreasury = (
  receipt: unknown,
  { token, treasury }: TransferOptions,
) => {
  if (
    typeof receipt !== "object" ||
    receipt === null ||
    (receipt as TransferReceipt).status !== "0x1" ||
    !addressPattern.test(token) ||
    !addressPattern.test(treasury)
  )
    return undefined;
  const logs = (receipt as TransferReceipt).logs;
  if (!Array.isArray(logs)) return undefined;
  const recipientTopic = `0x${treasury.slice(2).toLowerCase().padStart(64, "0")}`;
  let total = BigInt(0);
  let found = false;
  for (const log of logs) {
    if (typeof log !== "object" || log === null) continue;
    const candidate = log as {
      address?: unknown;
      topics?: unknown;
      data?: unknown;
    };
    if (
      typeof candidate.address !== "string" ||
      candidate.address.toLowerCase() !== token.toLowerCase() ||
      !Array.isArray(candidate.topics) ||
      typeof candidate.topics[0] !== "string" ||
      candidate.topics[0].toLowerCase() !== TRANSFER_TOPIC ||
      typeof candidate.topics[2] !== "string" ||
      candidate.topics[2].toLowerCase() !== recipientTopic ||
      typeof candidate.data !== "string" ||
      !/^0x[0-9a-fA-F]{64}$/.test(candidate.data)
    )
      continue;
    total += BigInt(candidate.data);
    found = true;
  }
  return found ? total : undefined;
};

export const creditsForUsdg = (amount: bigint, decimals: number) => {
  if (amount < BigInt(0) || !Number.isInteger(decimals) || decimals < 0)
    throw new Error("Invalid USDG amount");
  const credits = Number(amount) / 10 ** decimals;
  if (!Number.isFinite(credits)) throw new Error("USDG amount is too large");
  return credits;
};
