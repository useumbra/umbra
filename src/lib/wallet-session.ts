"use client";

import { brand } from "@/config/brand";
import { chainNetworks } from "@/config/chain";
import { WalletError, type Eip1193Provider } from "./wallet";

export type WalletOption = {
  id: string;
  name: string;
  icon?: string;
};

type Eip6963Info = {
  rdns: string;
  name: string;
  icon?: string;
};

type Eip6963Announcement = {
  info: Eip6963Info;
  provider: Eip1193Provider;
};

type EthereumWindow = Window & {
  ethereum?: Eip1193Provider;
};

const announced = new Map<
  string,
  { info: Eip6963Info; provider: Eip1193Provider }
>();
let walletConnectProvider:
  (Eip1193Provider & { session?: unknown }) | undefined;

const projectId = () =>
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

const browserWallet = (): Eip1193Provider | undefined =>
  (window as EthereumWindow).ethereum;

const optionsFromState = (): WalletOption[] => {
  const options: WalletOption[] = Array.from(
    announced.entries(),
    ([id, entry]) => ({
      id,
      name: entry.info.name,
      ...(entry.info.icon ? { icon: entry.info.icon } : {}),
    }),
  );
  if (options.length === 0 && browserWallet())
    options.push({ id: "injected", name: "Browser wallet" });
  if (projectId()) options.push({ id: "wc", name: "WalletConnect" });
  return options;
};

export const startWalletDiscovery = (
  onChange: (options: WalletOption[]) => void,
): (() => void) => {
  const announce = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963Announcement>).detail;
    if (
      !detail?.info?.rdns ||
      !detail.provider ||
      typeof detail.provider.request !== "function"
    )
      return;
    announced.set(detail.info.rdns, {
      info: detail.info,
      provider: detail.provider,
    });
    onChange(optionsFromState());
  };
  window.addEventListener("eip6963:announceProvider", announce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  onChange(optionsFromState());
  return () => window.removeEventListener("eip6963:announceProvider", announce);
};

export const resolveWalletProvider = async (
  id: string,
): Promise<Eip1193Provider> => {
  if (id === "injected") {
    const provider = browserWallet();
    if (provider) return provider;
  } else if (id === "wc") {
    const configuredProjectId = projectId();
    if (!configuredProjectId)
      throw new WalletError(
        "NO_WALLET",
        "WalletConnect is not configured for this workspace.",
      );
    if (!walletConnectProvider) {
      const { EthereumProvider } =
        await import("@walletconnect/ethereum-provider");
      walletConnectProvider = await EthereumProvider.init({
        projectId: configuredProjectId,
        chains: [chainNetworks.mainnet.chainId],
        rpcMap: {
          [chainNetworks.mainnet.chainId]: chainNetworks.mainnet.rpc,
        },
        showQrModal: true,
        metadata: {
          name: brand.name,
          description: "Private AI workspace",
          url: `https://${brand.domain}`,
          icons: [`https://${brand.domain}/icon.png`],
        },
      });
    }
    if (!walletConnectProvider.session)
      await (
        walletConnectProvider as Eip1193Provider & {
          connect: () => Promise<void>;
        }
      ).connect();
    return walletConnectProvider;
  } else {
    const entry = announced.get(id);
    if (entry) return entry.provider;
  }
  throw new WalletError(
    "NO_WALLET",
    "That wallet is no longer available. Choose another wallet.",
  );
};

export const rememberWalletChoice = (id: string): void => {
  try {
    localStorage.setItem("wallet-choice", id);
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }
};

export const forgetWalletChoice = (): void => {
  try {
    localStorage.removeItem("wallet-choice");
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }
};

export const lastWalletChoice = (): string | undefined => {
  try {
    return localStorage.getItem("wallet-choice") ?? undefined;
  } catch {
    return undefined;
  }
};
