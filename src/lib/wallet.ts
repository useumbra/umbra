import { chainNetworks } from "../config/chain";

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

export type WalletBalances = {
  address: string;
  eth: string;
  usdg: string;
  usdgDecimals: number;
};

export type WalletErrorCode =
  "NO_WALLET" | "USER_REJECTED" | "WRONG_CHAIN" | "RPC_ERROR";

export class WalletError extends Error {
  constructor(
    public readonly code: WalletErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WalletError";
  }
}

export const chainIdHex = (chainId: number) => `0x${chainId.toString(16)}`;

export const hexToBigInt = (value: string) => {
  if (!/^0x[0-9a-f]+$/i.test(value))
    throw new Error("Invalid hexadecimal value");
  return BigInt(value);
};

export const formatUnits = (
  value: bigint,
  decimals: number,
  maxFractionDigits = 6,
) => {
  if (!Number.isInteger(decimals) || decimals < 0)
    throw new Error("Invalid decimals");
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  if (decimals === 0) return `${negative ? "-" : ""}${absolute}`;
  const padded = absolute.toString().padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded
    .slice(-decimals)
    .slice(0, maxFractionDigits)
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
};

export const encodeBalanceOf = (address: string) => {
  if (!/^0x[0-9a-f]{40}$/i.test(address))
    throw new Error("Invalid wallet address");
  return `0x70a08231${address.slice(2).toLowerCase().padStart(64, "0")}`;
};

const rpcCall = async (method: string, params: unknown[]) => {
  const response = await fetch(chainNetworks.mainnet.rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok)
    throw new WalletError("RPC_ERROR", "Robinhood Chain RPC is unavailable.");
  const result = (await response.json()) as {
    result?: string;
    error?: unknown;
  };
  if (!result.result || result.error)
    throw new WalletError(
      "RPC_ERROR",
      "Robinhood Chain RPC returned an error.",
    );
  return result.result;
};

const requestAccounts = async (provider: Eip1193Provider) => {
  try {
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    if (!Array.isArray(accounts) || typeof accounts[0] !== "string")
      throw new WalletError("NO_WALLET", "No wallet account was provided.");
    return accounts[0];
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 4001
    )
      throw new WalletError("USER_REJECTED", "Wallet connection was rejected.");
    throw error;
  }
};

const switchToRobinhood = async (provider: Eip1193Provider) => {
  const chainId = chainIdHex(chainNetworks.mainnet.chainId);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    if (code !== 4902)
      throw code === 4001
        ? new WalletError("USER_REJECTED", "Network switch was rejected.")
        : new WalletError(
            "WRONG_CHAIN",
            "Switch your wallet to Robinhood Chain.",
          );
    try {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId,
            chainName: chainNetworks.mainnet.name,
            nativeCurrency: {
              name: chainNetworks.mainnet.gasToken,
              symbol: chainNetworks.mainnet.gasToken,
              decimals: 18,
            },
            rpcUrls: [chainNetworks.mainnet.rpc],
            blockExplorerUrls: [chainNetworks.mainnet.explorer],
          },
        ],
      });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
    } catch (addError) {
      if (
        typeof addError === "object" &&
        addError !== null &&
        "code" in addError &&
        addError.code === 4001
      )
        throw new WalletError(
          "USER_REJECTED",
          "Network addition was rejected.",
        );
      throw new WalletError(
        "WRONG_CHAIN",
        addError instanceof Error
          ? addError.message
          : "Robinhood Chain could not be added to the wallet.",
      );
    }
  }
};

export const connectAndReadBalances = async (
  provider: Eip1193Provider | undefined,
): Promise<WalletBalances> => {
  if (!provider)
    throw new WalletError("NO_WALLET", "No compatible wallet was detected.");
  const address = await requestAccounts(provider);
  await switchToRobinhood(provider);
  const [ethHex, decimalsHex, usdgHex] = await Promise.all([
    rpcCall("eth_getBalance", [address, "latest"]),
    rpcCall("eth_call", [
      { to: chainNetworks.mainnet.usdG, data: "0x313ce567" },
      "latest",
    ]),
    rpcCall("eth_call", [
      { to: chainNetworks.mainnet.usdG, data: encodeBalanceOf(address) },
      "latest",
    ]),
  ]);
  const decimals = Number(hexToBigInt(decimalsHex));
  return {
    address,
    eth: formatUnits(hexToBigInt(ethHex), 18),
    usdg: formatUnits(hexToBigInt(usdgHex), decimals),
    usdgDecimals: decimals,
  };
};
