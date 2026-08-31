"use client";

import { useState } from "react";
import { brand } from "@/config/brand";
import styles from "./TokenBar.module.css";

const benefits = [
  {
    title: "Credits at a holder rate",
    description:
      "Convert $UMBRA into Umbra credits, which stay encrypted in your browser.",
  },
  {
    title: "Higher limits",
    description:
      "Longer UmbraCode sandbox runs and more Council seats per brief.",
  },
  {
    title: "Priority routing",
    description: "Holder requests move ahead in the queue on premium models.",
  },
  {
    title: "API quota",
    description:
      "A holder quota on the OpenAI-compatible endpoint, keys managed at /developers.",
  },
  {
    title: "Early access",
    description: "New surfaces open to holders before general release.",
  },
  {
    title: "A vote on the boundary",
    description:
      "Holders vote on which providers get added and which detectors ship next.",
  },
] as const;

export function TokenBar() {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(brand.token.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section id="token" className={`panel ${styles.card}`}>
      <div className="eyebrow">Token</div>
      <h2>{brand.token.ticker}</h2>
      <p className={styles.copy}>
        The contract is live on Robinhood Chain. Holder utility inside Umbra is
        not shipped yet.
      </p>
      <div className={styles.addressRow}>
        <code>{brand.token.address}</code>
        <div className={styles.actions}>
          <button
            className={styles.button}
            type="button"
            onClick={() => void copyAddress()}
          >
            {copied ? "Copied" : "Copy address"}
          </button>
          <a
            className={styles.link}
            href={`${brand.token.explorer}/token/${brand.token.address}`}
            target="_blank"
            rel="noreferrer"
          >
            View on explorer
          </a>
        </div>
      </div>
      <p className={styles.meta}>
        Supply {brand.token.supply} · {brand.token.decimals} decimals ·{" "}
        {brand.token.chain}
      </p>
      <div className={styles.benefits}>
        <div className={styles.benefitsHead}>
          <h3>Planned for holders</h3>
          <span className={styles.badge}>Not shipped yet</span>
        </div>
        <ul className={styles.list}>
          {benefits.map((benefit) => (
            <li key={benefit.title}>
              <strong>{benefit.title}</strong>
              <span>{benefit.description}</span>
            </li>
          ))}
        </ul>
        <p className={styles.note}>
          Your wallet proves the balance. Umbra never stores an account, an
          email, or who you are.
        </p>
      </div>
    </section>
  );
}
