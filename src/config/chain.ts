const configuredTreasury = process.env.NEXT_PUBLIC_UMBRA_TREASURY;
const treasury =
  configuredTreasury && /^0x[0-9a-fA-F]{40}$/.test(configuredTreasury)
    ? configuredTreasury
    : undefined;
const configuredStaking = process.env.NEXT_PUBLIC_UMBRA_STAKING;
const staking =
  configuredStaking && /^0x[0-9a-fA-F]{40}$/.test(configuredStaking)
    ? configuredStaking
    : undefined;
const configuredLockStaking = process.env.NEXT_PUBLIC_UMBRA_LOCK_STAKING;
const lockStaking =
  configuredLockStaking && /^0x[0-9a-fA-F]{40}$/.test(configuredLockStaking)
    ? configuredLockStaking
    : undefined;

export const chainNetworks = {
  mainnet: {
    name: "Robinhood Chain",
    chainId: 4663,
    rpc: "https://rpc.mainnet.chain.robinhood.com",
    rpcFallbacks: ["https://robinhood-rpc.publicnode.com"],
    explorer: "https://robinhoodchain.blockscout.com",
    gasToken: "ETH",
    stack: "Arbitrum Orbit L2",
    usdG: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
    treasury,
    staking,
    lockStaking,
  },
  testnet: {
    name: "Robinhood Chain Testnet",
    chainId: 46630,
    rpc: "https://rpc.testnet.chain.robinhood.com",
    explorer: "https://explorer.testnet.chain.robinhood.com",
    faucet: "https://faucet.testnet.chain.robinhood.com",
    gasToken: "ETH",
    stack: "Arbitrum Orbit L2",
  },
} as const;

export const resolveToken = (address: string) =>
  address.toLowerCase() === chainNetworks.mainnet.usdG.toLowerCase()
    ? "USDG (Global Dollar)"
    : undefined;
