"use client";

import { useEffect, useRef, useState } from "react";
import { models } from "@/config/models";
import { redact, restore, Vault } from "@/lib/privacy";
import { getSetting, saveSetting } from "@/lib/storage";
import { recordUsage, type UsageInput } from "@/lib/usage";
import type { ProviderMessage } from "@/lib/providers/types";
import styles from "./CouncilClient.module.css";

type SeatState = {
  content: string;
  busy: boolean;
  error?: string;
};

const initialSeats = ["umbra-auto", "nova-4", "sage-sonnet"];

const streamSeat = async (
  model: string,
  prompt: string,
  signal: AbortSignal,
  onUpdate: (content: string) => void,
) => {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt } satisfies ProviderMessage],
      temperature: 0.7,
    }),
    signal,
  });
  if (!response.ok) {
    if (response.status === 502) throw new Error("Provider unavailable");
    throw new Error(`Provider returned HTTP ${response.status}`);
  }
  if (!response.body) throw new Error("No response stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let content = "";
  let usage: UsageInput | undefined;
  const parseLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = line.startsWith("data: ") ? line.slice(6) : line.slice(5);
    if (payload === "[DONE]") return;
    try {
      const parsed = JSON.parse(payload) as {
        choices?: { delta?: { content?: unknown } }[];
        usage?: UsageInput;
      };
      if (parsed.usage) usage = parsed.usage;
      const delta = parsed.choices?.[0]?.delta?.content;
      if (typeof delta === "string") {
        content += delta;
        onUpdate(content);
      }
    } catch {
      // Ignore malformed provider protocol lines.
    }
  };
  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    pending += decoder.decode(result.value, { stream: !done });
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    lines.forEach(parseLine);
  }
  parseLine(pending);
  return { content, usage };
};

