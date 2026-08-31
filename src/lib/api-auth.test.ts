import { beforeEach, describe, expect, it, vi } from "vitest";

const getCloudflareContext = vi.hoisted(() => vi.fn());

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext }));

import {
  createApiToken,
  createApiTokenDetails,
  dailyQuotaForTier,
  getApiTokenClaims,
  isApiTokenRevoked,
  isValidApiToken,
  revokeApiToken,
  requireApiAuth,
  usageKey,
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

  it("accepts known tier claims and rejects unknown tiers", () => {
    const known = createApiTokenDetails("test", 60, "Holder", "holder");
    expect(getApiTokenClaims(known.token)?.tier).toBe("holder");
    const unknown = createApiTokenDetails("test", 60, "Unknown", "unknown");
    expect(getApiTokenClaims(unknown.token)).toBeUndefined();
  });

  it("enforces the tier quota and stores a UTC usage counter", async () => {
    const { token, claims } = createApiTokenDetails(
      "test",
      60,
      "Holder",
      "holder",
    );
    const put = vi.fn();
    get.mockResolvedValue(null);
    getCloudflareContext.mockResolvedValue({
      env: { UMBRA_KEYS: { get, put } },
    });
    await expect(
      requireApiAuth(
        new Request("https://example.test", {
          headers: { authorization: `Bearer ${token}` },
        }),
      ),
    ).resolves.toBeUndefined();
    expect(put).toHaveBeenCalledWith(usageKey(claims.jti!), "1", {
      expirationTtl: 172_800,
    });
  });

  it("rejects a key after its daily quota is reached", async () => {
    const { token } = createApiTokenDetails("test", 60);
    const put = vi.fn();
    get.mockImplementation(async (key: string) =>
      key.startsWith("usage:") ? "200" : null,
    );
    getCloudflareContext.mockResolvedValue({
      env: { UMBRA_KEYS: { get, put } },
    });
    const response = await requireApiAuth(
      new Request("https://example.test", {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    expect(response?.status).toBe(429);
    expect(put).not.toHaveBeenCalled();
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

  it("maps holder tiers to daily quotas", () => {
    expect(dailyQuotaForTier()).toBe(200);
    expect(dailyQuotaForTier("base")).toBe(200);
    expect(dailyQuotaForTier("holder")).toBe(1_000);
    expect(dailyQuotaForTier("circle")).toBe(5_000);
    expect(dailyQuotaForTier("council")).toBe(20_000);
  });

  it("formats usage keys by UTC date", () => {
    expect(usageKey("jti", new Date("2025-01-02T01:00:00-08:00"))).toBe(
      "usage:jti:2025-01-02",
    );
  });
});
