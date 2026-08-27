"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { brand } from "@/config/brand";
import { models } from "@/config/models";
import { Vault, redact, restore } from "@/lib/privacy";
import {
  addMemory,
  clearMemory,
  getMemory,
  removeMemory,
  setMemoryEnabled,
  updateMemory,
  memoryPrompt,
  type MemoryState,
} from "@/lib/memory";
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
import { getConnectors, type Connector, type McpTool } from "@/lib/connectors";
import {
  extractCitations,
  parseToolCall,
  schemaSummary,
  type Citation,
} from "@/lib/chat-features";
import type { ProviderMessage } from "@/lib/providers/types";
import styles from "./ChatClient.module.css";
const id = () => Math.random().toString(36).slice(2);

const streamCompletion = async ({
  messages,
  model,
  effort,
  webSearch,
  signal,
  onUpdate,
}: {
  messages: ProviderMessage[];
  model: string;
  effort: string;
  webSearch: boolean;
  signal: AbortSignal;
  onUpdate: (content: string, citations: Citation[]) => void;
}) => {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, effort, messages, webSearch }),
    signal,
  });
  if (!response.ok)
    throw new Error(`Provider returned HTTP ${response.status}`);
  if (!response.body) throw new Error("No stream");
  const routeModel = response.headers.get("X-Umbra-Route-Model");
  const routeReason = response.headers.get("X-Umbra-Route-Reason");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  let pending = "";
  let done = false;
  let citations: Citation[] = [];
  const appendLine = (line: string) => {
    if (!line || line.startsWith(":")) return;
    if (line.startsWith("data:")) {
      const payload = line.startsWith("data: ") ? line.slice(6) : line.slice(5);
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: {
            delta?: {
              content?: unknown;
              annotations?: unknown;
            };
            message?: { annotations?: unknown };
          }[];
        };
        const choice = parsed.choices?.[0];
        const delta = choice?.delta?.content;
        if (typeof delta === "string") raw += delta;
        citations = [
          ...citations,
          ...extractCitations(
            choice?.delta?.annotations ?? choice?.message?.annotations,
          ),
        ].filter(
          (citation, index, all) =>
            all.findIndex((item) => item.url === citation.url) === index,
        );
      } catch {
        // Ignore malformed provider protocol lines.
      }
    } else raw += line;
    onUpdate(raw, citations);
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
  }
  return {
    content: raw,
    citations,
    route:
      routeModel && routeReason
        ? { model: routeModel, reason: routeReason }
        : undefined,
  };
};

const restoreValue = (value: unknown, vault: Vault): unknown => {
  if (typeof value === "string") return restore(value, vault);
  if (Array.isArray(value))
    return value.map((item) => restoreValue(item, vault));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        restoreValue(item, vault),
      ]),
    );
  return value;
};

const toolIdentifier = (connector: Connector, tool: McpTool) =>
  `${connector.name}/${tool.name}`;

