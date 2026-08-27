"use client";

import { useEffect, useRef, useState } from "react";
import { brand } from "@/config/brand";
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
  WalletError,
  type Eip1193Provider,
  type WalletBalances,
} from "@/lib/wallet";
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
        "Read-only balances loaded. Connecting a wallet does not fund credits; your local balance remains a local test balance.",
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
  return (
    <div className={styles.page}>
      <main className={`shell ${styles.content}`}>
        <div className="eyebrow">Browser-only credits</div>
        <h1 style={{ marginLeft: 0, fontSize: "clamp(50px, 8vw, 88px)" }}>
          Your local balance.
        </h1>
        <p className={styles.intro}>
          {`This is an encrypted local test balance. On-chain funding with USDG or ${brand.token} is not connected yet.`}
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
