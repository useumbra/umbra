import { describe, expect, it } from "vitest";
import {
  CONVERSATION_EXPORT_WARNING,
  createConversationExport,
  parseConversationExport,
} from "./conversation-transfer";

const conversation = {
  id: "one",
  title: "Private thread",
  messages: [
    {
      id: "message",
      role: "user" as const,
      content: "Jane Smith",
      redacted: "[PERSON_1]",
      attachments: [
        {
          name: "notes.txt",
          size: 10,
          kind: "text" as const,
          extractedCharacters: 10,
        },
      ],
    },
  ],
  vault: {
    values: [["PERSON:Jane Smith", "[PERSON_1]"]] as [string, string][],
    reverse: [["[PERSON_1]", "Jane Smith"]] as [string, string][],
  },
};

describe("conversation transfers", () => {
  it("preserves the vault and includes the unredacted warning", () => {
    const exported = createConversationExport([conversation]);
    expect(exported.warning).toBe(CONVERSATION_EXPORT_WARNING);
    expect(parseConversationExport(JSON.stringify(exported))).toEqual([
      conversation,
    ]);
  });

  it("rejects malformed imports without throwing", () => {
    expect(parseConversationExport("{not json")).toBeUndefined();
    expect(
      parseConversationExport(
        JSON.stringify({
          format: "umbra-conversations",
          version: 1,
          warning: "x",
          conversations: [{ id: "missing fields" }],
        }),
      ),
    ).toBeUndefined();
  });

  it("imports exports with a reworded warning", () => {
    const exported = createConversationExport([conversation]);
    exported.warning = "Updated privacy warning";
    expect(parseConversationExport(JSON.stringify(exported))).toEqual([
      conversation,
    ]);
  });
});
