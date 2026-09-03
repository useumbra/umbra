"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { brand } from "@/config/brand";
import { chainNetworks } from "@/config/chain";
import {
  lockEmergencyWithdraw,
  lockStake,
  lockWithdraw,
  lockWithdrawAll,
  maxStakeForTier,
  quoteReward,
  readLockPool,
  readLockWallet,
  type LockPoolSnapshot,
  type LockTier,
  type LockWalletSnapshot,
} from "@/lib/lock-staking";
import { parseAmount } from "@/lib/funding";
import { approve, formatApr } from "@/lib/staking";
import {
  connectAddress,
  formatUnits,
  waitForReceipt,
  WalletError,
  type Eip1193Provider,
} from "@/lib/wallet";
import { useWallet } from "@/lib/use-wallet";
import { WalletPicker } from "./WalletPicker";
import styles from "./LockStakeClient.module.css";

const lockStaking = chainNetworks.mainnet.lockStaking;
const token = brand.token.address;
const fallbackTiers: LockTier[] = [
  { id: 0, durationSeconds: 30 * 86_400, aprBps: 4_000 },
  { id: 1, durationSeconds: 90 * 86_400, aprBps: 8_000 },
  { id: 2, durationSeconds: 180 * 86_400, aprBps: 15_000 },
];

type ActionName =
  | "connect"
  | "refresh"
  | "approve"
  | "stake"
  | "withdraw"
  | "emergency"
  | "withdrawAll";

const formatToken = (value: bigint) =>
  formatUnits(value, brand.token.decimals, 6);

const formatDuration = (seconds: number) =>
  `${Math.round(seconds / 86_400)} days`;

const formatUnlock = (timestamp: number) =>
  new Date(timestamp * 1000).toLocaleString();

const formatRemaining = (timestamp: number, now: number) => {
  const remaining = Math.max(0, timestamp - now);
  if (remaining === 0) return "Unlocked";
  const days = Math.floor(remaining / 86_400);
  const hours = Math.floor((remaining % 86_400) / 3_600);
  return `Unlocks in ${days}d ${hours}h`;
};

const formatTierRate = (tier: LockTier) => formatApr(BigInt(tier.aprBps));

