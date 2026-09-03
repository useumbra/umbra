"use client";

import { useState } from "react";
import { brand } from "@/config/brand";
import styles from "./TokenBar.module.css";

const benefits = [
  {
    title: "Credits at a holder rate",
    description:
      "Verified holders get 5%, 10%, or 20% extra credits on a USDG top-up sent from the verified wallet.",
    status: "live",
  },
  {
    title: "Higher limits",
    description:
      "A signed proof raises Council seats to 5 and the max-token ceiling in chat and UmbraCode.",
    status: "live",
  },
  {
    title: "Priority routing",
    description:
      "Congested premium models are retried for holders, and Circle and Council auto-route to a stronger model.",
    status: "live",
  },
  {
    title: "API quota",
    description:
      "A holder quota on the OpenAI-compatible endpoint, keys managed at /developers.",
    status: "live",
  },
  {
    title: "Early access",
    description:
      "New surfaces open to verified holders first; the first is the roadmap vote.",
    status: "live",
  },
  {
    title: "A vote on the boundary",
    description:
      "Advisory votes are weighted by tier (Holder 1×, Circle 3×, Council 10×), with one wallet vote per poll.",
    status: "live",
  },
  {
    title: "On-chain staking",
    description:
      "Stake $UMBRA on Robinhood Chain and claim treasury-funded $UMBRA rewards — nothing minted, no APY promise, unaudited contract.",
    status: "live",
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
        The token contract is live on Robinhood Chain, and all seven holder
        benefits are live today.
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
          <h3>Holder benefits</h3>
          <span className={styles.badge}>
            {benefits.filter((benefit) => benefit.status === "live").length} of{" "}
            {benefits.length} live
          </span>
        </div>
        <ul className={styles.list}>
          {benefits.map((benefit) => (
            <li key={benefit.title}>
              <div className={styles.benefitTop}>
                <strong>{benefit.title}</strong>
                <span
                  className={`${styles.status} ${
                    benefit.status === "live" ? styles.statusLive : ""
                  }`}
                >
                  {benefit.status === "live" ? "Live" : "Planned"}
                </span>
              </div>
              <span>{benefit.description}</span>
            </li>
          ))}
        </ul>
        <p className={styles.note}>
          Check which tier your wallet is in at /credits — the balance is read
          on-chain, nothing is stored. Your wallet proves the balance; Umbra
          never stores an account, an email, or who you are.
        </p>
      </div>
    </section>
  );
}
