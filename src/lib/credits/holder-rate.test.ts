import { describe, expect, it } from "vitest";
import { holderBonusCredits, holderBonusPercent } from "./holder-rate";

describe("holder-rate credits", () => {
  it("returns the configured bonus for each tier", () => {
    expect(holderBonusPercent()).toBe(0);
    expect(holderBonusPercent("unknown")).toBe(0);
    expect(holderBonusPercent("holder")).toBe(5);
    expect(holderBonusPercent("circle")).toBe(10);
    expect(holderBonusPercent("council")).toBe(20);
  });

  it("calculates rounded bonus credits", () => {
    expect(holderBonusCredits(100, "holder")).toBe(5);
    expect(holderBonusCredits(12, "circle")).toBe(1.2);
    expect(holderBonusCredits(1.2345678, "council")).toBe(0.246914);
    expect(holderBonusCredits(100, "unknown")).toBe(0);
  });

  it("rejects invalid credit amounts", () => {
    expect(() => holderBonusCredits(-1, "holder")).toThrow(
      "Invalid credit amount",
    );
    expect(() => holderBonusCredits(Number.NaN, "holder")).toThrow(
      "Invalid credit amount",
    );
  });
});
