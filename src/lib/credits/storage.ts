import { openDB } from "idb";
import type { EncryptedVault } from "./crypto";

type CreditsDB = {
  vault: { key: string; value: EncryptedVault };
};

let dbPromise: ReturnType<typeof openDB<CreditsDB>> | undefined;
const db = () =>
  (dbPromise ??= openDB<CreditsDB>("umbra-credits", 1, {
    upgrade(database) {
      database.createObjectStore("vault");
    },
  }));

export const loadEncryptedVault = async () =>
  (await db()).get("vault", "local");
export const saveEncryptedVault = async (vault: EncryptedVault) =>
  (await db()).put("vault", vault, "local");

export const clearCreditsVault = async () => (await db()).clear("vault");
