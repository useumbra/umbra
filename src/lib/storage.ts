import { openDB, type IDBPDatabase } from "idb";
import type { AttachmentMetadata } from "./attachments";
import type { Citation } from "./chat-features";
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
