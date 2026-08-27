import { openDB, type IDBPDatabase } from "idb";
import type { Conversation } from "./storage";
import type { UsageRecord } from "./usage";
import type { ApiKeyRecord } from "./api-keys";

export type UmbraDB = {
  conversations: { key: string; value: Conversation };
  settings: { key: string; value: unknown };
  usage: { key: string; value: UsageRecord };
  apiKeys: { key: string; value: ApiKeyRecord };
};

let dbPromise: Promise<IDBPDatabase<UmbraDB>> | undefined;

export const db = () =>
  (dbPromise ??= openDB<UmbraDB>("umbra-local", 3, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore("conversations");
        database.createObjectStore("settings");
      }
      if (oldVersion < 2) database.createObjectStore("usage");
      if (oldVersion < 3) database.createObjectStore("apiKeys");
    },
  }));
