export const brand = {
  name: "Umbra",
  wordmark: "umbra",
  token: {
    ticker: "$UMBRA",
    symbol: "UMBRA",
    address: "0x6df8e6434e93efac8c471b00a2e8ae1659ea3ed0",
    supply: "1,000,000,000",
    decimals: 18,
    chain: "Robinhood Chain",
    explorer: "https://robinhoodchain.blockscout.com",
  },
  chain: { name: "Robinhood Chain", id: 4663 },
  domain: "useumbra.org",
  social: {
    x: { handle: "@useumbraa", url: "https://x.com/useumbraa" },
    github: {
      handle: "useumbra/umbra",
      url: "https://github.com/useumbra/umbra",
    },
  },
  appPath: "/app",
  apiBasePath: "/api/agent/v1",
  products: {
    chat: "UmbraChat",
    image: "UmbraImage",
    video: "UmbraVideo",
    code: "UmbraCode",
    pay: "UmbraPay",
    api: "Umbra API",
    privacy: "Smart Privacy",
  },
} as const;
