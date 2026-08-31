import { afterEach, describe, expect, it, vi } from "vitest";
import {
  lastWalletChoice,
  rememberWalletChoice,
  resolveWalletProvider,
  startWalletDiscovery,
} from "./wallet-session";
import { WalletError, type Eip1193Provider } from "./wallet";

const provider: Eip1193Provider = {
  request: vi.fn(async () => null),
};

class TestWindow extends EventTarget {
  ethereum?: Eip1193Provider;
}

const installWindow = (ethereum?: Eip1193Provider) => {
  const windowMock = new TestWindow();
  windowMock.ethereum = ethereum;
  vi.stubGlobal("window", windowMock);
  return windowMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("wallet session", () => {
  it("falls back to the legacy browser wallet", () => {
    installWindow({ request: vi.fn(async () => null) });
    vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "");
    const options: Array<{ id: string; name: string }> = [];
    const stop = startWalletDiscovery((next) => options.push(...next));
    expect(options).toContainEqual({
      id: "injected",
      name: "Browser wallet",
    });
    stop();
  });

  it("only lists WalletConnect when its project ID is configured", () => {
    installWindow();
    vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "");
    const withoutProjectId: Array<{ id: string }> = [];
    const stop = startWalletDiscovery((next) => withoutProjectId.push(...next));
    expect(withoutProjectId.some((option) => option.id === "wc")).toBe(false);
    stop();

    vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "test-project");
    const withProjectId: Array<{ id: string }> = [];
    const stopConfigured = startWalletDiscovery((next) =>
      withProjectId.push(...next),
    );
    expect(withProjectId.at(-1)).toEqual({
      id: "wc",
      name: "WalletConnect",
    });
    stopConfigured();
  });

  it("discovers an EIP-6963 wallet announcement", () => {
    const windowMock = installWindow();
    vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "");
    const changes: ReturnType<typeof startWalletDiscovery>[] = [];
    const options: Array<{ id: string; name: string; icon?: string }> = [];
    const stop = startWalletDiscovery((next) => options.push(...next));
    changes.push(stop);
    windowMock.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", {
        detail: {
          info: {
            rdns: "com.example.wallet",
            name: "Example Wallet",
            icon: "data:image/svg+xml,test",
          },
          provider,
        },
      }),
    );
    expect(options.at(-1)).toEqual({
      id: "com.example.wallet",
      name: "Example Wallet",
      icon: "data:image/svg+xml,test",
    });
    stop();
    expect(changes).toHaveLength(1);
  });

  it("rejects unknown wallet providers without importing WalletConnect", async () => {
    installWindow();
    await expect(resolveWalletProvider("missing")).rejects.toEqual(
      expect.objectContaining({
        code: "NO_WALLET",
      } satisfies Partial<WalletError>),
    );
  });

  it("remembers the selected wallet", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      setItem: (key: string, value: string) => storage.set(key, value),
      getItem: (key: string) => storage.get(key) ?? null,
    });
    rememberWalletChoice("injected");
    expect(lastWalletChoice()).toBe("injected");
  });
});
