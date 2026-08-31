import { describe, expect, it } from "vitest";
import { canVote, findPoll, isPollOption, voteWeight } from "./holder-vote";

describe("holder voting", () => {
  it("weights each holder tier", () => {
    expect(voteWeight()).toBe(0);
    expect(voteWeight("base")).toBe(0);
    expect(voteWeight("unknown")).toBe(0);
    expect(voteWeight("holder")).toBe(1);
    expect(voteWeight("circle")).toBe(3);
    expect(voteWeight("council")).toBe(10);
    expect(canVote("base")).toBe(false);
    expect(canVote("holder")).toBe(true);
  });

  it("finds valid polls and options", () => {
    expect(findPoll("provider")?.question).toContain("provider");
    expect(findPoll("missing")).toBeUndefined();
    expect(isPollOption("provider", "anthropic")).toBe(true);
    expect(isPollOption("provider", "missing")).toBe(false);
    expect(isPollOption("missing", "anthropic")).toBe(false);
  });
});
