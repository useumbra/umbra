"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { brand } from "@/config/brand";
import { chainNetworks } from "@/config/chain";
import {
  approve,
  emergencyWithdraw,
  exit,
  getReward,
  annualRewardBps,
  aprToApy,
  formatApr,
  readStakingSnapshot,
  stake,
  withdraw,
  type StakingSnapshot,
} from "@/lib/staking";
import { parseAmount } from "@/lib/funding";
import {
  connectAddress,
  formatUnits,
  waitForReceipt,
  WalletError,
  type Eip1193Provider,
} from "@/lib/wallet";
import { useWallet } from "@/lib/use-wallet";
import { WalletPicker } from "./WalletPicker";
import styles from "./StakeClient.module.css";

const staking = chainNetworks.mainnet.staking;
const token = brand.token.address;

type ActionName =
  | "connect"
  | "refresh"
  | "approve"
  | "stake"
  | "withdraw"
  | "claim"
  | "exit"
  | "emergency";

const formatToken = (value: bigint) =>
  formatUnits(value, brand.token.decimals, 6);

export function StakeClient() {
  const [address, setAddress] = useState<string>();
  const [snapshot, setSnapshot] = useState<StakingSnapshot>();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<ActionName>();
  const [error, setError] = useState("");
  const [confirmEmergency, setConfirmEmergency] = useState(false);
  const { options, picking, run, choose, cancel } = useWallet();

  const parsedAmount = (() => {
    try {
      return parseAmount(amount, brand.token.decimals);
    } catch {
      return undefined;
    }
  })();

  const refresh = useCallback(async (walletAddress: string) => {
    if (!staking) return undefined;
    const next = await readStakingSnapshot(staking, token, walletAddress);
    setSnapshot(next);
    return next;
  }, []);

  useEffect(() => {
    if (!staking || !address) return;
    const interval = window.setInterval(() => {
      if (!busy) void refresh(address).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [address, busy, refresh]);

  if (!staking) {
    return (
      <main className={`shell ${styles.page}`}>
        <section className={styles.hero}>
          <div className="eyebrow">On-chain staking</div>
          <h1>
            Stake when
            <br />
            <span>$UMBRA is ready.</span>
          </h1>
          <p>
            The staking contract is written and tested, but it has not been
            deployed yet. This page will activate when its address is supplied
            through <code>NEXT_PUBLIC_UMBRA_STAKING</code>.
          </p>
          <a
            className={styles.linkButton}
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
        await refresh(walletAddress);
      });
      if (!ran) setError("");
    } catch (caught) {
      setError(
        caught instanceof WalletError || caught instanceof Error
          ? caught.message
          : "Could not connect to the staking contract.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const write = async (
    name: Exclude<ActionName, "connect">,
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
        await refresh(walletAddress);
      });
      if (!ran) setError("");
    } catch (caught) {
      let refreshed: StakingSnapshot | undefined;
      if (address) {
        try {
          refreshed = await refresh(address);
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
            : "The staking transaction could not be completed.",
        );
      }
    } finally {
      setBusy(undefined);
    }
  };

  const manualRefresh = async () => {
    if (!address) return;
    setBusy("refresh");
    setError("");
    try {
      await refresh(address);
    } catch {
      setError("");
    } finally {
      setBusy(undefined);
    }
  };

  const amountOrReportError = () => {
    if (parsedAmount) return parsedAmount;
    setError("Enter a positive amount with up to 18 decimal places.");
    return undefined;
  };

  const explorerUrl = `${chainNetworks.mainnet.explorer}/address/${staking}`;
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  const periodActive =
    snapshot !== undefined && snapshot.periodFinish > nowSeconds;
  const currentAprBps =
    snapshot &&
    annualRewardBps(
      snapshot.rewardRate,
      snapshot.totalStaked,
      snapshot.periodFinish,
      nowSeconds,
    );
  const currentApr =
    currentAprBps === undefined ? "—" : formatApr(currentAprBps);
  const currentApy =
    currentAprBps === undefined ? "—" : aprToApy(currentAprBps);
  const periodLabel =
    snapshot && periodActive
      ? `Streaming until ${new Date(Number(snapshot.periodFinish) * 1000).toLocaleString()}`
      : "No active reward period";

  return (
    <main className={`shell ${styles.page}`}>
      <section className={styles.hero}>
        <div className="eyebrow">On-chain staking</div>
        <h1>
          Put your $UMBRA
          <br />
          <span>to work.</span>
        </h1>
        <p>
          Stake $UMBRA and claim $UMBRA rewards funded by the owner from a
          treasury allocation. Nothing is minted, there is no APY promise, and
          the contract is unaudited.
        </p>
        <div className={styles.address}>
          <span>Contract</span>
          <code>{staking}</code>
          <a href={explorerUrl} target="_blank" rel="noreferrer">
            View on explorer
          </a>
        </div>
      </section>

      <section className={`panel ${styles.card}`}>
        <div className="eyebrow">Staking account</div>
        <h2>{address ? "Your position" : "Connect a wallet"}</h2>
        <p className={styles.note}>
          Reads use the public Robinhood Chain RPC. Transactions require your
          wallet&apos;s approval and pay network gas in ETH.
        </p>
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
        {address && snapshot && (
          <>
            <div className={styles.statsRow}>
              <div className={styles.stats}>
                <div>
                  <span>Wallet balance</span>
                  <strong>{formatToken(snapshot.walletBalance)} $UMBRA</strong>
                </div>
                <div>
                  <span>Your stake</span>
                  <strong>{formatToken(snapshot.staked)} $UMBRA</strong>
                </div>
                <div>
                  <span>Claimable rewards</span>
                  <strong>{formatToken(snapshot.earned)} $UMBRA</strong>
                </div>
                <div>
                  <span>Pool staked</span>
                  <strong>{formatToken(snapshot.totalStaked)} $UMBRA</strong>
                </div>
                <div>
                  <span>Current APR</span>
                  <strong>{currentApr}</strong>
                </div>
                <div>
                  <span>Est. APY</span>
                  <strong>{currentApy}</strong>
                </div>
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
            <div className={styles.period}>
              <span>Reward period</span>
              <strong>{periodLabel}</strong>
              {periodActive && (
                <small>
                  Rate: {formatToken(snapshot.rewardRate)} $UMBRA per second
                </small>
              )}
              {periodActive && snapshot.totalStaked === BigInt(0) && (
                <small>
                  No stake yet — the first staker earns the full stream.
                </small>
              )}
            </div>
            <p className={styles.statsNote}>
              APR is derived live from the on-chain reward rate and pool size;
              it changes with every stake and ends with the reward period.
            </p>
            <label className={styles.amountLabel} htmlFor="stake-amount">
              Amount in $UMBRA
            </label>
            <input
              id="stake-amount"
              className={styles.amount}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              aria-describedby="stake-amount-note"
            />
            <p id="stake-amount-note" className={styles.helper}>
              Amounts use 18 decimals. Approve once, then the Stake button
              appears when the allowance covers the amount.
            </p>
            <div className={styles.actions}>
              {parsedAmount && snapshot.allowance < parsedAmount && (
                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={busy !== undefined}
                  onClick={() => {
                    const value = amountOrReportError();
                    if (value)
                      void write("approve", (provider, walletAddress) =>
                        approve(provider, {
                          from: walletAddress,
                          token,
                          spender: staking,
                          amount: value,
                        }),
                      );
                  }}
                >
                  {busy === "approve" ? "Approving…" : "Approve"}
                </button>
              )}
              {parsedAmount && snapshot.allowance >= parsedAmount && (
                <button
                  className={styles.primaryButton}
                  type="button"
                  disabled={busy !== undefined}
                  onClick={() => {
                    const value = amountOrReportError();
                    if (value)
                      void write("stake", (provider, walletAddress) =>
                        stake(provider, {
                          from: walletAddress,
                          staking,
                          amount: value,
                        }),
                      );
                  }}
                >
                  {busy === "stake" ? "Staking…" : "Stake"}
                </button>
              )}
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={busy !== undefined}
                onClick={() => {
                  const value = amountOrReportError();
                  if (value)
                    void write("withdraw", (provider, walletAddress) =>
                      withdraw(provider, {
                        from: walletAddress,
                        staking,
                        amount: value,
                      }),
                    );
                }}
              >
                {busy === "withdraw" ? "Withdrawing…" : "Withdraw"}
              </button>
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={busy !== undefined}
                onClick={() =>
                  void write("claim", (provider, walletAddress) =>
                    getReward(provider, { from: walletAddress, staking }),
                  )
                }
              >
                {busy === "claim" ? "Claiming…" : "Claim rewards"}
              </button>
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={busy !== undefined}
                onClick={() =>
                  void write("exit", (provider, walletAddress) =>
                    exit(provider, { from: walletAddress, staking }),
                  )
                }
              >
                {busy === "exit" ? "Exiting…" : "Exit"}
              </button>
            </div>
            <div className={styles.emergency}>
              <p>
                Emergency withdrawal returns your principal but forfeits all
                unclaimed rewards.
              </p>
              {!confirmEmergency ? (
                <button
                  className={styles.dangerButton}
                  type="button"
                  disabled={busy !== undefined}
                  onClick={() => setConfirmEmergency(true)}
                >
                  Emergency withdraw
                </button>
              ) : (
                <div className={styles.confirm}>
                  <strong>Forfeit unclaimed rewards and withdraw?</strong>
                  <div className={styles.actions}>
                    <button
                      className={styles.dangerButton}
                      type="button"
                      disabled={busy !== undefined}
                      onClick={() => {
                        void write("emergency", (provider, walletAddress) =>
                          emergencyWithdraw(provider, {
                            from: walletAddress,
                            staking,
                          }),
                        ).then(() => setConfirmEmergency(false));
                      }}
                    >
                      {busy === "emergency" ? "Withdrawing…" : "Confirm"}
                    </button>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      disabled={busy !== undefined}
                      onClick={() => setConfirmEmergency(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        {address && !snapshot && (
          <p className={styles.note}>Reading your staking position…</p>
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

      <p className={styles.footerNote}>
        Rewards are paid from funds supplied by the contract owner. Review the{" "}
        <Link href="/docs">documentation</Link> and the{" "}
        <a
          href="https://github.com/useumbra/umbra/tree/main/contracts"
          target="_blank"
          rel="noreferrer"
        >
          unaudited source
        </a>{" "}
        before depositing tokens.
      </p>
    </main>
  );
}
