import { describe, expect, it } from "vitest";
import { createHolderProof } from "./holder-proof";
import { tierFromRequest } from "./holder-request";
import { limitsForTier, maxHolderLimits } from "./holder-limits";

describe("holder limits", () => {
  it("returns the base limits for missing and unknown tiers", () => {
    const base = {
      councilSeats: 3,
      chatMaxTokens: 8192,
      codeMaxTokens: 6000,
    };
    expect(limitsForTier()).toEqual(base);
    expect(limitsForTier("unknown")).toEqual(base);
  });

  it("returns the configured limits for every holder tier", () => {
    expect(limitsForTier("holder")).toEqual({
      councilSeats: 3,
      chatMaxTokens: 12288,
      codeMaxTokens: 8000,
    });
    expect(limitsForTier("circle")).toEqual({
      councilSeats: 5,
      chatMaxTokens: 16384,
      codeMaxTokens: 12000,
    });
    expect(limitsForTier("council")).toEqual({
      councilSeats: 5,
      chatMaxTokens: 24576,
      codeMaxTokens: 16000,
    });
  });

  it("exports the council limits as the maximum", () => {
    expect(maxHolderLimits).toEqual(limitsForTier("council"));
  });
});

describe("holder request tier", () => {
  const address = "0x827Bc6A9d7376E19EFd180D990AcC51018D1ccEe";

  it("returns undefined without a proof header", () => {
    expect(
      tierFromRequest(new Request("https://example.test")),
    ).toBeUndefined();
  });

  it("reads the tier from a valid proof header", () => {
    const proof = createHolderProof(address, "circle", "1000000");
    const request = new Request("https://example.test", {
      headers: { "x-umbra-holder-proof": proof },
    });
    expect(tierFromRequest(request)).toBe("circle");
  });

  it("ignores a damaged proof header", () => {
    const request = new Request("https://example.test", {
      headers: { "x-umbra-holder-proof": "damaged" },
    });
    expect(tierFromRequest(request)).toBeUndefined();
  });
});
