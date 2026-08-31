// @vitest-environment jsdom

import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWallet, type WalletRunner } from "./use-wallet";
import type { WalletOption } from "./wallet-session";
import type { Eip1193Provider } from "./wallet";

const sessionMocks = vi.hoisted(() => ({
  forgetWalletChoice: vi.fn(),
  lastWalletChoice: vi.fn(),
  rememberWalletChoice: vi.fn(),
  resolveWalletProvider: vi.fn(),
  startWalletDiscovery: vi.fn(),
}));

vi.mock("./wallet-session", () => sessionMocks);

const provider: Eip1193Provider = {
  request: vi.fn(async () => null),
};

let runner: WalletRunner | undefined;

function Harness() {
  runner = useWallet();
  return createElement("div");
}

const mount = async (options: WalletOption[]): Promise<Root> => {
  sessionMocks.startWalletDiscovery.mockImplementation(
    (onChange: (next: WalletOption[]) => void) => {
      onChange(options);
      return vi.fn();
    },
  );
  const root = createRoot(document.createElement("div"));
  await act(async () => {
    root.render(createElement(Harness));
  });
  return root;
};

beforeEach(() => {
  runner = undefined;
  sessionMocks.forgetWalletChoice.mockReset();
  sessionMocks.lastWalletChoice.mockReturnValue(undefined);
  sessionMocks.rememberWalletChoice.mockReset();
  sessionMocks.resolveWalletProvider.mockResolvedValue(provider);
  sessionMocks.startWalletDiscovery.mockReset();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useWallet", () => {
  it("resolves false when wallet selection is cancelled", async () => {
    const root = await mount([
      { id: "one", name: "One" },
      { id: "two", name: "Two" },
    ]);
    const action = vi.fn(async () => undefined);
    let pending: Promise<boolean> | undefined;
    await act(async () => {
      pending = runner?.run(action);
      await Promise.resolve();
    });

    expect(runner?.picking).toBe(true);
    await act(async () => {
      runner?.cancel();
    });

    await expect(pending).resolves.toBe(false);
    expect(action).not.toHaveBeenCalled();
    await act(async () => {
      root.unmount();
    });
  });

  it("rejects when no wallet options are available", async () => {
    const root = await mount([]);

    await expect(runner?.run(async () => undefined)).rejects.toMatchObject({
      code: "NO_WALLET",
      message: "No compatible wallet was detected.",
    });
    expect(runner?.picking).toBe(false);
    await act(async () => {
      root.unmount();
    });
  });

  it("forgets stale choices and opens the wallet picker", async () => {
    sessionMocks.lastWalletChoice.mockReturnValue("stale");
    sessionMocks.resolveWalletProvider.mockRejectedValueOnce(
      new Error("wallet removed"),
    );
    const root = await mount([
      { id: "one", name: "One" },
      { id: "two", name: "Two" },
    ]);

    let pending: Promise<boolean> | undefined;
    await act(async () => {
      pending = runner?.run(async () => undefined);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sessionMocks.forgetWalletChoice).toHaveBeenCalledOnce();
    expect(runner?.picking).toBe(true);
    await act(async () => {
      runner?.cancel();
    });
    await expect(pending).resolves.toBe(false);
    await act(async () => {
      root.unmount();
    });
  });
});
