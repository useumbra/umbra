import { describe, expect, it, vi } from "vitest";
import {
  chainIdHex,
  connectAndReadBalances,
  encodeBalanceOf,
  formatUnits,
  hexToBigInt,
  type Eip1193Provider,
} from "./wallet";

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
    vi.unstubAllGlobals();
  });
});
