"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { brand } from "@/config/brand";
import { Vault, redact } from "@/lib/privacy";
import {
  getMediaHistory,
  saveMediaHistory,
  type MediaHistoryItem,
} from "@/lib/media-storage";
import styles from "./MediaGenerator.module.css";

type Kind = "image" | "video";

const id = () => Math.random().toString(36).slice(2);

export function MediaGenerator({ kind }: { kind: Kind }) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"smart" | "full" | "off">("smart");
  const [aspectRatio, setAspectRatio] = useState<
    "square" | "landscape" | "portrait"
  >("landscape");
  const [steps, setSteps] = useState(4);
  const [history, setHistory] = useState<MediaHistoryItem[]>([]);
  const [result, setResult] = useState<MediaHistoryItem>();
  const [stubMode, setStubMode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const videoAbortRef = useRef<AbortController | undefined>(undefined);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    void getMediaHistory(kind).then(setHistory);
    void fetch(`/api/${kind}`)
      .then((response) => response.json() as Promise<{ stub?: boolean }>)
      .then((body) => setStubMode(body.stub ?? true))
      .catch(() => setStubMode(true));
    return () => {
      mountedRef.current = false;
      videoAbortRef.current?.abort();
    };
  }, [kind]);
  const title = kind === "image" ? brand.products.image : brand.products.video;
  const generate = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError("");
    setProgress("");
    const vault = new Vault();
    const protectedPrompt = redact(prompt, vault, mode);
    try {
      let body: {
        url?: string;
        requestId?: string;
        stub?: boolean;
        model?: string;
        error?: string;
      };
      const controller = kind === "video" ? new AbortController() : undefined;
      if (controller) videoAbortRef.current = controller;
      const response = await fetch(`/api/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: protectedPrompt.text,
          aspectRatio,
          steps,
        }),
        signal: controller?.signal,
      });
      body = (await response.json()) as typeof body;
      if (!response.ok) throw new Error(body.error ?? "Generation failed");
      if (kind === "video") {
        if (!body.url) {
          if (!body.requestId) throw new Error("Video request was not queued");
          const startedAt = Date.now();
          let status: {
            state?: "queued" | "running" | "done" | "failed";
            url?: string;
            error?: string;
          } = {};
          while (Date.now() - startedAt <= 6 * 60 * 1000) {
            const statusResponse = await fetch(
              `/api/video?requestId=${encodeURIComponent(body.requestId)}`,
              { signal: controller?.signal },
            );
            status = (await statusResponse.json()) as typeof status;
            if (!statusResponse.ok)
              throw new Error(status.error ?? "Video generation failed");
            const elapsed = Math.floor((Date.now() - startedAt) / 1000);
            if (status.state === "done" && status.url) {
              body = { ...body, url: status.url };
              break;
            }
            if (status.state === "failed")
              throw new Error("Video generation failed");
            setProgress(`Rendering… ${elapsed}s (video takes ~2 minutes)`);
            await new Promise<void>((resolve, reject) => {
              const timer = window.setTimeout(resolve, 3000);
              controller?.signal.addEventListener(
                "abort",
                () => {
                  window.clearTimeout(timer);
                  reject(new DOMException("Aborted", "AbortError"));
                },
                { once: true },
              );
            });
          }
          if (!body.url) throw new Error("Video generation timed out");
        }
      }
      if (!response.ok || !body.url)
        throw new Error(body.error ?? "Generation failed");
      const item: MediaHistoryItem = {
        id: id(),
        kind,
        prompt,
        redacted: protectedPrompt.text,
        receipt: protectedPrompt.receipt,
        url: body.url,
        stub: body.stub ?? false,
        model: body.model ?? "unknown",
        createdAt: Date.now(),
      };
      setStubMode(item.stub);
      setResult(item);
      setHistory((items) => [item, ...items]);
      await saveMediaHistory(item);
    } catch (generationError) {
      if (
        !mountedRef.current &&
        generationError instanceof DOMException &&
        generationError.name === "AbortError"
      )
        return;
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Generation failed",
      );
    } finally {
      videoAbortRef.current = undefined;
      if (mountedRef.current) {
        setProgress("");
        setBusy(false);
      }
    }
  };
  return (
    <div className={styles.page}>
      <main className={`shell ${styles.content}`}>
        <div className="eyebrow">Private creation</div>
        <h1 style={{ marginLeft: 0, fontSize: "clamp(50px, 8vw, 88px)" }}>
          {title}
        </h1>
        <p className={styles.intro}>
          Your prompt is protected in this browser before the generation
          provider receives it.
        </p>
        {stubMode && (
          <div className={styles.banner}>
            Stub mode — add FAL_KEY to enable real generation.
          </div>
        )}
        {progress && <p className="note">{progress}</p>}
        <textarea
          className={styles.prompt}
          value={prompt}
          maxLength={10000}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={
            kind === "image"
              ? "Describe an image to create…"
              : "Describe a short scene to create…"
          }
        />
        <div className={styles.controls}>
          <select
            className={styles.control}
            value={aspectRatio}
            onChange={(event) =>
              setAspectRatio(event.target.value as typeof aspectRatio)
            }
            aria-label="Aspect ratio"
          >
            <option value="landscape">Landscape 16:9</option>
            <option value="square">Square</option>
            <option value="portrait">Portrait 9:16</option>
          </select>
          {kind === "image" && (
            <select
              className={styles.control}
              value={steps}
              onChange={(event) => setSteps(Number(event.target.value))}
              aria-label="Inference steps"
            >
              <option value={1}>1 step</option>
              <option value={2}>2 steps</option>
              <option value={4}>4 steps</option>
            </select>
          )}
          <select
            className={styles.control}
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
            aria-label="Privacy mode"
          >
            <option value="smart">Smart privacy</option>
            <option value="full">Full privacy</option>
            <option value="off">Privacy off</option>
          </select>
          <button
            className={`${styles.button} ${styles.primary}`}
            onClick={() => void generate()}
            disabled={busy}
          >
            {busy ? "Generating…" : `Generate ${kind}`}
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        {result && (
          <div className={styles.result}>
            <div className={`panel ${styles.preview}`}>
              {kind === "image" ? (
                <Image
                  src={result.url}
                  alt={result.prompt}
                  width={1024}
                  height={576}
                  unoptimized
                />
              ) : (
                <div>
                  {result.stub ? (
                    <>
                      <Image
                        src={result.url}
                        alt={result.prompt}
                        width={1024}
                        height={576}
                        unoptimized
                      />
                      <p className="note">
                        Stub frame — video generation is not active.
                      </p>
                    </>
                  ) : (
                    <video controls src={result.url} />
                  )}
                </div>
              )}
              <p className="note">
                {result.stub ? "Local stub result" : "Generated result"} ·{" "}
                {result.model}
              </p>
              <a
                className={`${styles.button} ${styles.primary}`}
                href={result.url}
                download={`umbra-${kind}`}
              >
                Download
              </a>
              <details style={{ marginTop: 18 }}>
                <summary className="note">
                  Privacy receipt · {result.receipt.count} protected
                </summary>
                <p className="note">
                  Provider saw: <code>{result.redacted}</code>
                </p>
              </details>
            </div>
            <aside className={`panel ${styles.history}`}>
              <div className="eyebrow">Local history</div>
              {!history.length && <p className="note">No generations yet.</p>}
              {history.slice(0, 8).map((item) => (
                <button
                  className={styles.historyItem}
                  key={item.id}
                  onClick={() => setResult(item)}
                >
                  <div className={styles.historyPrompt}>{item.prompt}</div>
                  <div className="note">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </aside>
          </div>
        )}
        <p className="note" style={{ marginTop: 35 }}>
          <Link href={brand.appPath}>Back to UmbraChat</Link>
        </p>
      </main>
    </div>
  );
}
