import { openDB, type IDBPDatabase } from "idb";
import type { AttachmentMetadata } from "./attachments";
import type { Citation } from "./chat-features";
import { clearCreditsVault } from "./credits/storage";
import { clearMediaHistory } from "./media-storage";
type UmbraDB = {
  conversations: { key: string; value: Conversation };
  settings: { key: string; value: unknown };
};
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  redacted?: string;
  error?: string;
  receipt?: import("./privacy").Receipt;
  route?: { model: string; reason: string };
  attachments?: AttachmentMetadata[];
  citations?: Citation[];
  toolCalls?: {
    tool: string;
    arguments: Record<string, unknown>;
    result: string;
  }[];
};
export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  vault: ReturnType<import("./privacy").Vault["toJSON"]>;
  updatedAt?: number;
};
let dbPromise: Promise<IDBPDatabase<UmbraDB>> | undefined;
const db = () =>
  (dbPromise ??= openDB<UmbraDB>("umbra-local", 1, {
    upgrade(database) {
      database.createObjectStore("conversations");
      database.createObjectStore("settings");
    },
  }));
export const getConversations = async () =>
  (await db()).getAll("conversations");
export const saveConversation = async (conversation: Conversation) =>
  (await db()).put("conversations", conversation, conversation.id);
export const deleteConversation = async (id: string) =>
  (await db()).delete("conversations", id);
export const getSetting = async <T>(key: string, fallback: T) => {
  const value = await (await db()).get("settings", key);
  return value === undefined ? fallback : (value as T);
};
export const saveSetting = async (key: string, value: unknown) =>
  (await db()).put("settings", value, key);

export const clearLocalData = async () => {
  const database = await db();
  const transaction = database.transaction(
    ["conversations", "settings"],
    "readwrite",
  );
  await Promise.all([
    transaction.objectStore("conversations").clear(),
    transaction.objectStore("settings").clear(),
  ]);
  await transaction.done;
  await Promise.all([clearMediaHistory(), clearCreditsVault()]);
  localStorage.removeItem("umbra-theme");
};
