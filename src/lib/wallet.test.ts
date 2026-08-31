import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chainIdHex,
  connectAndReadBalances,
  encodeBalanceOf,
  formatUnits,
  hexToBigInt,
  readTokenBalance,
  type Eip1193Provider,
} from "./wallet";
import { UpstreamError } from "./providers/upstream";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("wallet helpers", () => {
  it("converts hexadecimal quantities and chain IDs", () => {
    expect(hexToBigInt("0x2a")).toBe(BigInt(42));
    expect(chainIdHex(4663)).toBe("0x1237");
  });

  it("formats token balances with contract decimals", () => {
    expect(formatUnits(BigInt(123456789), 6)).toBe("123.456789");
    expect(formatUnits(BigInt(1000000000000000000), 18)).toBe("1");
    expect(formatUnits(BigInt(1234000000000000000), 18, 3)).toBe("1.234");
  });

  it("encodes balanceOf calldata by hand", () => {
    const address = `0x${"1".repeat(40)}`;
    expect(encodeBalanceOf(address)).toBe(
      `0x70a08231${"0".repeat(24)}${"1".repeat(40)}`,
    );
  });

  it("uses the injected provider only for connection and public RPC for reads", async () => {
    const calls: { method: string; params?: unknown[] }[] = [];
    let switchAttempts = 0;
    const provider: Eip1193Provider = {
      request: vi.fn(async (args) => {
        calls.push(args);
        if (args.method === "eth_requestAccounts")
          return ["0x00000000000000000000000000000000000000Ab"];
        if (
          args.method === "wallet_switchEthereumChain" &&
          switchAttempts++ === 0
        )
          throw { code: 4902 };
        return null;
      }),
    };
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as {
        method: string;
        params: [{ data?: string }, string] | [string, string];
      };
      const result =
        body.method === "eth_getBalance"
          ? "0xde0b6b3a7640000"
          : body.method === "eth_call" &&
              typeof body.params[0] === "object" &&
              body.params[0].data === "0x313ce567"
            ? "0x6"
            : "0x5f5e100";
      return new Response(JSON.stringify({ result }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(connectAndReadBalances(provider)).resolves.toMatchObject({
      address: "0x00000000000000000000000000000000000000Ab",
      eth: "1",
      usdg: "100",
      usdgDecimals: 6,
    });
    expect(calls.map((call) => call.method)).toEqual([
      "eth_requestAccounts",
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
      "wallet_switchEthereumChain",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("surfaces HTTP status from the public RPC", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 })),
    );

    const error = await import("./wallet")
      .then(({ readTokenBalance }) =>
        readTokenBalance(`0x${"1".repeat(40)}`, `0x${"2".repeat(40)}`),
      )
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({ status: 503 });
  });

  it("surfaces JSON-RPC error codes without upstream details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: -32000, message: "private upstream detail" },
            }),
            { status: 200 },
          ),
      ),
    );

    await expect(
      import("./wallet").then(({ readTokenBalance }) =>
        readTokenBalance(`0x${"1".repeat(40)}`, `0x${"2".repeat(40)}`),
      ),
    ).rejects.toMatchObject({
      status: 502,
      message: "rpc error -32000",
    });
  });

  it("retries a rate-limited RPC request and succeeds", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return calls === 1
          ? new Response("busy", { status: 429 })
          : new Response(JSON.stringify({ result: "0x7" }), { status: 200 });
      }),
    );

    const pending = readTokenBalance(
      `0x${"1".repeat(40)}`,
      `0x${"2".repeat(40)}`,
    );
    const result = expect(pending).resolves.toBe(BigInt(7));
    await vi.runAllTimersAsync();

    await result;
    expect(calls).toBe(2);
  });

  it("does not retry a non-retryable RPC status", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad request", { status: 400 })),
    );

    await expect(
      readTokenBalance(`0x${"1".repeat(40)}`, `0x${"2".repeat(40)}`),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("throws the final retryable RPC error after three attempts", async () => {
    vi.useFakeTimers();
    const statuses = [429, 503, 500];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const status = statuses.shift() ?? 500;
        return new Response("unavailable", { status });
      }),
    );

    const pending = readTokenBalance(
      `0x${"1".repeat(40)}`,
      `0x${"2".repeat(40)}`,
    );
    const result = expect(pending).rejects.toMatchObject({ status: 500 });
    await vi.runAllTimersAsync();

    await result;
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("fails over to the public Robinhood Chain RPC", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: "0x7" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const pending = readTokenBalance(
      `0x${"1".repeat(40)}`,
      `0x${"2".repeat(40)}`,
    );
    const result = expect(pending).resolves.toBe(BigInt(7));
    await vi.runAllTimersAsync();

    await result;
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://rpc.mainnet.chain.robinhood.com",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://robinhood-rpc.publicnode.com",
    );
  });

  it("accepts an already active chain when switching is unsupported", async () => {
    const provider: Eip1193Provider = {
      request: vi.fn(async (args) => {
        if (args.method === "wallet_switchEthereumChain") throw { code: 4200 };
        if (args.method === "eth_chainId") return "0x1237";
        if (args.method === "eth_requestAccounts")
          return ["0x00000000000000000000000000000000000000Ab"];
        return null;
      }),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ result: "0x0" }), { status: 200 }),
      ),
    );
    await expect(connectAndReadBalances(provider)).resolves.toMatchObject({
      address: "0x00000000000000000000000000000000000000Ab",
    });
  });

  it("rejects an unsupported switch when the wallet is on another chain", async () => {
    const provider: Eip1193Provider = {
      request: vi.fn(async (args) => {
        if (args.method === "wallet_switchEthereumChain")
          throw { code: -32601 };
        if (args.method === "eth_chainId") return "0x1";
        return ["0x00000000000000000000000000000000000000Ab"];
      }),
    };
    await expect(connectAndReadBalances(provider)).rejects.toMatchObject({
      code: "WRONG_CHAIN",
      message:
        "Switch your wallet to Robinhood Chain (chain 4663) and try again.",
    });
  });
});
