"use client";

import { useEffect, useRef, useState } from "react";
import {
  addGrant,
  balanceOf,
  decryptVault,
  deductCredits,
  encryptVault,
  exportVault,
  importVault,
  type CreditVaultData,
  type EncryptedVault,
} from "@/lib/credits/crypto";
import { loadEncryptedVault, saveEncryptedVault } from "@/lib/credits/storage";
import {
  connectAndReadBalances,
  getUsdgDecimals,
  sendUsdgTransfer,
  waitForReceipt,
  WalletError,
  type Eip1193Provider,
  type WalletBalances,
} from "@/lib/wallet";
import {
  creditsForUsdg,
  findTransferToTreasury,
  parseAmount,
} from "@/lib/funding";
import { chainNetworks } from "@/config/chain";
import styles from "./CreditsPanel.module.css";

const emptyVault: CreditVaultData = { ledger: [] };

export function CreditsPanel() {
  const [encrypted, setEncrypted] = useState<EncryptedVault>();
  const [vault, setVault] = useState<CreditVaultData>();
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState("");
  const [wallet, setWallet] = useState<WalletBalances>();
  const [walletMessage, setWalletMessage] = useState("");
  const [walletBusy, setWalletBusy] = useState(false);
  const [usdgDecimals, setUsdgDecimals] = useState<number>();
  const [usdgAmount, setUsdgAmount] = useState("");
  const [fundingBusy, setFundingBusy] = useState(false);
  const [fundingStatus, setFundingStatus] = useState("");
  const [fundingMessage, setFundingMessage] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [claimHash, setClaimHash] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void loadEncryptedVault().then(setEncrypted);
  }, []);

  const create = async () => {
    try {
      const next = await encryptVault(emptyVault, passphrase);
      await saveEncryptedVault(next);
      setEncrypted(next);
      setVault(emptyVault);
      setMessage("Local credits vault created and unlocked.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not create vault",
      );
    }
  };
  const unlock = async (candidate = encrypted) => {
    if (!candidate) {
      setMessage("Create or import a vault first.");
      return;
    }
    try {
      setVault(await decryptVault(candidate, passphrase));
      setMessage("Vault unlocked in this browser.");
    } catch {
      setMessage("That passphrase could not unlock this vault.");
    }
  };
  const update = async (next: CreditVaultData) => {
    const nextEncrypted = await encryptVault(next, passphrase);
    await saveEncryptedVault(nextEncrypted);
    setEncrypted(nextEncrypted);
    setVault(next);
  };
  const grant = async () => {
    if (!vault) return;
    try {
      await update(addGrant(vault, 100, "Developer test grant"));
      setMessage("Granted 100 local test credits.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Grant failed");
    }
  };
  const debit = async () => {
    if (!vault) return;
    try {
      await update(deductCredits(vault, 1, "Manual test deduction"));
      setMessage("Deducted 1 local test credit.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Deduction failed");
    }
  };
  const download = () => {
    if (!encrypted) return;
    const blob = new Blob([exportVault(encrypted)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "umbra-vault.umbra-vault";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const importFile = async (file: File) => {
    try {
      const next = importVault(await file.text());
      await saveEncryptedVault(next);
      setEncrypted(next);
      setVault(undefined);
      setMessage("Encrypted vault imported. Unlock it with its passphrase.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not import vault",
      );
    }
  };
  const balance = vault ? balanceOf(vault.ledger) : 0;
  const connectWallet = async () => {
    setWalletBusy(true);
    setWalletMessage("");
    const provider = (window as Window & { ethereum?: Eip1193Provider })
      .ethereum;
    try {
      setWallet(await connectAndReadBalances(provider));
      setWalletMessage(
        "Balances loaded. The address is ready for an on-chain USDG top-up.",
      );
    } catch (error) {
      if (error instanceof WalletError) {
        setWalletMessage(error.message);
      } else {
        setWalletMessage("Could not read wallet balances right now.");
      }
    } finally {
      setWalletBusy(false);
    }
  };
  useEffect(() => {
    if (!vault || !chainNetworks.mainnet.treasury) return;
    void getUsdgDecimals()
      .then(setUsdgDecimals)
      .catch((error: unknown) => {
        setFundingMessage(
          error instanceof Error
            ? error.message
            : "Could not read the USDG token decimals.",
        );
      });
  }, [vault]);
  const claimed = (hash: string) =>
    vault?.ledger.some((entry) =>
      entry.description.toLowerCase().includes(hash.toLowerCase()),
    ) ?? false;
  const parsedAmount = (() => {
    if (!usdgAmount || usdgDecimals === undefined) return undefined;
    try {
      return parseAmount(usdgAmount, usdgDecimals);
    } catch {
      return undefined;
    }
  })();
  const amountError =
    usdgAmount && usdgDecimals !== undefined && parsedAmount === undefined
      ? "Enter a positive USDG amount with no more decimal places than the token supports."
      : "";
  const explorerTransaction = (hash: string) =>
    `${chainNetworks.mainnet.explorer}/tx/${hash}`;
  const copyTreasury = async () => {
    if (!chainNetworks.mainnet.treasury) return;
    try {
      await navigator.clipboard.writeText(chainNetworks.mainnet.treasury);
      setFundingMessage("Treasury address copied.");
    } catch {
      setFundingMessage("Could not copy the treasury address.");
    }
  };
  const claimVerifiedTransfer = async (
    hash: string,
    receipt: unknown,
  ): Promise<boolean> => {
    if (!vault || !chainNetworks.mainnet.treasury) return false;
    if (claimed(hash)) {
      setFundingMessage("This transaction was already claimed.");
      setFundingStatus("Already claimed");
      return false;
    }
    setFundingStatus("Verifying transfer…");
    const amount = findTransferToTreasury(receipt, {
      token: chainNetworks.mainnet.usdG,
      treasury: chainNetworks.mainnet.treasury,
    });
    if (amount === undefined || amount <= BigInt(0)) {
      setFundingMessage(
        "This transaction did not contain a successful USDG transfer to the configured treasury.",
      );
      setFundingStatus("Could not verify");
      return false;
    }
    const decimals = usdgDecimals ?? (await getUsdgDecimals());
    const credits = creditsForUsdg(amount, decimals);
    await update(addGrant(vault, credits, `On-chain USDG top-up — ${hash}`));
    setFundingStatus("Credits added");
    setFundingMessage(
      `${credits} credits added from the verified USDG transfer.`,
    );
    return true;
  };
  const sendFunding = async () => {
    if (!vault || !chainNetworks.mainnet.treasury) return;
    setFundingBusy(true);
    setFundingMessage("");
    setTransactionHash("");
    try {
      if (usdgDecimals === undefined)
        throw new Error("USDG token decimals are still loading.");
      const amount = parseAmount(usdgAmount, usdgDecimals);
      setFundingStatus("Waiting for wallet…");
      const provider = (window as Window & { ethereum?: Eip1193Provider })
        .ethereum;
      const connected = wallet ?? (await connectAndReadBalances(provider));
      setWallet(connected);
      setFundingStatus("Waiting for transaction approval…");
      const hash = await sendUsdgTransfer(provider, {
        from: connected.address,
        to: chainNetworks.mainnet.treasury,
        amount,
      });
      setTransactionHash(hash);
      setFundingStatus("Waiting for confirmation…");
      const receipt = await waitForReceipt(hash);
      await claimVerifiedTransfer(hash, receipt);
    } catch (error) {
      setFundingStatus("Top-up failed");
      setFundingMessage(
        error instanceof WalletError || error instanceof Error
          ? error.message
          : "The USDG top-up could not be completed.",
      );
    } finally {
      setFundingBusy(false);
    }
  };
  const claimFunding = async () => {
    if (!vault || !chainNetworks.mainnet.treasury) return;
    const hash = claimHash.trim();
    setFundingBusy(true);
    setFundingMessage("");
    setTransactionHash(hash);
    try {
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash))
        throw new Error("Enter a valid transaction hash.");
      if (claimed(hash)) {
        setFundingStatus("Already claimed");
        setFundingMessage("This transaction was already claimed.");
        return;
      }
      setFundingStatus("Waiting for confirmation…");
      const receipt = await waitForReceipt(hash);
      await claimVerifiedTransfer(hash, receipt);
    } catch (error) {
      setFundingStatus("Claim failed");
      setFundingMessage(
        error instanceof WalletError || error instanceof Error
          ? error.message
          : "The transaction could not be verified.",
      );
    } finally {
      setFundingBusy(false);
    }
  };
  return (
    <div className={styles.page}>
      <main className={`shell ${styles.content}`}>
        <div className="eyebrow">Browser-only credits</div>
        <h1 style={{ marginLeft: 0, fontSize: "clamp(50px, 8vw, 88px)" }}>
          Your local balance.
        </h1>
        <p className={styles.intro}>
          This is an encrypted balance held only in this browser. Sending USDG
          transfers real funds to the configured treasury; clearing local data
          or losing your recovery file loses the displayed balance. There are no
          refunds or server-held accounts.
        </p>
        <section className={`panel ${styles.card}`}>
          <div className="eyebrow">Read-only wallet view</div>
          <h2>{wallet ? "Robinhood Chain balances" : "Connect wallet"}</h2>
          <p className="note">
            This only reads the connected address through the public Robinhood
            Chain RPC. No transaction, approval, signing, or credit funding is
            performed.
          </p>
          <button
            className={`${styles.button} ${styles.primary}`}
            onClick={() => void connectWallet()}
            disabled={walletBusy}
          >
            {walletBusy
              ? "Reading balances…"
              : wallet
                ? "Refresh balances"
                : "Connect wallet"}
          </button>
          {!wallet && !walletMessage && (
            <p className="note">
              A compatible injected wallet is required. The address is not
              stored in the encrypted credits vault.
            </p>
          )}
          {wallet && (
            <div className={styles.walletBalances}>
              <div>
                <span className="note">Address</span>
                <code>{wallet.address}</code>
              </div>
              <div>
                <span className="note">ETH</span>
                <strong>{wallet.eth}</strong>
              </div>
              <div>
                <span className="note">USDG</span>
                <strong>{wallet.usdg}</strong>
              </div>
            </div>
          )}
          {walletMessage && <p role="status">{walletMessage}</p>}
        </section>
        <section className={`panel ${styles.card}`}>
          <h2>{vault ? `${balance.toFixed(2)} credits` : "Vault locked"}</h2>
          <p className="note">
            The vault uses PBKDF2 and AES-GCM through WebCrypto. Umbra never
            receives your passphrase or this ledger.
          </p>
          <label>
            Passphrase
            <input
              className={styles.input}
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Choose a local passphrase"
            />
          </label>
          {!encrypted && (
            <button
              className={`${styles.button} ${styles.primary}`}
              onClick={() => void create()}
            >
              Create vault
            </button>
          )}
          {encrypted && !vault && (
            <button
              className={`${styles.button} ${styles.primary}`}
              onClick={() => void unlock()}
            >
              Unlock vault
            </button>
          )}
          {vault && process.env.NODE_ENV !== "production" && (
            <>
              <button
                className={`${styles.button} ${styles.primary}`}
                onClick={() => void grant()}
              >
                Grant test credits
              </button>
              <button className={styles.button} onClick={() => void debit()}>
                Deduct 1 credit
              </button>
            </>
          )}
          <button
            className={styles.button}
            onClick={download}
            disabled={!encrypted}
          >
            Export encrypted recovery file
          </button>
          <button
            className={styles.button}
            onClick={() => fileInput.current?.click()}
          >
            Import recovery file
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".umbra-vault,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
            }}
          />
          {message && <p role="status">{message}</p>}
        </section>
        <section className={`panel ${styles.card}`}>
          <div className="eyebrow">On-chain funding</div>
          <h2>Add credits on-chain</h2>
          {!chainNetworks.mainnet.treasury ? (
            <p className="note">On-chain top-up isn’t configured yet.</p>
          ) : !vault ? (
            <p className="note">
              Unlock the encrypted credits vault before adding credits.
            </p>
          ) : (
            <>
              <p className="note">
                USDG sent here becomes local credits after the confirmed
                transfer is verified. The ledger never leaves this browser.
              </p>
              <div className={styles.treasury}>
                <span className="note">Treasury</span>
                <code>{chainNetworks.mainnet.treasury}</code>
                <div>
                  <button
                    className={styles.button}
                    onClick={() => void copyTreasury()}
                  >
                    Copy address
                  </button>
                  <a
                    className={styles.link}
                    href={`${chainNetworks.mainnet.explorer}/address/${chainNetworks.mainnet.treasury}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on explorer
                  </a>
                </div>
              </div>
              <label>
                USDG amount
                <input
                  className={styles.input}
                  inputMode="decimal"
                  value={usdgAmount}
                  onChange={(event) => setUsdgAmount(event.target.value)}
                  placeholder={
                    usdgDecimals === undefined ? "Loading decimals…" : "0.00"
                  }
                  disabled={fundingBusy || usdgDecimals === undefined}
                />
              </label>
              <p className="note">
                Credits after verification:{" "}
                {parsedAmount !== undefined && usdgDecimals !== undefined
                  ? creditsForUsdg(parsedAmount, usdgDecimals)
                  : "—"}
              </p>
              {amountError && <p role="alert">{amountError}</p>}
              <button
                className={`${styles.button} ${styles.primary}`}
                onClick={() => void sendFunding()}
                disabled={fundingBusy || parsedAmount === undefined}
              >
                {fundingBusy ? "Processing…" : "Send USDG"}
              </button>
              <div className={styles.claim}>
                <strong>Already sent? Paste the transaction hash</strong>
                <input
                  className={styles.input}
                  value={claimHash}
                  onChange={(event) => setClaimHash(event.target.value)}
                  placeholder="0x…"
                  disabled={fundingBusy}
                />
                <button
                  className={styles.button}
                  onClick={() => void claimFunding()}
                  disabled={fundingBusy || !claimHash.trim()}
                >
                  Verify and claim
                </button>
              </div>
              {fundingStatus && <p role="status">{fundingStatus}</p>}
              {transactionHash && (
                <p className="note">
                  Transaction:{" "}
                  <a
                    className={styles.link}
                    href={explorerTransaction(transactionHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {transactionHash}
                  </a>
                </p>
              )}
              {fundingMessage && <p role="alert">{fundingMessage}</p>}
            </>
          )}
        </section>
        {vault && (
          <section className={`panel ${styles.card}`}>
            <div className="eyebrow">Transaction ledger</div>
            <div className={styles.ledger}>
              {vault.ledger.length === 0 && (
                <p className="note">No transactions yet.</p>
              )}
              {[...vault.ledger].reverse().map((entry) => (
                <div className={styles.entry} key={entry.id}>
                  <span>
                    {entry.description}
                    <br />
                    <span className="note">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </span>
                  <strong
                    className={entry.kind === "debit" ? styles.danger : ""}
                  >
                    {entry.kind === "debit" ? "-" : "+"}
                    {entry.amount.toFixed(2)}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
