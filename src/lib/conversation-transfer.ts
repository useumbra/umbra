import type { Conversation } from "./storage";

export const CONVERSATION_EXPORT_WARNING =
  "This export contains UNREDACTED original values. Keep it private.";

export type ConversationExport = {
  format: "umbra-conversations";
  version: 1;
  warning: string;
  exportedAt: string;
  conversations: Conversation[];
};

export const createConversationExport = (
  conversations: Conversation[],
): ConversationExport => ({
  format: "umbra-conversations",
  version: 1,
  warning: CONVERSATION_EXPORT_WARNING,
  exportedAt: new Date().toISOString(),
  conversations,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isTupleList = (value: unknown) =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      Array.isArray(item) &&
      item.length === 2 &&
      typeof item[0] === "string" &&
      typeof item[1] === "string",
  );

const isConversation = (value: unknown): value is Conversation => {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    !Array.isArray(value.messages) ||
    !isRecord(value.vault) ||
    !isTupleList(value.vault.values) ||
    !isTupleList(value.vault.reverse)
  )
    return false;
  return value.messages.every((message) => {
    if (!isRecord(message)) return false;
    if (
      typeof message.id !== "string" ||
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string"
    )
      return false;
    if (message.redacted !== undefined && typeof message.redacted !== "string")
      return false;
    if (
      message.attachments !== undefined &&
      (!Array.isArray(message.attachments) ||
        !message.attachments.every((attachment) => {
          if (!isRecord(attachment)) return false;
          return (
            typeof attachment.name === "string" &&
            typeof attachment.size === "number" &&
            (attachment.kind === "text" ||
              attachment.kind === "pdf" ||
              attachment.kind === "image") &&
            typeof attachment.extractedCharacters === "number" &&
            (attachment.truncated === undefined ||
              typeof attachment.truncated === "boolean")
          );
        }))
    )
      return false;
    return true;
  });
};

export const parseConversationExport = (
  input: string,
): Conversation[] | undefined => {
  try {
    const value: unknown = JSON.parse(input);
    if (!isRecord(value)) return undefined;
    if (
      value.format !== "umbra-conversations" ||
      value.version !== 1 ||
      typeof value.warning !== "string" ||
      !Array.isArray(value.conversations) ||
      !value.conversations.every(isConversation)
    )
      return undefined;
    return value.conversations;
  } catch {
    return undefined;
  }
};
