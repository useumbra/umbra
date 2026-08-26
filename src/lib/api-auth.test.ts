import { describe, expect, it } from "vitest";
import { createApiToken, isValidApiToken } from "./api-auth";

describe("Umbra API token", () => {
  it("validates a token signed by the server secret", () => {
    const token = createApiToken("test", 60);
    expect(isValidApiToken(token)).toBe(true);
    expect(isValidApiToken(`${token}x`)).toBe(false);
  });

  it("rejects expired tokens", () => {
    expect(isValidApiToken(createApiToken("expired", -1))).toBe(false);
  });
});
