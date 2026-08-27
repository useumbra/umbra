"use client";

import { useEffect, useMemo, useState } from "react";
import { models } from "@/config/models";
import { aggregateUsage, getUsage, type UsageRecord } from "@/lib/usage";
import styles from "./UsageClient.module.css";

type Range = "7d" | "30d" | "all";

const formatNumber = (value: number) => value.toLocaleString();
const formatCost = (value: number) =>
  `$${value.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;

export function UsageClient() {
  const [range, setRange] = useState<Range>("7d");
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getUsage()
      .then(setRecords)
      .finally(() => setLoaded(true));
  }, []);

  const usage = useMemo(() => aggregateUsage(records, range), [records, range]);
  const maxTokens = Math.max(
    1,
    ...usage.daily.map((item) => item.inputTokens + item.outputTokens),
  );
  const totalTokens = usage.totals.totalTokens;

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <div className="eyebrow">Local accounting</div>
        <h1 style={{ marginLeft: 0 }}>Usage</h1>
        <p className={styles.intro}>
          Usage is read from provider-reported token counts and cost, then
          stored only in this browser. Prompts and responses are never stored
          here.
        </p>
        <div className={styles.toolbar}>
          <label className="note">
            Range{" "}
            <select
              className={styles.range}
              value={range}
              onChange={(event) => setRange(event.target.value as Range)}
              aria-label="Usage range"
            >
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="all">All time</option>
            </select>
          </label>
          <button
            className={styles.clear}
            type="button"
            disabled={!records.length}
            onClick={() => {
              if (!window.confirm("Clear usage data from this browser?"))
                return;
              void import("@/lib/usage").then(({ clearUsage }) =>
                clearUsage().then(() => setRecords([])),
              );
            }}
          >
            Clear usage data
          </button>
        </div>
        {!loaded ? (
          <p className="note">Loading local usage…</p>
        ) : !usage.records.length ? (
          <div className={`panel ${styles.empty}`}>
            <strong>No local usage recorded yet.</strong>
            <p className="note">
              Run a provider-backed chat request to see reported usage here.
            </p>
          </div>
        ) : (
          <>
            <div className={styles.summary}>
              {[
                ["Requests", formatNumber(usage.totals.requests)],
                ["Input tokens", formatNumber(usage.totals.inputTokens)],
                ["Output tokens", formatNumber(usage.totals.outputTokens)],
                ["Total tokens", formatNumber(totalTokens)],
                ["Reported cost", formatCost(usage.totals.cost)],
              ].map(([label, value]) => (
                <div className={`panel ${styles.metric}`} key={label}>
                  <span className={styles.metricLabel}>{label}</span>
                  <strong className={styles.metricValue}>{value}</strong>
                </div>
              ))}
            </div>
            <section className={`panel ${styles.chartPanel}`}>
              <strong>Daily tokens</strong>
              <svg
                className={styles.chart}
                viewBox="0 0 700 190"
                role="img"
                aria-label="Stacked daily input and output token chart"
              >
                <line x1="10" y1="165" x2="690" y2="165" stroke="var(--line)" />
                {usage.daily.map((item, index) => {
                  const width = Math.max(
                    8,
                    Math.min(44, 620 / Math.max(usage.daily.length, 1)),
                  );
                  const x =
                    35 + index * (630 / Math.max(usage.daily.length - 1, 1));
                  const inputHeight = (item.inputTokens / maxTokens) * 140;
                  const outputHeight = (item.outputTokens / maxTokens) * 140;
                  return (
                    <g key={item.date}>
                      <rect
                        x={x - width / 2}
                        y={165 - inputHeight}
                        width={width}
                        height={inputHeight}
                        fill="var(--accent)"
                        rx="2"
                      />
                      <rect
                        x={x - width / 2}
                        y={165 - inputHeight - outputHeight}
                        width={width}
                        height={outputHeight}
                        fill="var(--halo-cool)"
                        rx="2"
                      />
                      <text x={x} y="181" textAnchor="middle">
                        {item.date.slice(5)}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <p className="note">Green input · blue output</p>
            </section>
            <section className={`panel ${styles.tablePanel}`}>
              <strong>By model</strong>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Requests</th>
                    <th>Total tokens</th>
                    <th>Cost</th>
                    <th>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.byModel.map((item) => {
                    const model = models.find(
                      (candidate) => candidate.id === item.modelId,
                    );
                    const tokens = item.inputTokens + item.outputTokens;
                    return (
                      <tr key={item.modelId}>
                        <td>{model?.label ?? item.modelId}</td>
                        <td>{formatNumber(item.requests)}</td>
                        <td>{formatNumber(tokens)}</td>
                        <td>{formatCost(item.cost)}</td>
                        <td>
                          {totalTokens
                            ? `${((tokens / totalTokens) * 100).toFixed(1)}%`
                            : "0.0%"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
