"use client";

import { useState } from "react";
import { brand } from "@/config/brand";
import {
  holderTiers,
  nextTier,
  readHolderStatus,
  type HolderStatus,
} from "@/lib/holder";
import { WalletError, type Eip1193Provider } from "@/lib/wallet";
import styles from "./HolderTier.module.css";

export function HolderTier() {
  const [status, setStatus] = useState<HolderStatus>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const checkTier = async () => {
    setBusy(true);
    setError("");
    const provider = (window as Window & { ethereum?: Eip1193Provider })
      .ethereum;
    try {
      setStatus(await readHolderStatus(provider, brand.token.address));
    } catch (caught) {
      if (caught instanceof WalletError) {
        setError(caught.message);
      } else {
        setError("Could not read your $UMBRA balance right now.");
      }
    } finally {
      setBusy(false);
    }
  };

  const reachedIndex = status
    ? holderTiers.findIndex((tier) => tier.id === status.tier.id)
    : -1;
  const upcoming = status ? nextTier(status.tier) : undefined;

  return (
    <section className={`panel ${styles.card}`}>
      <div className="eyebrow">Holder tier</div>
      <h2>$UMBRA tier</h2>
      <p className={styles.note}>
        Your balance is read live from Robinhood Chain through the public RPC.
        Nothing is sent to Umbra, no signature is requested, and no perk is
        active yet.
      </p>
      <button
        className={styles.button}
        type="button"
        onClick={() => void checkTier()}
        disabled={busy}
      >
        {busy ? "Reading balance…" : status ? "Refresh" : "Check my tier"}
      </button>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {status && (
        <div className={styles.result}>
          <div className={styles.summary}>
            <div>
              <span className={styles.label}>Address</span>
              <code>{status.address}</code>
            </div>
            <div>
              <span className={styles.label}>Balance</span>
              <strong>{status.balance} UMBRA</strong>
            </div>
            <div>
              <span className={styles.label}>Tier</span>
              <strong className={styles.tierBadge}>{status.tier.name}</strong>
            </div>
          </div>
          <div className={styles.perks}>
            <div className={styles.heading}>
              <h3>{status.tier.name} perks</h3>
              <span className={styles.planned}>Planned</span>
            </div>
            <ul>
              {status.tier.perks.map((perk) => (
                <li key={perk}>{perk}</li>
              ))}
            </ul>
          </div>
          {upcoming && (
            <p className={styles.next}>
              Next tier: {upcoming.name} at{" "}
              {upcoming.minTokens.toLocaleString()} $UMBRA.
            </p>
          )}
        </div>
      )}
      <div className={styles.ladder}>
        <div className={styles.heading}>
          <h3>Tier ladder</h3>
          <span className={styles.label}>Whole-token thresholds</span>
        </div>
        <div className={styles.tiers}>
          {holderTiers.map((tier) => {
            const reached =
              reachedIndex >= 0 &&
              holderTiers.findIndex((candidate) => candidate.id === tier.id) <=
                reachedIndex;
            return (
              <div
                className={`${styles.tier} ${reached ? styles.reached : ""}`}
                key={tier.id}
              >
                <strong>{tier.name}</strong>
                <span>{tier.minTokens.toLocaleString()} $UMBRA</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
