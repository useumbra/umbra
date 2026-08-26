"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { brand } from "@/config/brand";
import { models } from "@/config/models";
import { Vault, redact } from "@/lib/privacy";
import {
  inlineCodeProject,
  parseCodeProject,
  projectFiles,
  type CodeProject,
} from "@/lib/code-project";
import { Header } from "./Header";
import styles from "./CodeGenerator.module.css";

const coder = models.find((model) => model.id === "qwen-coder") ?? models[0];
const instruction = `UMBRA_CODE_PROJECT
You generate one small, self-contained browser project from the user's request.
Return only three fenced code blocks with these exact filename hints:
\`\`\`html index.html
\`\`\`css styles.css
\`\`\`js script.js
The CSS and JS blocks may be omitted when unnecessary. Do not use external assets, network requests, or explanatory prose. Make the demo genuinely interactive.`;

export function CodeGenerator() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"smart" | "full" | "off">("smart");
  const [project, setProject] = useState<CodeProject>({
    files: {},
    warnings: [],
  });
  const [tab, setTab] = useState<(typeof projectFiles)[number] | "preview">(
    "preview",
  );
  const [preview, setPreview] = useState("");
  const [stubMode, setStubMode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] =
    useState<ReturnType<typeof redact>["receipt"]>();
  const [redacted, setRedacted] = useState("");
  const abortRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    void fetch("/api/code")
      .then((response) => response.json() as Promise<{ stub?: boolean }>)
      .then((body) => setStubMode(body.stub ?? true))
      .catch(() => setStubMode(true));
  }, []);

  const hasProject = Object.keys(project.files).length > 0;
  const activeCode = useMemo(
    () => (tab === "preview" ? "" : (project.files[tab] ?? "")),
    [project.files, tab],
  );

  const generate = async () => {
    if (!prompt.trim() || busy) return;
    const vault = new Vault();
    const protectedPrompt = redact(prompt, vault, mode);
    setBusy(true);
    setError("");
    setReceipt(protectedPrompt.receipt);
    setRedacted(protectedPrompt.text);
    setProject({ files: {}, warnings: [] });
    setPreview("");
    setTab("preview");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: coder.id,
          messages: [
            { role: "system", content: instruction },
            { role: "user", content: protectedPrompt.text },
          ],
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body)
        throw new Error("The code provider could not be reached.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      let pending = "";
      let done = false;
      const appendLine = (line: string, terminated: boolean) => {
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
        } else {
          raw += line + (terminated ? "\n" : "");
        }
        setProject(parseCodeProject(raw));
      };
      while (!done) {
        const result = await reader.read();
        done = result.done;
        pending += decoder.decode(result.value, { stream: !done });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        lines.forEach((line) => appendLine(line, true));
        if (done) appendLine(pending, false);
      }
      const finalProject = parseCodeProject(raw);
      setProject(finalProject);
      setPreview(inlineCodeProject(finalProject.files));
      setTab("preview");
    } catch (generationError) {
      setError(
        generationError instanceof DOMException &&
          generationError.name === "AbortError"
          ? "Generation stopped before completion."
          : generationError instanceof Error
            ? generationError.message
            : "Generation failed.",
      );
    } finally {
      setBusy(false);
      abortRef.current = undefined;
    }
  };

  const stop = () => abortRef.current?.abort();
  const runPreview = () => {
    if (hasProject) setPreview(inlineCodeProject(project.files));
  };
  const download = () => {
    if (!hasProject) return;
    const url = URL.createObjectURL(
      new Blob([inlineCodeProject(project.files)], { type: "text/html" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "umbra-code-project.html";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.page}>
      <Header />
      <main className={`shell ${styles.content}`}>
        <div className="eyebrow">Private building</div>
        <h1 style={{ marginLeft: 0, fontSize: "clamp(50px, 8vw, 88px)" }}>
          {brand.products.code}
        </h1>
        <p className={styles.intro}>
          Describe a small web app. Your request is redacted in this browser
          before the coder model sees it.
        </p>
        {stubMode && (
          <p className={styles.notice} role="status">
            Demo · stub — this credential-free demo returns a local working
            project. No server sandbox or deployment is involved; Preview runs
            in an isolated browser iframe.
          </p>
        )}
        <div className={styles.workspace}>
          <section className={`panel ${styles.panel}`}>
            <h2>Describe the build.</h2>
            <p className="note">
              Qwen Coder is selected directly for this request.
            </p>
            <textarea
              className={styles.prompt}
              value={prompt}
              maxLength={10000}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Make a tiny habit tracker with a streak counter…"
            />
            <div className={styles.controls}>
              <label className={styles.control}>
                Privacy{" "}
                <select
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value as typeof mode)
                  }
                  aria-label="Privacy mode"
                >
                  <option value="smart">Smart</option>
                  <option value="full">Full</option>
                  <option value="off">Off</option>
                </select>
              </label>
              {busy ? (
                <button className={styles.button} type="button" onClick={stop}>
                  Stop
                </button>
              ) : (
                <button
                  className={`${styles.button} ${styles.primary}`}
                  type="button"
                  onClick={() => void generate()}
                  disabled={!prompt.trim()}
                >
                  Generate project
                </button>
              )}
            </div>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            {receipt && (
              <details className={styles.receipt}>
                <summary className="note">
                  Privacy receipt · {receipt.count} protected
                </summary>
                <p className="note">
                  Provider saw: <code>{redacted}</code>
                </p>
                {receipt.entities.map((entity, index) => (
                  <div
                    className={styles.finding}
                    key={`${entity.type}-${index}`}
                  >
                    <span>{entity.type}</span>
                    <span>{entity.placeholder}</span>
                  </div>
                ))}
              </details>
            )}
          </section>
          <section className={`panel ${styles.panel} ${styles.output}`}>
            <div
              className={styles.tabs}
              role="tablist"
              aria-label="Project output"
            >
              <button
                className={`${styles.tab} ${
                  tab === "preview" ? styles.activeTab : ""
                }`}
                type="button"
                role="tab"
                aria-selected={tab === "preview"}
                onClick={() => setTab("preview")}
              >
                Preview
              </button>
              {projectFiles.map((filename) => (
                <button
                  className={`${styles.tab} ${
                    tab === filename ? styles.activeTab : ""
                  }`}
                  type="button"
                  role="tab"
                  aria-selected={tab === filename}
                  key={filename}
                  onClick={() => setTab(filename)}
                >
                  {filename}
                </button>
              ))}
            </div>
            {tab === "preview" ? (
              preview ? (
                <iframe
                  className={styles.preview}
                  title="UmbraCode browser preview"
                  sandbox="allow-scripts"
                  srcDoc={preview}
                />
              ) : (
                <div className={styles.code}>
                  Generate a project to preview it here.
                </div>
              )
            ) : (
              <pre className={styles.code}>
                {activeCode || `${tab} was not generated.`}
              </pre>
            )}
            {project.warnings.map((warning) => (
              <p className={styles.warning} key={warning}>
                {warning}
              </p>
            ))}
            <div className={styles.outputActions}>
              <button
                className={`${styles.button} ${styles.primary}`}
                type="button"
                onClick={runPreview}
                disabled={!hasProject}
              >
                Run preview
              </button>
              <button
                className={styles.button}
                type="button"
                onClick={download}
                disabled={!hasProject}
              >
                Download project
              </button>
            </div>
            <p className="note">
              Preview is an <code>allow-scripts</code>-only iframe with no
              origin, navigation, popup, or form permissions. The downloaded
              file is a single HTML file with CSS and JavaScript inlined.
            </p>
          </section>
        </div>
        <p className="note" style={{ marginTop: 35 }}>
          <Link href={brand.appPath}>Back to UmbraChat</Link>
        </p>
      </main>
    </div>
  );
}