export function CouncilClient() {
  const [seats, setSeats] = useState(initialSeats);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"smart" | "full" | "off">("smart");
  const [receipt, setReceipt] =
    useState<ReturnType<typeof redact>["receipt"]>();
  const [protectedBrief, setProtectedBrief] = useState("");
  const [results, setResults] = useState<SeatState[]>(
    initialSeats.map(() => ({ content: "", busy: false })),
  );
  const [busy, setBusy] = useState(false);
  const controllers = useRef<Record<number, AbortController>>({});

  useEffect(() => {
    void getSetting("council-seats", initialSeats).then((saved) => {
      if (
        Array.isArray(saved) &&
        saved.length > 0 &&
        saved.length <= 3 &&
        saved.every((item): item is string =>
          models.some((model) => model.id === item),
        )
      )
        setSeats(saved);
    });
  }, []);

  const updateSeat = (index: number, model: string) => {
    setSeats((current) => {
      const next = [...current];
      next[index] = model;
      void saveSetting("council-seats", next);
      return next;
    });
  };

  const addSeat = () => {
    if (seats.length >= 3) return;
    const next = [...seats, models[1].id];
    setSeats(next);
    void saveSetting("council-seats", next);
  };

  const removeSeat = (index: number) => {
    if (seats.length <= 1) return;
    const next = seats.filter((_, itemIndex) => itemIndex !== index);
    setSeats(next);
    void saveSetting("council-seats", next);
  };

  const run = async () => {
    if (!prompt.trim() || busy) return;
    const vault = new Vault();
    const protectedPrompt = redact(prompt, vault, mode);
    setReceipt(protectedPrompt.receipt);
    setProtectedBrief(protectedPrompt.text);
    setResults(seats.map(() => ({ content: "", busy: true })));
    setBusy(true);
    await Promise.all(
      seats.map(async (model, index) => {
        const controller = new AbortController();
        controllers.current[index] = controller;
        try {
          const result = await streamSeat(
            model,
            protectedPrompt.text,
            controller.signal,
            (content) =>
              setResults((current) =>
                current.map((seat, seatIndex) =>
                  seatIndex === index
                    ? { ...seat, content: restore(content, vault) }
                    : seat,
                ),
              ),
          );
          if (result.usage) void recordUsage(model, result.usage);
          setResults((current) =>
            current.map((seat, seatIndex) =>
              seatIndex === index
                ? {
                    ...seat,
                    busy: false,
                    content: restore(result.content, vault),
                  }
                : seat,
            ),
          );
        } catch (error) {
          setResults((current) =>
            current.map((seat, seatIndex) =>
              seatIndex === index
                ? {
                    ...seat,
                    busy: false,
                    error:
                      error instanceof DOMException &&
                      error.name === "AbortError"
                        ? "Response stopped."
                        : error instanceof Error
                          ? error.message
                          : "Provider unavailable",
                  }
                : seat,
            ),
          );
        } finally {
          delete controllers.current[index];
        }
      }),
    );
    setBusy(false);
  };

  const stop = () =>
    Object.values(controllers.current).forEach((item) => item.abort());
  const stopSeat = (index: number) => controllers.current[index]?.abort();

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <div className="eyebrow">Parallel perspective</div>
        <h1 style={{ marginLeft: 0 }}>UmbraCouncil</h1>
        <p className={styles.intro}>
          Send one protected brief to up to three model seats and compare their
          answers side by side. Runs stay in memory on this device and are not
          saved as conversations.
        </p>
        <textarea
          className={styles.prompt}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="What should the council consider?"
          aria-label="Council prompt"
        />
        <div className={styles.controls}>
          {seats.map((seat, index) => (
            <label key={`${index}-${seat}`}>
              <span className="note">Seat {index + 1}</span>{" "}
              <select
                className={styles.seat}
                value={seat}
                onChange={(event) => updateSeat(index, event.target.value)}
                aria-label={`Council seat ${index + 1}`}
              >
                {models.map((model) => (
                  <option value={model.id} key={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
              {seats.length > 1 && (
                <button
                  className={styles.button}
                  type="button"
                  onClick={() => removeSeat(index)}
                  aria-label={`Remove seat ${index + 1}`}
                >
                  ×
                </button>
              )}
            </label>
          ))}
          {seats.length < 3 && (
            <button className={styles.button} type="button" onClick={addSeat}>
              Add seat
            </button>
          )}
          <label>
            <span className="note">Privacy</span>{" "}
            <select
              className={styles.seat}
              value={mode}
              onChange={(event) => setMode(event.target.value as typeof mode)}
              aria-label="Council privacy mode"
            >
              <option value="smart">Smart privacy</option>
              <option value="full">Full privacy</option>
              <option value="off">Privacy off</option>
            </select>
          </label>
          <button
            className={`${styles.button} ${styles.primary}`}
            type="button"
            disabled={busy || !prompt.trim()}
            onClick={() => void run()}
          >
            {busy ? "Running…" : "Run council"}
          </button>
          {busy && (
            <button className={styles.button} type="button" onClick={stop}>
              Stop
            </button>
          )}
        </div>
        {receipt && (
          <details className={styles.receipt}>
            <summary className="note">
              Privacy receipt · {receipt.count} protected
            </summary>
            <p className="note">
              Provider saw: <code>{protectedBrief}</code>
            </p>
            {receipt.entities.map((entity, index) => (
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
        <div className={styles.columns}>
          {seats.map((seat, index) => {
            const model = models.find((item) => item.id === seat) ?? models[0];
            const result = results[index] ?? { content: "", busy: false };
            return (
              <article
                className={`panel ${styles.column}`}
                key={`${index}-${seat}`}
              >
                <div className={styles.columnHeader}>
                  <strong>{model.label}</strong>
                  {result.busy ? (
                    <button
                      className={styles.button}
                      type="button"
                      onClick={() => stopSeat(index)}
                    >
                      Stop
                    </button>
                  ) : (
                    <span className="note">Complete</span>
                  )}
                </div>
                <div className={styles.answer}>
                  {result.error ? (
                    <span className={styles.error}>{result.error}</span>
                  ) : (
                    result.content || (
                      <span className="note">
                        {busy ? "Waiting for response…" : "No answer yet."}
                      </span>
                    )
                  )}
                </div>
                {result.content && !result.busy && (
                  <button
                    className={styles.button}
                    type="button"
                    onClick={() =>
                      void navigator.clipboard.writeText(result.content)
                    }
                  >
                    Copy answer
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
