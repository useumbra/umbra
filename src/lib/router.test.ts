import { describe, expect, it } from "vitest";
import { models } from "../config/models";
import { route } from "./router";

describe("umbra-auto routing", () => {
  it("routes code prompts to the coder model", () => {
    expect(
      route("Fix this Python function:\n```py\nreturn 1\n```", models).model,
    ).toBe("qwen-coder");
  });

  it("routes long explain prompts to the cheap long-context model", () => {
    const prompt = `Explain this document:\n${"A long paragraph. ".repeat(400)}`;
    expect(route(prompt, models).model).toBe("gemini-flash");
  });

  it("routes math prompts to the reasoning model", () => {
    expect(
      route("Solve this equation and prove why it works: x^2 = 4", models)
        .model,
    ).toBe("reasoning-r1");
  });

  it("uses the everyday model by default", () => {
    const decision = route("Give me three dinner ideas.", models);
    expect(decision.model).toBe("nova-4");
    expect(decision.reason).toMatch(/everyday/i);
  });
});
