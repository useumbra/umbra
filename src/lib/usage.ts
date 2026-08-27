import { openDB, type IDBPDatabase } from "idb";

export type UsageRecord = {
  date: string;
  modelId: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
};

export type UsageInput = {
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  total_tokens?: unknown;
  cost?: unknown;
};

type UsageDB = {
  conversations: { key: string; value: unknown };
  settings: { key: string; value: unknown };
  usage: { key: string; value: UsageRecord };
};

let localDb: Promise<IDBPDatabase<UsageDB>> | undefined;
const db = () =>
  (localDb ??= openDB<UsageDB>("umbra-local", 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore("conversations");
        database.createObjectStore("settings");
      }
      if (oldVersion < 2) database.createObjectStore("usage");
    },
  }));

const numberOrZero = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;

export const localDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const usageFromProvider = (input: UsageInput) => ({
  inputTokens: numberOrZero(input.prompt_tokens),
  outputTokens: numberOrZero(input.completion_tokens),
  cost: numberOrZero(input.cost),
});

export const aggregateUsage = (
  records: UsageRecord[],
  range: "7d" | "30d" | "all",
  now = new Date(),
) => {
  const cutoff =
    range === "all"
      ? ""
      : localDate(
          new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - (range === "7d" ? 6 : 29),
          ),
        );
  const selected = records.filter((record) => !cutoff || record.date >= cutoff);
  const byDay = new Map<string, UsageRecord>();
  const byModel = new Map<string, UsageRecord>();
  for (const record of selected) {
    const add = (map: Map<string, UsageRecord>, key: string) => {
      const current = map.get(key);
      if (current) {
        current.requests += record.requests;
        current.inputTokens += record.inputTokens;
        current.outputTokens += record.outputTokens;
        current.cost += record.cost;
      } else {
        map.set(key, { ...record, date: key, modelId: key });
      }
    };
    add(byDay, record.date);
    add(byModel, record.modelId);
  }
  const totals = selected.reduce(
    (result, record) => ({
      requests: result.requests + record.requests,
      inputTokens: result.inputTokens + record.inputTokens,
      outputTokens: result.outputTokens + record.outputTokens,
      cost: result.cost + record.cost,
    }),
    { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 },
  );
  return {
    records: selected,
    daily: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    byModel: [...byModel.values()].sort((a, b) => b.cost - a.cost),
    totals: {
      ...totals,
      totalTokens: totals.inputTokens + totals.outputTokens,
    },
  };
};

export const getUsage = async () => (await db()).getAll("usage");

export const recordUsage = async (
  modelId: string,
  input: UsageInput,
  date = new Date(),
) => {
  const stats = usageFromProvider(input);
  const key = `${localDate(date)}:${modelId}`;
  const database = await db();
  const current = await database.get("usage", key);
  const record: UsageRecord = {
    date: localDate(date),
    modelId,
    requests: (current?.requests ?? 0) + 1,
    inputTokens: (current?.inputTokens ?? 0) + stats.inputTokens,
    outputTokens: (current?.outputTokens ?? 0) + stats.outputTokens,
    cost: (current?.cost ?? 0) + stats.cost,
  };
  await database.put("usage", record, key);
};

export const clearUsage = async () => (await db()).clear("usage");
