"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { brand } from "@/config/brand";
import { models } from "@/config/models";
import { Vault, redact, restore } from "@/lib/privacy";
import {
  deleteConversation,
  getConversations,
  getSetting,
  saveConversation,
  saveSetting,
  type Conversation,
  type ChatMessage,
} from "@/lib/storage";
const id = () => Math.random().toString(36).slice(2);
export function ChatClient() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [mode, setMode] = useState<"smart" | "full" | "off">("smart");
  const [model, setModel] = useState(models[0].id);
  const [effort, setEffort] = useState("medium");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
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
    if (!draft.trim() || busy) return;
    const conversation = active ?? {
      id: id(),
      title: draft.slice(0, 32),
      messages: [],
      vault: new Vault().toJSON(),
    };
    const vault = Vault.fromJSON(conversation.vault);
    const protectedPrompt = redact(draft, vault, mode);
    const user: ChatMessage = {
      id: id(),
      role: "user",
      content: draft,
      redacted: protectedPrompt.text,
      receipt: protectedPrompt.receipt,
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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          effort,
          messages: next.messages.map((message) => ({
            role: message.role,
            content: message.redacted ?? message.content,
          })),
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
    } catch {
      assistant.content =
        "The provider could not be reached. Your draft stayed local.";
      setActive({ ...next, messages: [...next.messages, assistant] });
    } finally {
      setBusy(false);
    }
  };
  const activeMessages = useMemo(() => active?.messages ?? [], [active]);
  const selectedModel = models.find((item) => item.id === model) ?? models[0];
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
        <div style={{ marginTop: 25 }}>
          {conversations.map((conversation) => (
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
                    {message.receipt.entities.map((entity) => (
                      <div
                        className="finding"
                        key={`${entity.start}-${entity.type}`}
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
          </div>
        </div>
      </main>
    </div>
  );
}
