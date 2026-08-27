export const brand = {
  name: "Umbra",
  wordmark: "umbra",
  token: "$UMB",
  chain: { name: "Robinhood Chain", id: 4663 },
  domain: "useumbra.org",
  social: {
    x: { handle: "@use_umbra", url: "https://x.com/use_umbra" },
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
