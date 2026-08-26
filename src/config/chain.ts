export const chainNetworks = {
  mainnet: {
    name: "Robinhood Chain",
    chainId: 4663,
    rpc: "https://rpc.mainnet.chain.robinhood.com",
    explorer: "https://robinhoodchain.blockscout.com",
    gasToken: "ETH",
    stack: "Arbitrum Orbit L2",
    usdG: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
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