const citationHost = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "source";
  }
};

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string>();
  const [renameValue, setRenameValue] = useState("");
  const [copiedId, setCopiedId] = useState<string>();
  const [atLatest, setAtLatest] = useState(true);
  const [memory, setMemory] = useState<MemoryState>({
    enabled: true,
    entries: [],
  });
  const [memoryDraft, setMemoryDraft] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState<string>();
  const [memoryMessage, setMemoryMessage] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [toolUse, setToolUse] = useState(false);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const messagesRef = useRef<HTMLDivElement>(null);
  const activeMessages = useMemo(() => active?.messages ?? [], [active]);
  useEffect(() => {
    void Promise.all([
      getConversations(),
      getSetting("mode", "smart" as const),
      getSetting("model", models[0].id),
      getSetting("effort", "medium"),
      getSetting("webSearch", false),
      getSetting("toolUse", false),
      getMemory(),
      getConnectors(),
    ]).then(
      ([
        items,
        savedMode,
        savedModel,
        savedEffort,
        savedWebSearch,
        savedToolUse,
        savedMemory,
        savedConnectors,
      ]) => {
        setConversations(items);
        setMode(savedMode);
        setModel(savedModel);
        setEffort(savedEffort);
        setWebSearch(savedWebSearch);
        setToolUse(savedToolUse);
        setMemory(savedMemory);
        setConnectors(savedConnectors);
        if (items[0]) setActive(items[0]);
      },
    );
  }, []);
  useEffect(() => {
    const element = messagesRef.current;
    if (!element) return;
    const update = () => {
      setAtLatest(
        element.scrollHeight - element.scrollTop - element.clientHeight < 80,
      );
    };
    element.addEventListener("scroll", update, { passive: true });
    update();
    return () => element.removeEventListener("scroll", update);
  }, [active]);
  useEffect(() => {
    const element = messagesRef.current;
    if (element && atLatest) element.scrollTop = element.scrollHeight;
  }, [activeMessages, atLatest]);
  const start = () => {
    const next: Conversation = {
      id: id(),
      title: "New conversation",
      messages: [],
      vault: new Vault().toJSON(),
    };
    setActive(next);
    setConversations((items) => [next, ...items]);
    setSidebarOpen(false);
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
    const protectedMemory =
      memory.enabled && memory.entries.length
        ? redact(memoryPrompt(memory.entries), vault, mode).text
        : "";
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
      if (visibleText.length < attachment.text.length)
        attachmentMetadata[index].truncated = true;
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
        : (
            draft.trim() ||
            attachments[0]?.file.name ||
            "New conversation"
          ).slice(0, 32),
      messages: [...conversation.messages, user],
      vault: vault.toJSON(),
    };
    const discoveredTools = connectors.flatMap((connector) =>
      (connector.tools ?? []).map((tool) => ({
        connector,
        tool,
        name: toolIdentifier(connector, tool),
      })),
    );
    const availableToolNames = discoveredTools.map((item) => item.name);
    const toolInstructions =
      toolUse && discoveredTools.length
        ? [
            "Available connector tools:",
            ...discoveredTools.map(
              ({ tool, name }) =>
                `- ${name}: ${tool.description || "No description provided."} Schema: ${schemaSummary(tool.inputSchema)}`,
            ),
            'To call a tool, reply with a single line of JSON {"tool":"<connector>/<tool>","arguments":{...}} and nothing else. Otherwise answer normally.',
          ].join("\n")
        : "";
    setActive(next);
    setDraft("");
    setBusy(true);
    abortRef.current = new AbortController();
    const assistant: ChatMessage = { id: id(), role: "assistant", content: "" };
    setActive({ ...next, messages: [...next.messages, assistant] });
    try {
      const baseProviderMessages: ProviderMessage[] = next.messages.map(
        (message) => ({
          role: message.role,
          content: message.redacted ?? message.content,
        }),
      );
      const imageAttachments = attachments.filter(
        (attachment) => attachment.metadata.kind === "image",
      );
      const currentMessage = baseProviderMessages.at(-1);
      if (currentMessage && imageAttachments.length) {
        currentMessage.content = [
          { type: "text", text: protectedContent },
          ...imageAttachments.map((attachment) => ({
            type: "image_url" as const,
            image_url: { url: attachment.dataUrl ?? "" },
          })),
        ];
      }
      const toolResultMessages: ProviderMessage[] = [];
      let rounds = 0;
      while (true) {
        const providerMessages = [...baseProviderMessages];
        if (protectedMemory)
          providerMessages.unshift({
            role: "system",
            content: protectedMemory,
          });
        if (toolInstructions)
          providerMessages.unshift({
            role: "system",
            content: toolInstructions,
          });
        providerMessages.push(...toolResultMessages);
        const completion = await streamCompletion({
          messages: providerMessages,
          model,
          effort,
          webSearch,
          signal: abortRef.current.signal,
          onUpdate: (content, citations) => {
            assistant.content = restore(content, vault);
            assistant.citations = citations;
            setActive({
              ...next,
              messages: [...next.messages, { ...assistant }],
            });
          },
        });
        assistant.content = restore(completion.content, vault);
        assistant.citations = completion.citations;
        if (completion.route) assistant.route = completion.route;
        if (!toolUse || !discoveredTools.length) break;
        const parsed = parseToolCall(completion.content, availableToolNames);
        if (parsed.kind === "none") break;
        if (parsed.kind === "invalid") {
          assistant.error = parsed.error;
          break;
        }
        if (rounds >= 3) {
          assistant.error = "Tool use stopped after 3 rounds.";
          break;
        }
        const selectedTool = discoveredTools.find(
          (item) => item.name === parsed.tool,
        );
        if (!selectedTool) {
          assistant.error = `Unknown tool requested: ${parsed.tool}`;
          break;
        }
        const sentArguments = restoreValue(parsed.arguments, vault) as Record<
          string,
          unknown
        >;
        let toolResult: unknown;
        try {
          const connector = selectedTool.connector;
          const response = await fetch("/api/mcp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: connector.url,
              method: "tools/call",
              params: {
                name: selectedTool.tool.name,
                arguments: sentArguments,
              },
              ...(connector.headerName && connector.headerValue
                ? {
                    header: {
                      name: connector.headerName,
                      value: connector.headerValue,
                    },
                  }
                : {}),
            }),
            signal: abortRef.current.signal,
          });
          if (!response.ok)
            throw new Error(`Tool returned HTTP ${response.status}`);
          toolResult = await response.json();
        } catch (error) {
          assistant.error =
            error instanceof Error ? error.message : "Tool invocation failed.";
          break;
        }
        const resultText = JSON.stringify(toolResult, null, 2);
        const protectedResult = redact(resultText, vault, mode).text;
        assistant.toolCalls = [
          ...(assistant.toolCalls ?? []),
          {
            tool: parsed.tool,
            arguments: sentArguments,
            result: protectedResult,
          },
        ];
        assistant.content = "";
        setActive({ ...next, messages: [...next.messages, { ...assistant }] });
        toolResultMessages.push(
          { role: "assistant", content: completion.content },
          {
            role: "system",
            content: `Tool result for ${parsed.tool}:\n${protectedResult}`,
          },
        );
        rounds += 1;
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
    } catch (error) {
      assistant.error =
        error instanceof DOMException && error.name === "AbortError"
          ? "Response stopped before completion."
          : "The provider could not be reached. Your draft stayed local.";
      const failed = {
        ...next,
        messages: [...next.messages, { ...assistant }],
        vault: vault.toJSON(),
      };
      setActive(failed);
      setConversations((items) => [
        failed,
        ...items.filter((item) => item.id !== failed.id),
      ]);
      await saveConversation(failed);
    } finally {
      setBusy(false);
      abortRef.current = undefined;
    }
  };
  const stop = () => abortRef.current?.abort();
  const jumpToLatest = () => {
    const element = messagesRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    setAtLatest(true);
  };
  const rename = async (conversation: Conversation) => {
    const title = renameValue.trim();
    if (!title) return;
    const next = { ...conversation, title: title.slice(0, 80) };
    await saveConversation(next);
    setConversations((items) =>
      items.map((item) => (item.id === next.id ? next : item)),
    );
    if (active?.id === next.id) setActive(next);
    setRenamingId(undefined);
  };
  const selectedModel = models.find((item) => item.id === model) ?? models[0];
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
  const availableTools = useMemo(
    () =>
      connectors.flatMap((connector) =>
        (connector.tools ?? []).map((tool) => ({
          connector,
          tool,
          name: toolIdentifier(connector, tool),
        })),
      ),
    [connectors],
  );
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
  const remember = async (text: string) => {
    const next = await addMemory(text, memory);
    setMemory(next);
    setMemoryMessage("Saved to Umbra Memory in this browser.");
  };
  const saveMemoryDraft = async () => {
    if (!memoryDraft.trim()) return;
    const next = editingMemoryId
      ? await updateMemory(editingMemoryId, memoryDraft, memory)
      : await addMemory(memoryDraft, memory);
    setMemory(next);
    setMemoryDraft("");
    setEditingMemoryId(undefined);
    setMemoryMessage("Memory saved in this browser.");
  };
  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className={styles.drawerBackdrop}
          type="button"
          aria-label="Close conversation drawer"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${sidebarOpen ? styles.sidebarOpen : ""}`}
        id="conversation-sidebar"
      >
        <Link href="/" className="wordmark">
          <span className="mark">◒</span>
          {brand.wordmark}
        </Link>
        <button
          className={styles.drawerClose}
          type="button"
          onClick={() => setSidebarOpen(false)}
        >
          Close
        </button>
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
        <div className={`panel ${styles.memoryPanel}`}>
          <div className={styles.memoryHeading}>
            <strong>Umbra Memory</strong>
            <label className={styles.memoryToggle}>
              <input
                type="checkbox"
                checked={memory.enabled}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  setMemory((value) => ({ ...value, enabled }));
                  void setMemoryEnabled(enabled, memory);
                }}
              />
              On
            </label>
          </div>
          <p className="note">
            Memory lives only in this browser and is redacted before sending.
          </p>
          <textarea
            className={styles.memoryInput}
            value={memoryDraft}
            onChange={(event) => setMemoryDraft(event.target.value)}
            placeholder="A detail Umbra should remember"
            aria-label="Memory entry"
          />
          <div className={styles.memoryActions}>
            <button onClick={() => void saveMemoryDraft()}>
              {editingMemoryId ? "Update" : "Add memory"}
            </button>
            {memory.entries.length > 0 && (
              <button
                onClick={() => {
                  void clearMemory(memory).then((next) => {
                    setMemory(next);
                    setMemoryMessage("Memory cleared in this browser.");
                  });
                }}
              >
                Clear all
              </button>
            )}
          </div>
          {memory.entries.map((entry) => (
            <div className={styles.memoryEntry} key={entry.id}>
              <span>{entry.text}</span>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMemoryId(entry.id);
                    setMemoryDraft(entry.text);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void removeMemory(entry.id, memory).then(setMemory)
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {memoryMessage && <p className="note">{memoryMessage}</p>}
        </div>
        <div className={styles.conversationList}>
          {filteredConversations.map((conversation) => (
            <div className={styles.conversationRow} key={conversation.id}>
              {renamingId === conversation.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void rename(conversation);
                  }}
                >
                  <input
                    className={styles.renameInput}
                    value={renameValue}
                    autoFocus
                    onChange={(event) => setRenameValue(event.target.value)}
                    onBlur={() => {
                      if (renameValue.trim()) void rename(conversation);
                      else setRenamingId(undefined);
                    }}
                    aria-label="Conversation title"
                  />
                </form>
              ) : (
                <button
                  className={
                    conversation.id === active?.id ? "conversation-active" : ""
                  }
                  onClick={() => {
                    setActive(conversation);
                    setSidebarOpen(false);
                  }}
                  aria-current={
                    conversation.id === active?.id ? "page" : undefined
                  }
                >
                  <span className="conversation-title">
                    {conversation.title}
                  </span>
                </button>
              )}
              <button
                className={styles.renameButton}
                type="button"
                aria-label={`Rename ${conversation.title}`}
                onClick={() => {
                  setRenamingId(conversation.id);
                  setRenameValue(conversation.title);
                }}
              >
                Rename
              </button>
            </div>
          ))}
        </div>
        {active && (
          <button
            style={{ marginTop: 20 }}
            onClick={() => {
              if (!window.confirm("Delete this conversation?")) return;
              void deleteConversation(active.id);
              setConversations((items) =>
                items.filter((item) => item.id !== active.id),
              );
              setActive(null);
              setSidebarOpen(false);
            }}
          >
            Delete conversation
          </button>
        )}
      </aside>
      <main className="chat-main">
        <div className="chat-top">
          <button
            className={styles.sidebarToggle}
            type="button"
            aria-expanded={sidebarOpen}
            aria-controls="conversation-sidebar"
            onClick={() => setSidebarOpen(true)}
          >
            Conversations
          </button>
          <div>
            <strong>{brand.products.chat}</strong>
            <div className="note">Protected workspace · local vault</div>
          </div>
          <div className="chat-controls" style={{ display: "flex", gap: 8 }}>
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
                onChange={(event) => {
                  setEffort(event.target.value);
                  void saveSetting("effort", event.target.value);
                }}
              >
                <option value="low">Quick</option>
                <option value="medium">Balanced</option>
                <option value="high">Deep</option>
              </select>
            )}
            <label className={styles.featureToggle}>
              <input
                type="checkbox"
                checked={webSearch}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  setWebSearch(enabled);
                  void saveSetting("webSearch", enabled);
                }}
              />
              Web search
            </label>
            {availableTools.length > 0 && (
              <label className={styles.featureToggle}>
                <input
                  type="checkbox"
                  checked={toolUse}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setToolUse(enabled);
                    void saveSetting("toolUse", enabled);
                  }}
                />
                Let Umbra use tools <span className="note">(experimental)</span>
              </label>
            )}
          </div>
        </div>
        {webSearch && (
          <p className={styles.featureNotice}>
            Your redacted prompt is sent to a search provider through
            OpenRouter.
          </p>
        )}
        <div className="messages" ref={messagesRef}>
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
                {message.error && (
                  <p className={styles.messageError} role="alert">
                    {message.error}
                  </p>
                )}
                {message.role === "assistant" && message.content && (
                  <button
                    className={styles.copyButton}
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(message.content);
                      setCopiedId(message.id);
                      window.setTimeout(() => setCopiedId(undefined), 1600);
                    }}
                  >
                    {copiedId === message.id ? "Copied" : "Copy"}
                  </button>
                )}
                {message.role === "assistant" && message.route && (
                  <div className="note">
                    routed to{" "}
                    {models.find((item) => item.id === message.route?.model)
                      ?.label ?? message.route.model}{" "}
                    — {message.route.reason}
                  </div>
                )}
                {message.role === "assistant" && message.citations?.length ? (
                  <div className={styles.citations}>
                    <div className="note">Sources</div>
                    <ol>
                      {message.citations.map((citation) => (
                        <li key={citation.url}>
                          <a
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {citation.title}{" "}
                            <span className="note">
                              ({citationHost(citation.url)})
                            </span>
                          </a>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                {message.role === "assistant" && message.toolCalls?.length ? (
                  <div className={styles.toolCalls}>
                    {message.toolCalls.map((toolCall, index) => (
                      <details key={`${toolCall.tool}-${index}`}>
                        <summary>{toolCall.tool}</summary>
                        <p className="note">
                          Arguments were sent un-redacted to the connector you
                          registered.
                        </p>
                        <div className="note">Arguments</div>
                        <pre>{JSON.stringify(toolCall.arguments, null, 2)}</pre>
                        <div className="note">Result</div>
                        <pre>{toolCall.result}</pre>
                      </details>
                    ))}
                  </div>
                ) : null}
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
                {message.role === "user" && (
                  <button
                    className={styles.rememberButton}
                    type="button"
                    onClick={() => void remember(message.content)}
                  >
                    Remember this
                  </button>
                )}
              </div>
            </div>
          ))}
          {!atLatest && (
            <button className={styles.jumpLatest} onClick={jumpToLatest}>
              Jump to latest
            </button>
          )}
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
            {busy ? (
              <button className="send" onClick={stop} type="button">
                Stop
              </button>
            ) : (
              <button
                className="send"
                onClick={() => void send()}
                disabled={!draft.trim() && !attachments.length}
              >
                Send
              </button>
            )}
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
