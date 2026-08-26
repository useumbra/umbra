"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { brand } from "@/config/brand";
import { models } from "@/config/models";
import { Vault, redact, restore } from "@/lib/privacy";
import {
  MAX_ATTACHMENT_TEXT,
  combineReceipts,
  readAttachment,
  type AttachmentDraft,
} from "@/lib/attachments";
import {
  CONVERSATION_EXPORT_WARNING,
  createConversationExport,
  parseConversationExport,
} from "@/lib/conversation-transfer";
import {
  deleteConversation,
  getConversations,
  getSetting,
  saveConversation,
  saveSetting,
  type Conversation,
  type ChatMessage,
} from "@/lib/storage";
import type { ProviderMessage } from "@/lib/providers/types";
import styles from "./ChatClient.module.css";
const id = () => Math.random().toString(36).slice(2);
export function ChatClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [mode, setMode] = useState<"smart" | "full" | "off">("smart");
  const [model, setModel] = useState(models[0].id);
  const [effort, setEffort] = useState("medium");
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [search, setSearch] = useState("");
  const [transferMessage, setTransferMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void Promise.all([
      getConversations(),
      getSetting("mode", "smart" as const),
      getSetting("model", models[0].id),
    ]).then(([items, savedMode, savedModel]) => {
      setConversations(items);
      setMode(savedMode);
      setModel(savedModel);
      if (items[0]) setActive(items[0]);
    });
  }, []);
  const start = () => {
    const next: Conversation = {
      id: id(),
      title: "New conversation",
      messages: [],
      vault: new Vault().toJSON(),
    };
    setActive(next);
    setConversations((items) => [next, ...items]);
    void saveConversation(next);
  };
  const send = async () => {
    if ((!draft.trim() && !attachments.length) || busy) return;
    if (
      attachments.some((attachment) => attachment.metadata.kind === "image") &&
      !selectedModel.capabilities.vision
    ) {
      setAttachmentError(
        "This model cannot receive images. Choose a vision-capable model or remove the image.",
      );
      return;
    }
    const conversation = active ?? {
      id: id(),
      title: (
        draft.trim() ||
        attachments[0]?.file.name ||
        "New conversation"
      ).slice(0, 32),
      messages: [],
      vault: new Vault().toJSON(),
    };
    const vault = Vault.fromJSON(conversation.vault);
    const protectedPrompt = redact(draft, vault, mode);
    let originalContent = draft;
    let protectedContent = protectedPrompt.text;
    const receipts = [protectedPrompt.receipt];
    const attachmentMetadata = attachments.map((attachment) => ({
      ...attachment.metadata,
    }));
    let remaining = MAX_ATTACHMENT_TEXT;
    for (const [index, attachment] of attachments.entries()) {
      if (attachment.metadata.kind === "image") {
        originalContent += `\n\n[Image attachment: ${attachment.file.name}]`;
        protectedContent += `\n\n[Image attachment: ${attachment.file.name}]`;
        continue;
      }
      const visibleText = attachment.text.slice(0, remaining);
      remaining = Math.max(0, remaining - visibleText.length);
      const protectedAttachment = redact(visibleText, vault, mode);
      originalContent += `\n\nAttachment: ${attachment.file.name}\n${visibleText}`;
      protectedContent += `\n\nAttachment: ${attachment.file.name}\n${protectedAttachment.text}`;
      receipts.push(protectedAttachment.receipt);
      if (visibleText.length < attachment.text.length) {
        attachmentMetadata[index].truncated = true;
      }
    }
    const protectedReceipt = combineReceipts(
      receipts,
      originalContent.length,
      protectedContent.length,
    );
    const user: ChatMessage = {
      id: id(),
      role: "user",
      content: originalContent,
      redacted: protectedContent,
      receipt: protectedReceipt,
      attachments: attachmentMetadata,
    };
    const next = {
      ...conversation,
      title: conversation.messages.length
        ? conversation.title
        : draft.slice(0, 32),
      messages: [...conversation.messages, user],
      vault: vault.toJSON(),
    };
    setActive(next);
    setDraft("");
    setBusy(true);
    const assistant: ChatMessage = { id: id(), role: "assistant", content: "" };
    setActive({ ...next, messages: [...next.messages, assistant] });
    try {
      const providerMessages: ProviderMessage[] = next.messages.map(
        (message) => ({
          role: message.role,
          content: message.redacted ?? message.content,
        }),
      );
      const imageAttachments = attachments.filter(
        (attachment) => attachment.metadata.kind === "image",
      );
      const currentMessage = providerMessages.at(-1);
      if (currentMessage && imageAttachments.length) {
        currentMessage.content = [
          { type: "text", text: protectedContent },
          ...imageAttachments.map((attachment) => ({
            type: "image_url" as const,
            image_url: { url: attachment.dataUrl ?? "" },
          })),
        ];
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          effort,
          messages: providerMessages,
        }),
      });
      if (!response.body) throw new Error("No stream");
      const routeModel = response.headers.get("X-Umbra-Route-Model");
      const routeReason = response.headers.get("X-Umbra-Route-Reason");
      if (routeModel && routeReason)
        assistant.route = { model: routeModel, reason: routeReason };
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      let pending = "";
      let done = false;
      const appendLine = (line: string) => {
        if (!line || line.startsWith(":")) return;
        if (line.startsWith("data:")) {
          const payload = line.startsWith("data: ")
            ? line.slice(6)
            : line.slice(5);
          if (payload === "[DONE]") return;
          try {
            const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
            if (typeof delta === "string") raw += delta;
          } catch {
            // Ignore malformed provider protocol lines.
          }
        } else raw += line;
      };
      while (!done) {
        const result = await reader.read();
        done = result.done;
        pending += decoder.decode(result.value, { stream: !done });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        lines.forEach(appendLine);
        if (done) {
          appendLine(pending);
          pending = "";
        }
        const rendered = restore(raw, vault);
        assistant.content = rendered;
        setActive({ ...next, messages: [...next.messages, { ...assistant }] });
      }
      const finished = {
        ...next,
        messages: [...next.messages, assistant],
        vault: vault.toJSON(),
      };
      setActive(finished);
      setConversations((items) => [
        finished,
        ...items.filter((item) => item.id !== finished.id),
      ]);
      await saveConversation(finished);
      setAttachments([]);
    } catch {
      assistant.content =
        "The provider could not be reached. Your draft stayed local.";
      setActive({ ...next, messages: [...next.messages, assistant] });
    } finally {
      setBusy(false);
    }
  };
  const selectedModel = models.find((item) => item.id === model) ?? models[0];
  const activeMessages = useMemo(() => active?.messages ?? [], [active]);
  const attachmentTextLength = attachments.reduce(
    (total, attachment) =>
      total +
      (attachment.metadata.kind === "image" ? 0 : attachment.text.length),
    0,
  );
  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter(
      (conversation) =>
        conversation.title.toLowerCase().includes(query) ||
        conversation.messages.some((message) =>
          message.content.toLowerCase().includes(query),
        ),
    );
  }, [conversations, search]);
  const downloadExport = (items: Conversation[], filename: string) => {
    const blob = new Blob(
      [JSON.stringify(createConversationExport(items), null, 2)],
      {
        type: "application/json",
      },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setTransferMessage(
      "Export downloaded. It contains UNREDACTED original values.",
    );
  };
  const importConversations = async (file: File) => {
    let imported: Conversation[] | undefined;
    try {
      imported = parseConversationExport(await file.text());
    } catch {
      imported = undefined;
    }
    if (!imported?.length) {
      setTransferMessage(
        "Import rejected: this is not a valid Umbra conversation export.",
      );
      return;
    }
    const copies = imported.map((conversation) => ({
      ...conversation,
      id: id(),
    }));
    await Promise.all(
      copies.map((conversation) => saveConversation(conversation)),
    );
    setConversations((items) => [...copies, ...items]);
    setActive(copies[0]);
    setTransferMessage(
      `Imported ${copies.length} conversation${copies.length === 1 ? "" : "s"}.`,
    );
  };
  const handleAttachments = async (files: FileList | null) => {
    if (!files?.length) return;
    setAttachmentError("");
    const next: AttachmentDraft[] = [];
    for (const file of Array.from(files)) {
      try {
        next.push(await readAttachment(file, id()));
      } catch (error) {
        setAttachmentError(
          error instanceof Error ? error.message : "Could not read attachment.",
        );
      }
    }
    setAttachments((items) => [...items, ...next]);
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="wordmark">
          <span className="mark">◒</span>
          {brand.wordmark}
        </Link>
        <button className="active" onClick={start}>
          ＋ New conversation
        </button>
        <input
          className={styles.sidebarInput}
          aria-label="Search conversations"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search conversations"
        />
        <div className={`panel ${styles.transfer}`}>
          <strong>Local conversation files</strong>
          <p className="note">{CONVERSATION_EXPORT_WARNING}</p>
          <button
            onClick={() =>
              active
                ? downloadExport([active], "umbra-conversation.json")
                : setTransferMessage("Choose a conversation to export.")
            }
          >
            Export current
          </button>
          <button
            onClick={() =>
              downloadExport(conversations, "umbra-conversations.json")
            }
            disabled={!conversations.length}
          >
            Export all
          </button>
          <button onClick={() => importInputRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importConversations(file);
              event.target.value = "";
            }}
          />
          {transferMessage && <p className="note">{transferMessage}</p>}
        </div>
        <div className={styles.conversationList}>
          {filteredConversations.map((conversation) => (
            <button
              className={
                conversation.id === active?.id ? "conversation-active" : ""
              }
              key={conversation.id}
              onClick={() => setActive(conversation)}
              aria-current={conversation.id === active?.id ? "page" : undefined}
            >
              <span className="conversation-title">{conversation.title}</span>
            </button>
          ))}
        </div>
        {active && (
          <button
            style={{ marginTop: 20 }}
            onClick={() => {
              void deleteConversation(active.id);
              setConversations((items) =>
                items.filter((item) => item.id !== active.id),
              );
              setActive(null);
            }}
          >
            Delete conversation
          </button>
        )}
      </aside>
      <main className="chat-main">
        <div className="chat-top">
          <div>
            <strong>{brand.products.chat}</strong>
            <div className="note">Protected workspace · local vault</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={model}
              onChange={(event) => {
                setModel(event.target.value);
                void saveSetting("model", event.target.value);
              }}
            >
              {models.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            {selectedModel.capabilities.reasoning && (
              <select
                aria-label="Reasoning effort"
                value={effort}
                onChange={(event) => setEffort(event.target.value)}
              >
                <option value="low">Quick</option>
                <option value="medium">Balanced</option>
                <option value="high">Deep</option>
              </select>
            )}
          </div>
        </div>
        <div className="messages">
          {!activeMessages.length && (
            <div style={{ padding: "20vh 0", textAlign: "center" }}>
              <div className="eyebrow">Local first</div>
              <h2 style={{ margin: "20px auto", fontSize: 42 }}>
                What can we keep private?
              </h2>
              <p className="note">
                Write a prompt below. {brand.name} will show exactly what
                crosses the boundary.
              </p>
            </div>
          )}
          {activeMessages.map((message) => (
            <div className="message" key={message.id}>
              <div className="message-role">
                {message.role === "user"
                  ? "You · original"
                  : brand.products.chat}
              </div>
              <div className="message-bubble">
                {message.content}
                {message.role === "assistant" && message.route && (
                  <div className="note">
                    routed to{" "}
                    {models.find((item) => item.id === message.route?.model)
                      ?.label ?? message.route.model}{" "}
                    — {message.route.reason}
                  </div>
                )}
                {message.receipt && (
                  <details style={{ marginTop: 15 }}>
                    <summary className="note">
                      Privacy receipt · {message.receipt.count} protected
                    </summary>
                    <p className="note">
                      Provider saw: <code>{message.redacted}</code>
                    </p>
                    {message.receipt.entities.map((entity, index) => (
                      <div
                        className="finding"
                        key={`${index}-${entity.start}-${entity.type}`}
                      >
                        <span>{entity.type}</span>
                        <span>{entity.placeholder}</span>
                      </div>
                    ))}
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="composer-wrap">
          <div className="composer">
            {attachments.length > 0 && (
              <div className={styles.attachments}>
                {attachments.map((attachment) => (
                  <div className={styles.attachment} key={attachment.id}>
                    <span>
                      {attachment.file.name} · {attachment.metadata.kind}
                      {attachment.metadata.kind !== "image" &&
                        ` · ${attachment.text.length.toLocaleString()} chars`}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${attachment.file.name}`}
                      onClick={() =>
                        setAttachments((items) =>
                          items.filter((item) => item.id !== attachment.id),
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              value={draft}
              maxLength={10000}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask anything. Sensitive details stay behind the boundary."
            />
            <label className={styles.attachButton}>
              Attach files
              <input
                ref={attachmentInputRef}
                type="file"
                multiple
                accept=".txt,.md,.csv,.json,.pdf,image/*"
                hidden
                onChange={(event) => {
                  void handleAttachments(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            <button
              className="send"
              onClick={() => void send()}
              disabled={busy}
            >
              {busy ? "…" : "Send"}
            </button>
            <div className="composer-meta">
              <label>
                Privacy{" "}
                <select
                  className="control"
                  value={mode}
                  onChange={(event) => {
                    const next = event.target.value as typeof mode;
                    setMode(next);
                    void saveSetting("mode", next);
                  }}
                >
                  <option value="smart">Smart</option>
                  <option value="full">Full</option>
                  <option value="off">Off</option>
                </select>
              </label>
              <span>Enter to send · Shift+Enter for a new line</span>
            </div>
            {(attachmentTextLength > MAX_ATTACHMENT_TEXT ||
              attachmentError ||
              (attachments.some(
                (attachment) => attachment.metadata.kind === "image",
              ) &&
                !selectedModel.capabilities.vision)) && (
              <p className={styles.attachmentNotice} role="status">
                {attachmentTextLength > MAX_ATTACHMENT_TEXT &&
                  "Extracted attachment text will be capped at 120,000 characters. "}
                {attachments.some(
                  (attachment) => attachment.metadata.kind === "image",
                ) &&
                  !selectedModel.capabilities.vision &&
                  "The selected model cannot receive images. Choose a vision-capable model or remove the image. "}
                {attachmentError}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
