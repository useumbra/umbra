import { beforeEach, describe, expect, it, vi } from "vitest";

const getCloudflareContext = vi.hoisted(() => vi.fn());

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));

import {
  createApiToken,
  createApiTokenDetails,
  getApiTokenClaims,
  isApiTokenRevoked,
  isValidApiToken,
  revokeApiToken,
  requireApiAuth,
  validateApiKeyOptions,
} from "./api-auth";

describe("Umbra API token", () => {
  const get = vi.fn();

  beforeEach(() => {
    get.mockReset();
    getCloudflareContext.mockResolvedValue({
      env: { UMBRA_KEYS: { get } },
    });
  });

  it("uses the prefixed key format and new claims", () => {
    const token = createApiToken("test", 60, "Workbench");
    expect(token.startsWith("umb_")).toBe(true);
    expect(isValidApiToken(token)).toBe(true);
    expect(getApiTokenClaims(token)).toMatchObject({
      sub: "test",
      label: "Workbench",
    });
    expect(getApiTokenClaims(token)?.jti).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(isValidApiToken(token.slice(4))).toBe(true);
    expect(isValidApiToken(`${token}x`)).toBe(false);
  });

  it("rejects expired tokens", () => {
    expect(isValidApiToken(createApiToken("expired", -1))).toBe(false);
  });

  it("checks the revocation list for a token jti", async () => {
    const { claims } = createApiTokenDetails("test", 60);
    get.mockResolvedValue("1");
    expect(await isApiTokenRevoked(claims.jti!)).toBe(true);
    expect(get).toHaveBeenCalledWith(`revoked:${claims.jti}`);
  });

  it("rejects a revoked token through API auth", async () => {
    const token = createApiToken("test", 60);
    get.mockResolvedValue("revoked");
    const response = await requireApiAuth(
      new Request("https://example.test", {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    expect(response?.status).toBe(401);
  });

  it("stores a revocation entry until token expiry", async () => {
    const { token, claims } = createApiTokenDetails("test", 120);
    const put = vi.fn();
    getCloudflareContext.mockResolvedValue({
      env: { UMBRA_KEYS: { get, put } },
    });
    expect(await revokeApiToken(token)).toMatchObject({ jti: claims.jti });
    expect(put).toHaveBeenCalledWith(
      `revoked:${claims.jti}`,
      "1",
      expect.objectContaining({ expirationTtl: expect.any(Number) }),
    );
  });
});

describe("API key options", () => {
  it("applies defaults", () => {
    expect(validateApiKeyOptions({})).toEqual({
      label: "developer",
      days: 90,
    });
  });

  it("accepts valid label and lifetime", () => {
    expect(validateApiKeyOptions({ label: "CI", days: 365 })).toEqual({
      label: "CI",
      days: 365,
    });
  });

  it("rejects invalid label and lifetime", () => {
    expect(validateApiKeyOptions({ label: "x".repeat(65) })).toContain("label");
    expect(validateApiKeyOptions({ days: 0 })).toContain("days");
    expect(validateApiKeyOptions({ days: 1.5 })).toContain("days");
    expect(validateApiKeyOptions({ days: 366 })).toContain("days");
  });
});
