"use client";

import { useState } from "react";
import { brand } from "@/config/brand";
import styles from "./TokenBar.module.css";

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
    </section>
  );
}
