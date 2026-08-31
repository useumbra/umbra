"use client";

import { useEffect, useState } from "react";
import { brand } from "@/config/brand";
import {
  holderTiers,
  nextTier,
  readHolderStatus,
  type HolderStatus,
} from "@/lib/holder";
import {
  clearHolderProof,
  loadHolderProof,
  saveHolderProof,
  type StoredHolderProof,
} from "@/lib/holder-storage";
import { type HolderLimits } from "@/lib/holder-limits";
import { useWallet } from "@/lib/use-wallet";
import { WalletError } from "@/lib/wallet";
import { WalletPicker } from "./WalletPicker";
import styles from "./HolderTier.module.css";

const requestHolderLimits = async (
  proof: string,
): Promise<HolderLimits | undefined> => {
  try {
    const response = await fetch("/api/holder/limits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proof }),
    });
    const body = (await response.json().catch(() => undefined)) as
      { limits?: HolderLimits } | undefined;
    if (!response.ok || !body?.limits) return undefined;
    return body.limits;
  } catch {
    return undefined;
  }
};

export function HolderTier() {
  const [status, setStatus] = useState<HolderStatus>();
  const [proof, setProof] = useState<StoredHolderProof>();
  const [activeLimits, setActiveLimits] = useState<HolderLimits>();
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const { options, picking, run, choose, cancel } = useWallet();

  useEffect(() => {
    const stored = loadHolderProof();
    setProof(stored);
    if (stored) void requestHolderLimits(stored.proof).then(setActiveLimits);
  }, []);

  const checkTier = async () => {
    setBusy(true);
    setError("");
    try {
      await run(async (provider) => {
        setStatus(await readHolderStatus(provider, brand.token.address));
      });
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

  const verifyOwnership = async () => {
    if (!status) return;
    setVerifying(true);
    setError("");
    try {
      await run(async (provider) => {
        const challengeResponse = await fetch("/api/holder/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: status.address }),
        });
        const challenge = (await challengeResponse
          .json()
          .catch(() => undefined)) as
          | {
              message?: string;
              error?: { message?: string };
              nonce?: string;
              expiresAt?: number;
            }
          | undefined;
        if (
          !challengeResponse.ok ||
          !challenge?.message ||
          !challenge.nonce ||
          typeof challenge.expiresAt !== "number"
        )
          throw new Error(
            challenge?.error?.message ??
              "Could not verify ownership right now.",
          );
        const signature = await provider.request({
          method: "personal_sign",
          params: [challenge.message, status.address],
        });
        if (typeof signature !== "string")
          throw new Error("Could not verify ownership right now.");
        const verifyResponse = await fetch("/api/holder/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: status.address,
            nonce: challenge.nonce,
            expiresAt: challenge.expiresAt,
            signature,
          }),
        });
        const verified = (await verifyResponse
          .json()
          .catch(() => undefined)) as
          | {
              address?: string;
              tier?: string;
              balance?: string;
              proof?: string;
              expiresAt?: number;
              error?: { message?: string };
            }
          | undefined;
        if (
          !verifyResponse.ok ||
          typeof verified?.address !== "string" ||
          typeof verified.tier !== "string" ||
          typeof verified.balance !== "string" ||
          typeof verified.proof !== "string" ||
          typeof verified.expiresAt !== "number"
        )
          throw new Error(
            verified?.error?.message ?? "Could not verify ownership right now.",
          );
        const stored: StoredHolderProof = {
          address: verified.address,
          tier: verified.tier,
          balance: verified.balance,
          proof: verified.proof,
          expiresAt: verified.expiresAt,
        };
        saveHolderProof(stored);
        setProof(stored);
        setActiveLimits(await requestHolderLimits(stored.proof));
      });
    } catch (caught) {
      if (
        typeof caught === "object" &&
        caught !== null &&
        "code" in caught &&
        caught.code === 4001
      )
        setError("Signature request was rejected.");
      else if (caught instanceof WalletError) setError(caught.message);
      else
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not verify ownership right now.",
        );
    } finally {
      setVerifying(false);
    }
  };

  const forgetProof = () => {
    clearHolderProof();
    setProof(undefined);
  };

  const reachedIndex = status
    ? holderTiers.findIndex((tier) => tier.id === status.tier.id)
    : -1;
  const upcoming = status ? nextTier(status.tier) : undefined;
  const proofTierName =
    holderTiers.find((tier) => tier.id === proof?.tier)?.name ?? proof?.tier;

  return (
    <section className={`panel ${styles.card}`}>
      <div className="eyebrow">Holder tier</div>
      <h2>$UMBRA tier</h2>
      <p className={styles.note}>
        Reading your balance needs no signature and sends nothing to Umbra.
        Verifying ownership signs a message — no gas, no transaction — so your
        API keys get your tier&apos;s quota and your tier&apos;s enforced
        benefits. Holder-rate credits are enforced on on-chain top-ups; early
        access and votes remain planned.
      </p>
      <button
        className={styles.button}
        type="button"
        onClick={() => void checkTier()}
        disabled={busy}
      >
        {busy ? "Reading balance…" : status ? "Refresh" : "Check my tier"}
      </button>
      {status && (
        <button
          className={styles.verifyButton}
          type="button"
          onClick={() => void verifyOwnership()}
          disabled={verifying}
        >
          {verifying ? "Waiting for signature…" : "Verify ownership"}
        </button>
      )}
      <p className={styles.verificationNote}>
        Verification is signed proof, not a transaction. It enforces your
        tier&apos;s API quota, Council seats, chat and UmbraCode token ceilings,
        priority routing, and holder-rate credits on on-chain top-ups. Early
        access and votes remain planned.
      </p>
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
              <span className={styles.planned}>Partly live</span>
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
      {picking && (
        <WalletPicker options={options} onChoose={choose} onCancel={cancel} />
      )}
      {proof && (
        <div className={styles.verified}>
          <span>
            Verified as {proofTierName} · proof valid until{" "}
            {new Date(proof.expiresAt * 1000).toLocaleString()}
          </span>
          {activeLimits && (
            <span>
              Active limits: {activeLimits.councilSeats} Council seats ·{" "}
              {activeLimits.chatMaxTokens} max tokens ·{" "}
              {activeLimits.codeMaxTokens} in UmbraCode.
            </span>
          )}
          <button
            className={styles.forgetButton}
            type="button"
            onClick={forgetProof}
          >
            Forget proof
          </button>
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
