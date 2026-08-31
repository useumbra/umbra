import { getSetting, saveSetting } from "./storage";

export type MemoryEntry = {
  id: string;
  text: string;
  createdAt: number;
};

export type MemoryState = {
  enabled: boolean;
  entries: MemoryEntry[];
};

const memoryKey = "memory";
const dismissedMemoryKey = "memory-dismissed";
const defaultMemory: MemoryState = { enabled: true, entries: [] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalize = (value: unknown): MemoryState => {
  if (!isRecord(value)) return defaultMemory;
  const entries = Array.isArray(value.entries)
    ? value.entries.filter(
        (entry): entry is MemoryEntry =>
          isRecord(entry) &&
          typeof entry.id === "string" &&
          typeof entry.text === "string" &&
          typeof entry.createdAt === "number",
      )
    : [];
  return {
    enabled: value.enabled !== false,
    entries,
  };
};

export const getMemory = async () =>
  normalize(await getSetting<unknown>(memoryKey, defaultMemory));

export const saveMemory = async (memory: MemoryState) => {
  const next = normalize(memory);
  await saveSetting(memoryKey, next);
  return next;
};

export const addMemory = async (text: string, current?: MemoryState) => {
  const state = current ?? (await getMemory());
  const entry: MemoryEntry = {
    id: Math.random().toString(36).slice(2),
    text: text.trim(),
    createdAt: Date.now(),
  };
  return saveMemory({ ...state, entries: [entry, ...state.entries] });
};

export const updateMemory = async (
  id: string,
  text: string,
  current?: MemoryState,
) => {
  const state = current ?? (await getMemory());
  return saveMemory({
    ...state,
    entries: state.entries.map((entry) =>
      entry.id === id ? { ...entry, text: text.trim() } : entry,
    ),
  });
};

export const removeMemory = async (id: string, current?: MemoryState) => {
  const state = current ?? (await getMemory());
  return saveMemory({
    ...state,
    entries: state.entries.filter((entry) => entry.id !== id),
  });
};

export const clearMemory = async (current?: MemoryState) => {
  const state = current ?? (await getMemory());
  return saveMemory({ ...state, entries: [] });
};

export const setMemoryEnabled = async (
  enabled: boolean,
  current?: MemoryState,
) => {
  const state = current ?? (await getMemory());
  return saveMemory({ ...state, enabled });
};

export const memoryPrompt = (entries: MemoryEntry[]) =>
  entries.length
    ? [
        "The user has asked Umbra to remember this context:",
        ...entries.map((entry) => `- ${entry.text}`),
      ].join("\n")
    : "";

export const getDismissedMemories = async (): Promise<string[]> => {
  const value = await getSetting<unknown>(dismissedMemoryKey, []);
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toLowerCase())
        .slice(-50)
    : [];
};

export const dismissMemory = async (text: string): Promise<string[]> => {
  const dismissed = await getDismissedMemories();
  const value = text.trim().toLowerCase();
  const next = [...dismissed.filter((item) => item !== value), value].slice(
    -50,
  );
  await saveSetting(dismissedMemoryKey, next);
  return next;
};
