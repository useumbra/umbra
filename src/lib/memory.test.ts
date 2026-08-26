import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock("./storage", () => ({
  getSetting: vi.fn(async (_key: string, fallback: unknown) =>
    state.value === undefined ? fallback : state.value,
  ),
  saveSetting: vi.fn(async (_key: string, value: unknown) => {
    state.value = value;
  }),
}));

import {
  addMemory,
  getMemory,
  memoryPrompt,
  removeMemory,
  setMemoryEnabled,
} from "./memory";

describe("Umbra Memory", () => {
  beforeEach(() => {
    state.value = undefined;
  });

  it("persists an entry and reads it back", async () => {
    const saved = await addMemory("Alice uses alice@example.com");
    expect(saved.entries).toHaveLength(1);
    await expect(getMemory()).resolves.toEqual(saved);
    await removeMemory(saved.entries[0].id, saved);
    await expect(getMemory()).resolves.toEqual({ enabled: true, entries: [] });
  });

  it("renders a short system prompt", () => {
    expect(
      memoryPrompt([
        { id: "1", text: "Prefers concise answers.", createdAt: 1 },
      ]),
    ).toBe(
      "The user has asked Umbra to remember this context:\n- Prefers concise answers.",
    );
  });

  it("can be disabled without changing entries", async () => {
    const saved = await addMemory("Keep this");
    const disabled = await setMemoryEnabled(false, saved);
    expect(disabled.enabled).toBe(false);
    expect(disabled.entries).toEqual(saved.entries);
    expect(memoryPrompt(disabled.enabled ? disabled.entries : [])).toBe("");
  });
});
