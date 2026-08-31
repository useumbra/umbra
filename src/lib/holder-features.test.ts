import { describe, expect, it } from "vitest";
import { hasFeature, tierRank, unlockedFeatures } from "./holder-features";

describe("holder features", () => {
  it("ranks known tiers and treats unknown tiers as base", () => {
    expect(tierRank()).toBe(0);
    expect(tierRank("unknown")).toBe(0);
    expect(tierRank("base")).toBe(0);
    expect(tierRank("holder")).toBe(1);
    expect(tierRank("circle")).toBe(2);
    expect(tierRank("council")).toBe(3);
  });

  it("unlocks the roadmap vote for verified holders", () => {
    expect(unlockedFeatures()).toEqual([]);
    expect(unlockedFeatures("base")).toEqual([]);
    expect(unlockedFeatures("holder").map((feature) => feature.id)).toEqual([
      "vote",
    ]);
    expect(unlockedFeatures("council").map((feature) => feature.id)).toEqual([
      "vote",
    ]);
    expect(hasFeature("vote", "holder")).toBe(true);
    expect(hasFeature("vote", "base")).toBe(false);
    expect(hasFeature("unknown", "council")).toBe(false);
  });
});
