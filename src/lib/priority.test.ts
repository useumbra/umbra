import { describe, expect, it } from "vitest";
import { priorityForTier, retryableProviderStatuses } from "./priority";

describe("holder priority plans", () => {
  it("assigns the requested retry and routing plan to each tier", () => {
    expect(priorityForTier()).toEqual({
      retries: 0,
      upgradeGeneralRoute: false,
    });
    expect(priorityForTier("unknown")).toEqual({
      retries: 0,
      upgradeGeneralRoute: false,
    });
    expect(priorityForTier("holder")).toEqual({
      retries: 1,
      upgradeGeneralRoute: false,
    });
    expect(priorityForTier("circle")).toEqual({
      retries: 2,
      upgradeGeneralRoute: true,
    });
    expect(priorityForTier("council")).toEqual({
      retries: 3,
      upgradeGeneralRoute: true,
    });
  });

  it("recognizes retryable provider statuses", () => {
    expect([...retryableProviderStatuses]).toEqual([429, 500, 502, 503, 504]);
  });
});
