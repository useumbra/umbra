import { describe, expect, it } from "vitest";
import { holderTiers, nextTier, tierForBalance, tokensToWei } from "./holder";

const decimals = 18;

describe("holder tiers", () => {
  it("selects the base tier for zero balance", () => {
    expect(tierForBalance(BigInt(0), decimals).id).toBe("base");
  });

  it("selects each tier at its exact threshold", () => {
    expect(tierForBalance(tokensToWei(100_000, decimals), decimals).id).toBe(
      "holder",
    );
    expect(tierForBalance(tokensToWei(1_000_000, decimals), decimals).id).toBe(
      "circle",
    );
    expect(tierForBalance(tokensToWei(10_000_000, decimals), decimals).id).toBe(
      "council",
    );
  });

  it("keeps a balance one wei below each threshold in the lower tier", () => {
    expect(
      tierForBalance(tokensToWei(100_000, decimals) - BigInt(1), decimals).id,
    ).toBe("base");
    expect(
      tierForBalance(tokensToWei(1_000_000, decimals) - BigInt(1), decimals).id,
    ).toBe("holder");
    expect(
      tierForBalance(tokensToWei(10_000_000, decimals) - BigInt(1), decimals)
        .id,
    ).toBe("circle");
  });

  it("handles very large balances and other decimal counts", () => {
    expect(tierForBalance(BigInt(10) ** BigInt(80), decimals).id).toBe(
      "council",
    );
    expect(tierForBalance(tokensToWei(100_000, 6), 6).id).toBe("holder");
  });

  it("rejects invalid decimal counts", () => {
    expect(() => tierForBalance(BigInt(0), -1)).toThrow();
    expect(() => tierForBalance(BigInt(0), 256)).toThrow();
    expect(() => tierForBalance(BigInt(0), 1.5)).toThrow();
  });

  it("returns the next tier when one exists", () => {
    expect(nextTier(holderTiers[0])?.id).toBe("holder");
    expect(nextTier(holderTiers[3])).toBeUndefined();
  });
});
