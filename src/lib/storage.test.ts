import { beforeEach, describe, expect, it, vi } from "vitest";

const settings = vi.hoisted(() => new Map<string, unknown>());

vi.mock("idb", () => ({
  openDB: vi.fn(async () => ({
    get: async (_store: string, key: string) => settings.get(key),
    put: async (_store: string, value: unknown, key: string) => {
      settings.set(key, value);
    },
    delete: async (_store: string, key: string) => {
      settings.delete(key);
    },
    getAll: async () => [],
  })),
}));

import { getSetting, saveSetting } from "./storage";

describe("settings", () => {
  beforeEach(() => settings.clear());

  it("uses the fallback for a missing key", async () => {
    await expect(getSetting("missing", "fallback")).resolves.toBe("fallback");
  });

  it("returns a stored value instead of the fallback", async () => {
    await saveSetting("mode", "full");
    await expect(getSetting("mode", "smart")).resolves.toBe("full");
  });
});