export function LockStakeClient() {
  const [address, setAddress] = useState<string>();
  const [pool, setPool] = useState<LockPoolSnapshot>();
  const [wallet, setWallet] = useState<LockWalletSnapshot>();
  const [amount, setAmount] = useState("");
  const [selectedTierId, setSelectedTierId] = useState(0);
  const [busy, setBusy] = useState<ActionName>();
  const [error, setError] = useState("");
  const [confirmEmergencyId, setConfirmEmergencyId] = useState<bigint>();
  const { options, picking, run, choose, cancel } = useWallet();

  const tiers = pool?.tiers.length ? pool.tiers : fallbackTiers;
  const selectedTier =
    tiers.find((tier) => tier.id === selectedTierId) ?? tiers[0];
  const parsedAmount = (() => {
    try {
      return parseAmount(amount, brand.token.decimals);
    } catch {
      return undefined;
    }
  })();
  const now = Math.floor(Date.now() / 1000);

  const refreshPool = useCallback(async () => {
    if (!lockStaking) return undefined;
    const next = await readLockPool(lockStaking);
    setPool(next);
    return next;
  }, []);

  const refreshWallet = useCallback(async (walletAddress: string) => {
    if (!lockStaking) return undefined;
    const next = await readLockWallet(lockStaking, token, walletAddress);
    setWallet(next);
    return next;
  }, []);

  useEffect(() => {
    if (!lockStaking) return;
    void refreshPool().catch(() => undefined);
    const interval = window.setInterval(() => {
      if (busy) return;
      void refreshPool().catch(() => undefined);
      if (address) void refreshWallet(address).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [address, busy, refreshPool, refreshWallet]);

  const explorerUrl = lockStaking
    ? `${chainNetworks.mainnet.explorer}/address/${lockStaking}`
    : "";
  const unlockedPositions = useMemo(
    () =>
      wallet?.positions.filter(
        (position) => !position.closed && position.unlockAt <= now,
      ) ?? [],
    [now, wallet],
  );
  const sortedPositions = useMemo(
    () =>
      [...(wallet?.positions ?? [])].sort(
        (left, right) =>
          Number(left.closed) - Number(right.closed) ||
          Number(left.id - right.id),
      ),
    [wallet],
  );

  if (!lockStaking) {
    return (
      <main className={`shell ${styles.page}`}>
        <section className={styles.hero}>
          <div className="eyebrow">Fixed-term staking</div>
          <h1>
            Lock when
            <br />
            <span>$UMBRA is ready.</span>
          </h1>
          <p>
            The fixed-term lock contract is written and tested, but it has not
            been deployed yet. This page will activate when its address is
            supplied through <code>NEXT_PUBLIC_UMBRA_LOCK_STAKING</code>.
          </p>
          <a
            className={styles.primaryButton}
            href="https://github.com/useumbra/umbra/tree/main/contracts"
            target="_blank"
            rel="noreferrer"
          >
            Read the contract
          </a>
        </section>
      </main>
    );
  }

  const connect = async () => {
    setBusy("connect");
    setError("");
    try {
      const ran = await run(async (provider) => {
        const walletAddress = await connectAddress(provider);
        setAddress(walletAddress);
        await Promise.all([refreshPool(), refreshWallet(walletAddress)]);
      });
      if (!ran) setError("");
    } catch (caught) {
      setError(
        caught instanceof WalletError || caught instanceof Error
          ? caught.message
          : "Could not connect to the lock staking contract.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const write = async (
    name: Exclude<ActionName, "connect" | "refresh">,
    action: (
      provider: Eip1193Provider,
      walletAddress: string,
    ) => Promise<string>,
  ) => {
    setBusy(name);
    setError("");
    try {
      const ran = await run(async (provider) => {
        const walletAddress = address ?? (await connectAddress(provider));
        const hash = await action(provider, walletAddress);
        await waitForReceipt(hash);
        setAddress(walletAddress);
        await Promise.all([refreshPool(), refreshWallet(walletAddress)]);
      });
      if (!ran) setError("");
    } catch (caught) {
      let refreshed: LockWalletSnapshot | undefined;
      if (address) {
        try {
          [refreshed] = await Promise.all([
            refreshWallet(address),
            refreshPool(),
          ]);
        } catch {
          refreshed = undefined;
        }
      }
      if (
        name === "approve" &&
        refreshed &&
        parsedAmount !== undefined &&
        refreshed.allowance >= parsedAmount
      ) {
        setError("");
      } else {
        setError(
          caught instanceof WalletError || caught instanceof Error
            ? caught.message
            : "The lock staking transaction could not be completed.",
        );
      }
    } finally {
      setBusy(undefined);
    }
  };

  const manualRefresh = async () => {
    setBusy("refresh");
    setError("");
    try {
      await Promise.all([
        refreshPool(),
        address ? refreshWallet(address) : Promise.resolve(),
      ]);
    } catch {
      setError("");
    } finally {
      setBusy(undefined);
    }
  };

  const validateStake = () => {
    if (parsedAmount === undefined || parsedAmount === BigInt(0)) {
      setError("Enter a positive amount with up to 18 decimal places.");
      return undefined;
    }
    if (wallet && parsedAmount > wallet.walletBalance) {
      setError("Not enough $UMBRA");
      return undefined;
    }
    if (pool && selectedTier) {
      const reward = quoteReward(parsedAmount, selectedTier);
      if (reward > pool.availableRewards) {
        setError(
          "Pool cannot cover this stake right now — try a smaller amount or shorter term.",
        );
        return undefined;
      }
      if (reward === BigInt(0)) {
        setError("This amount is too small to earn a fixed-term reward.");
        return undefined;
      }
    }
    return parsedAmount;
  };

  return (
    <main className={`shell ${styles.page}`}>
      <section className={styles.hero}>
        <div className="eyebrow">Fixed-term staking</div>
        <h1>
          Stake $UMBRA <span>· fixed APY</span>
        </h1>
        <p>
          Lock your tokens for a defined term. The rate is fixed for the full
          term, paid at unlock, and reserved from the pool when you stake.
        </p>
        <div className={styles.address}>
          <span>Contract</span>
          <code>{lockStaking}</code>
          <a href={explorerUrl} target="_blank" rel="noreferrer">
            View on explorer
          </a>
        </div>
      </section>

      <section className={styles.tierSection}>
        <div className={styles.tierHeading}>
          <div>
            <div className="eyebrow">Choose a term</div>
            <h2>Fixed rates, paid at unlock.</h2>
          </div>
          <p>
            Fixed for the full term, paid at unlock. Rewards are reserved from
            the pool the moment you stake — the contract refuses stakes it
            cannot pay.
          </p>
        </div>
        <div className={styles.tiers}>
          {tiers.map((tier) => {
            const selected = tier.id === selectedTier?.id;
            const maximum =
              pool === undefined
                ? undefined
                : maxStakeForTier(pool.availableRewards, tier);
            return (
              <button
                className={`${styles.tier} ${selected ? styles.tierSelected : ""}`}
                key={tier.id}
                type="button"
                onClick={() => setSelectedTierId(tier.id)}
              >
                <span>{formatDuration(tier.durationSeconds)}</span>
                <strong>{formatTierRate(tier)} APY</strong>
                <small>
                  Max stake right now:{" "}
                  {maximum === undefined
                    ? "Reading…"
                    : `${formatToken(maximum)} $UMBRA`}
                </small>
              </button>
            );
          })}
        </div>
      </section>

      <section className={`panel ${styles.poolCard}`}>
        <div className={styles.poolStats}>
          <div>
            <span>Reward pool available</span>
            <strong>
              {pool
                ? `${formatToken(pool.availableRewards)} $UMBRA`
                : "Reading…"}
            </strong>
          </div>
          <div>
            <span>Total locked</span>
            <strong>
              {pool ? `${formatToken(pool.totalStaked)} $UMBRA` : "Reading…"}
            </strong>
          </div>
          <div>
            <span>Rewards reserved</span>
            <strong>
              {pool
                ? `${formatToken(pool.reservedRewards)} $UMBRA`
                : "Reading…"}
            </strong>
          </div>
        </div>
        {pool?.paused && (
          <p className={styles.paused}>
            New locks are paused. Withdrawals remain available.
          </p>
        )}
      </section>

      <section className={`panel ${styles.accountCard}`}>
        <div className="eyebrow">Your positions</div>
        <h2>{address ? "Lock $UMBRA" : "Connect a wallet"}</h2>
        {!address && (
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => void connect()}
            disabled={busy !== undefined}
          >
            {busy === "connect" ? "Connecting…" : "Connect wallet"}
          </button>
        )}
        {address && wallet && selectedTier && (
          <>
            <div className={styles.walletStats}>
              <div>
                <span>Wallet balance</span>
                <strong>{formatToken(wallet.walletBalance)} $UMBRA</strong>
              </div>
              <div>
                <span>Open positions</span>
                <strong>
                  {
                    wallet.positions.filter((position) => !position.closed)
                      .length
                  }
                </strong>
              </div>
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={busy !== undefined}
                onClick={() => void manualRefresh()}
              >
                {busy === "refresh" ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            <label className={styles.amountLabel} htmlFor="lock-amount">
              Amount in $UMBRA
            </label>
            <input
              id="lock-amount"
              className={styles.amount}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              aria-describedby="lock-amount-note"
            />
            <p id="lock-amount-note" className={styles.helper}>
              Choose a term above, then enter the amount to lock.
            </p>
            {parsedAmount !== undefined && parsedAmount > BigInt(0) && (
              <>
                <p className={styles.quote}>
                  You lock {formatToken(parsedAmount)} for{" "}
                  {formatDuration(selectedTier.durationSeconds)} → receive{" "}
                  {formatToken(
                    parsedAmount + quoteReward(parsedAmount, selectedTier),
                  )}{" "}
                  $UMBRA on {formatUnlock(now + selectedTier.durationSeconds)}
                </p>
                <div className={styles.actions}>
                  {wallet.allowance < parsedAmount ? (
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      disabled={busy !== undefined}
                      onClick={() => {
                        const value = validateStake();
                        if (value)
                          void write("approve", (provider, walletAddress) =>
                            approve(provider, {
                              from: walletAddress,
                              token,
                              spender: lockStaking,
                              amount: value,
                            }),
                          );
                      }}
                    >
                      {busy === "approve" ? "Approving…" : "Approve"}
                    </button>
                  ) : (
                    <button
                      className={styles.primaryButton}
                      type="button"
                      disabled={busy !== undefined || pool?.paused}
                      onClick={() => {
                        const value = validateStake();
                        if (value)
                          void write("stake", (provider, walletAddress) =>
                            lockStake(provider, {
                              from: walletAddress,
                              staking: lockStaking,
                              amount: value,
                              tier: selectedTier.id,
                            }),
                          );
                      }}
                    >
                      {busy === "stake" ? "Locking…" : "Stake"}
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
        {address && !wallet && (
          <p className={styles.note}>Reading your lock positions…</p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {picking && (
          <WalletPicker options={options} onChoose={choose} onCancel={cancel} />
        )}
      </section>

      {address && wallet && (
        <section className={styles.positionsSection}>
          <div className={styles.positionsHeading}>
            <div>
              <div className="eyebrow">Position history</div>
              <h2>Your locks</h2>
            </div>
            {unlockedPositions.length >= 2 && (
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={busy !== undefined}
                onClick={() =>
                  void write("withdrawAll", (provider, walletAddress) =>
                    lockWithdrawAll(provider, {
                      from: walletAddress,
                      staking: lockStaking,
                    }),
                  )
                }
              >
                {busy === "withdrawAll"
                  ? "Withdrawing…"
                  : "Withdraw all unlocked"}
              </button>
            )}
          </div>
          {sortedPositions.length === 0 ? (
            <p className={styles.note}>No lock positions yet.</p>
          ) : (
            <div className={styles.positions}>
              {sortedPositions.map((position) => {
                const tier = tiers.find((item) => item.id === position.tier);
                const unlocked = !position.closed && position.unlockAt <= now;
                return (
                  <article
                    className={styles.position}
                    key={position.id.toString()}
                  >
                    <div className={styles.positionTop}>
                      <strong>{formatToken(position.amount)} $UMBRA</strong>
                      <span className={position.closed ? "" : styles.open}>
                        {position.closed ? "Closed" : "Open"}
                      </span>
                    </div>
                    <div className={styles.positionGrid}>
                      <span>
                        Term
                        <strong>
                          {tier
                            ? formatDuration(tier.durationSeconds)
                            : "Unknown"}
                        </strong>
                      </span>
                      <span>
                        Reward
                        <strong>{formatToken(position.reward)} $UMBRA</strong>
                      </span>
                      <span>
                        Unlocks
                        <strong>{formatUnlock(position.unlockAt)}</strong>
                      </span>
                      <span>
                        Status
                        <strong>
                          {formatRemaining(position.unlockAt, now)}
                        </strong>
                      </span>
                    </div>
                    {!position.closed && (
                      <div className={styles.actions}>
                        <button
                          className={styles.primaryButton}
                          type="button"
                          disabled={busy !== undefined || !unlocked}
                          onClick={() =>
                            void write("withdraw", (provider, walletAddress) =>
                              lockWithdraw(provider, {
                                from: walletAddress,
                                staking: lockStaking,
                                id: position.id,
                              }),
                            )
                          }
                        >
                          {busy === "withdraw" ? "Withdrawing…" : "Withdraw"}
                        </button>
                        {confirmEmergencyId === position.id ? (
                          <>
                            <button
                              className={styles.dangerButton}
                              type="button"
                              disabled={busy !== undefined}
                              onClick={async () => {
                                await write(
                                  "emergency",
                                  (provider, walletAddress) =>
                                    lockEmergencyWithdraw(provider, {
                                      from: walletAddress,
                                      staking: lockStaking,
                                      id: position.id,
                                    }),
                                );
                                setConfirmEmergencyId(undefined);
                              }}
                            >
                              {busy === "emergency"
                                ? "Withdrawing…"
                                : "Confirm"}
                            </button>
                            <button
                              className={styles.secondaryButton}
                              type="button"
                              disabled={busy !== undefined}
                              onClick={() => setConfirmEmergencyId(undefined)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            className={styles.dangerButton}
                            type="button"
                            disabled={busy !== undefined}
                            onClick={() => setConfirmEmergencyId(position.id)}
                          >
                            Emergency withdraw
                          </button>
                        )}
                      </div>
                    )}
                    {!position.closed && (
                      <p className={styles.forfeit}>
                        Returns principal only — the reward is forfeited.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <p className={styles.footerNote}>
        Rewards are reserved from a pre-funded pool; nothing is minted. Review
        the <Link href="/docs">documentation</Link> and{" "}
        <a
          href="https://github.com/useumbra/umbra/tree/main/contracts"
          target="_blank"
          rel="noreferrer"
        >
          unaudited contract source
        </a>{" "}
        before depositing tokens. Looking for the flexible pool?{" "}
        <Link href="/stake/stream">→ /stake/stream</Link>
      </p>
    </main>
  );
}
