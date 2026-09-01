import { chainNetworks } from "../config/chain";
import { encodeErc20Transfer } from "./funding";
import { UpstreamError } from "./providers/upstream";

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

export type WalletBalances = {
  address: string;
  eth: string;
  usdg: string;
  usdgDecimals: number;
};

export type WalletReceipt = {
  status?: string;
  logs?: unknown[];
  transactionHash?: string;
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

type RpcResponse<T> = {
  result?: T;
  error?: { code?: unknown };
};

const retryableRpcStatuses = new Set([0, 429, 500, 502, 503]);
const rpcEndpoints = [
  chainNetworks.mainnet.rpc,
  ...chainNetworks.mainnet.rpcFallbacks,
];

const rpcError = (error: { code?: unknown } | undefined) => {
  const code = error?.code;
  return typeof code === "number" && Number.isFinite(code)
    ? `rpc error ${code}`
    : "Robinhood Chain RPC returned an error.";
};

const retryDelay = (baseMs: number) => baseMs * (0.75 + Math.random() * 0.5);

const rpcRequest = async <T>(
  method: string,
  params: unknown[],
): Promise<RpcResponse<T>> => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      let response: Response;
      try {
        response = await fetch(rpcEndpoints[attempt % rpcEndpoints.length], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        });
      } catch {
        throw new UpstreamError(0, "Robinhood Chain RPC is unavailable.");
      }
      if (!response.ok)
        throw new UpstreamError(
          response.status,
          "Robinhood Chain RPC is unavailable.",
        );
      let result: RpcResponse<T>;
      try {
        result = (await response.json()) as RpcResponse<T>;
      } catch {
        throw new UpstreamError(
          502,
          "Robinhood Chain RPC returned an invalid response.",
        );
      }
      return result;
    } catch (error) {
      if (
        !(error instanceof UpstreamError) ||
        !retryableRpcStatuses.has(error.status) ||
        attempt === 2
      )
        throw error;
      await new Promise<void>((resolve) =>
        setTimeout(resolve, retryDelay(attempt === 0 ? 400 : 1200)),
      );
    }
  }
  throw new UpstreamError(502, "Robinhood Chain RPC returned an error.");
};

const rpcCall = async (method: string, params: unknown[]) => {
  const result = await rpcRequest<string>(method, params);
  if (result.error) throw new UpstreamError(502, rpcError(result.error));
  if (!result.result)
    throw new UpstreamError(502, "Robinhood Chain RPC returned an error.");
  return result.result;
};

export const readCall = (to: string, data: string) =>
  rpcCall("eth_call", [{ to, data }, "latest"]);

const rpcCallValue = async <T>(method: string, params: unknown[]) => {
  const result = await rpcRequest<T | null>(method, params);
  if (result.error) throw new UpstreamError(502, rpcError(result.error));
  if (!("result" in result))
    throw new UpstreamError(502, "Robinhood Chain RPC returned an error.");
  return result.result as T | null;
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
    const unsupported = code === 4200 || code === -32601;
    if (unsupported) {
      try {
        const currentChain = await provider.request({ method: "eth_chainId" });
        if (
          typeof currentChain === "string" &&
          currentChain.toLowerCase() === chainId
        )
          return;
      } catch {
        // Fall through to the same clear wrong-network message.
      }
      throw new WalletError(
        "WRONG_CHAIN",
        "Switch your wallet to Robinhood Chain (chain 4663) and try again.",
      );
    }
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

const tokenDecimalsPromises = new Map<string, Promise<number>>();

export const getTokenDecimals = (token: string) => {
  const key = token.toLowerCase();
  const cached = tokenDecimalsPromises.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const decimalsHex = await rpcCall("eth_call", [
      { to: token, data: "0x313ce567" },
      "latest",
    ]);
    let decimals: number;
    try {
      decimals = Number(hexToBigInt(decimalsHex));
    } catch {
      throw new WalletError("RPC_ERROR", "Token returned invalid decimals.");
    }
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255)
      throw new WalletError("RPC_ERROR", "Token returned invalid decimals.");
    return decimals;
  })().catch((error: unknown) => {
    tokenDecimalsPromises.delete(key);
    throw error;
  });
  tokenDecimalsPromises.set(key, promise);
  return promise;
};

export const getUsdgDecimals = async () =>
  getTokenDecimals(chainNetworks.mainnet.usdG);

export const readTokenBalance = async (
  token: string,
  address: string,
): Promise<bigint> => {
  const balanceHex = await readCall(token, encodeBalanceOf(address));
  return hexToBigInt(balanceHex);
};

export const connectAddress = async (
  provider: Eip1193Provider | undefined,
): Promise<string> => {
  if (!provider)
    throw new WalletError("NO_WALLET", "No compatible wallet was detected.");
  const address = await requestAccounts(provider);
  await switchToRobinhood(provider);
  return address;
};

export const sendContractTx = async (
  provider: Eip1193Provider | undefined,
  {
    from,
    to,
    data,
    rejectedMessage,
  }: { from: string; to: string; data: string; rejectedMessage: string },
): Promise<string> => {
  if (!provider)
    throw new WalletError("NO_WALLET", "No compatible wallet was detected.");
  if (!/^0x[0-9a-f]{40}$/i.test(from))
    throw new WalletError(
      "NO_WALLET",
      "The connected wallet address is invalid.",
    );
  await switchToRobinhood(provider);
  try {
    const hash = await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          from,
          to,
          data,
        },
      ],
    });
    if (typeof hash !== "string" || !hash)
      throw new WalletError(
        "RPC_ERROR",
        "The wallet did not return a transaction hash.",
      );
    return hash;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 4001
    )
      throw new WalletError("USER_REJECTED", rejectedMessage);
    if (error instanceof WalletError) throw error;
    throw new WalletError(
      "RPC_ERROR",
      error instanceof Error
        ? error.message
        : "The wallet could not send the transaction.",
    );
  }
};

export const waitForReceipt = async (
  hash: string,
  {
    timeoutMs = 180_000,
    intervalMs = 4_000,
  }: {
    timeoutMs?: number;
    intervalMs?: number;
  } = {},
): Promise<WalletReceipt> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const receipt = await rpcCallValue<WalletReceipt>(
      "eth_getTransactionReceipt",
      [hash],
    );
    if (receipt) return receipt;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new WalletError(
    "RPC_ERROR",
    "Timed out waiting for confirmation. The transaction may still confirm and can be claimed later by hash.",
  );
};

export const sendUsdgTransfer = async (
  provider: Eip1193Provider | undefined,
  { from, to, amount }: { from: string; to: string; amount: bigint },
): Promise<string> =>
  sendContractTx(provider, {
    from,
    to: chainNetworks.mainnet.usdG,
    data: encodeErc20Transfer(to, amount),
    rejectedMessage: "USDG transfer was rejected.",
  });

export const connectAndReadBalances = async (
  provider: Eip1193Provider | undefined,
): Promise<WalletBalances> => {
  const address = await connectAddress(provider);
  const [ethHex, decimals, usdgHex] = await Promise.all([
    rpcCall("eth_getBalance", [address, "latest"]),
    getUsdgDecimals(),
    rpcCall("eth_call", [
      { to: chainNetworks.mainnet.usdG, data: encodeBalanceOf(address) },
      "latest",
    ]),
  ]);
  return {
    address,
    eth: formatUnits(hexToBigInt(ethHex), 18),
    usdg: formatUnits(hexToBigInt(usdgHex), decimals),
    usdgDecimals: decimals,
  };
};
