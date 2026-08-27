import { openDB, type IDBPDatabase } from "idb";
import type { Conversation } from "./storage";
import type { UsageRecord } from "./usage";

export type UmbraDB = {
  conversations: { key: string; value: Conversation };
  settings: { key: string; value: unknown };
  usage: { key: string; value: UsageRecord };
};

let dbPromise: Promise<IDBPDatabase<UmbraDB>> | undefined;

export const db = () =>
  (dbPromise ??= openDB<UmbraDB>("umbra-local", 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore("conversations");
        database.createObjectStore("settings");
      }
      if (oldVersion < 2) database.createObjectStore("usage");
    },
  }));
