"use client";

import { useMemo, useState } from "react";
import type { ModelConfig } from "@/config/models";
import styles from "./ModelsClient.module.css";

type Capability = keyof ModelConfig["capabilities"];
const capabilityLabels: { key: Capability; label: string }[] = [
  { key: "streaming", label: "Streaming" },
  { key: "vision", label: "Vision" },
  { key: "files", label: "Files" },
  { key: "tools", label: "Tools" },
  { key: "webSearch", label: "Web search" },
  { key: "reasoning", label: "Reasoning" },
];

export function ModelsClient({ models: catalog }: { models: ModelConfig[] }) {
  const [query, setQuery] = useState("");
  const [capability, setCapability] = useState<Capability>();
  const [sort, setSort] = useState<"context" | "price">("context");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...catalog]
      .filter(
        (model) =>
          !normalized ||
          `${model.label} ${model.description} ${model.id}`
            .toLowerCase()
            .includes(normalized),
      )
      .filter((model) => !capability || model.capabilities[capability])
      .sort((a, b) =>
        sort === "context"
          ? b.contextWindow - a.contextWindow
          : a.creditPricing.inPer1M - b.creditPricing.inPer1M,
      );
  }, [capability, catalog, query, sort]);

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <div className="eyebrow">Model catalog</div>
        <h1 style={{ marginLeft: 0 }}>Models</h1>
        <p className={styles.intro}>
          The models Umbra can route to, with provider list prices and the
          capabilities declared in the local catalog.
        </p>
        <div className={styles.toolbar}>
          <input
            className={styles.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search models"
            aria-label="Search models"
          />
          {capabilityLabels.map((item) => (
            <button
              className={`${styles.chip} ${
                capability === item.key ? styles.active : ""
              }`}
              type="button"
              key={item.key}
              onClick={() =>
                setCapability((value) =>
                  value === item.key ? undefined : item.key,
                )
              }
            >
              {item.label}
            </button>
          ))}
          <label className="note">
            Sort{" "}
            <select
              className={styles.sort}
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              aria-label="Sort models"
            >
              <option value="context">Context window</option>
              <option value="price">Input price</option>
            </select>
          </label>
        </div>
        {filtered.length ? (
          <div className={styles.grid}>
            {filtered.map((model) => (
              <article className={`panel ${styles.card}`} key={model.id}>
                <div className={styles.cardHeader}>
                  <strong>{model.label}</strong>
                  <span className="note">{model.id}</span>
                </div>
                <p className={styles.description}>{model.description}</p>
                <dl className={styles.specs}>
                  <div>
                    <dt>Context</dt>
                    <dd>{model.contextWindow.toLocaleString()} tokens</dd>
                  </div>
                  <div>
                    <dt>Provider list price</dt>
                    <dd>
                      ${model.creditPricing.inPer1M} in / $
                      {model.creditPricing.outPer1M} out per 1M
                    </dd>
                  </div>
                  <div>
                    <dt>Upstream</dt>
                    <dd>{model.upstreamSlug}</dd>
                  </div>
                  <div>
                    <dt>Served by</dt>
                    <dd>
                      {model.provider === "venice" ? "Venice" : "OpenRouter"}
                    </dd>
                  </div>
                </dl>
                <div className={styles.badges}>
                  {capabilityLabels
                    .filter((item) => model.capabilities[item.key])
                    .map((item) => (
                      <span className={styles.badge} key={item.key}>
                        {item.label}
                      </span>
                    ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={`panel ${styles.empty}`}>
            <strong>No models match those filters.</strong>
            <p className="note">Try a different search or capability.</p>
          </div>
        )}
      </div>
    </main>
  );
}
