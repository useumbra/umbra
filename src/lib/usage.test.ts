import { describe, expect, it } from "vitest";
import { aggregateUsage, localDate, usageFromProvider } from "./usage";

describe("usage aggregation", () => {
  it("normalizes provider usage and calculates totals", () => {
    expect(
      usageFromProvider({
        prompt_tokens: 12,
        completion_tokens: 8,
        cost: 0.004,
      }),
    ).toEqual({ inputTokens: 12, outputTokens: 8, cost: 0.004 });
  });

  it("groups records by day and model within a range", () => {
    const now = new Date(2026, 7, 27, 12);
    const result = aggregateUsage(
      [
        {
          date: localDate(now),
          modelId: "nova-4",
          requests: 1,
          inputTokens: 10,
          outputTokens: 5,
          cost: 0.2,
        },
        {
          date: localDate(new Date(2026, 7, 25)),
          modelId: "nova-4",
          requests: 2,
          inputTokens: 20,
          outputTokens: 10,
          cost: 0.3,
        },
        {
          date: "2026-01-01",
          modelId: "old",
          requests: 9,
          inputTokens: 90,
          outputTokens: 90,
          cost: 9,
        },
      ],
      "7d",
      now,
    );
    expect(result.totals).toEqual({
      requests: 3,
      inputTokens: 30,
      outputTokens: 15,
      totalTokens: 45,
      cost: 0.5,
    });
    expect(result.daily).toHaveLength(2);
    expect(result.byModel[0].modelId).toBe("nova-4");
  });
});
