"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  deleteApiKey,
  getApiKeys,
  markApiKeyRevoked,
  saveApiKey,
  type ApiKeyRecord,
} from "@/lib/api-keys";
import styles from "./ApiKeysPanel.module.css";

type KeyResponse = {
  key: string;
  jti: string;
  label: string;
  createdAt: string;
  expiresAt: string;
};

const isKeyResponse = (value: unknown): value is KeyResponse =>
  typeof value === "object" &&
  value !== null &&
  "key" in value &&
  typeof value.key === "string" &&
  "jti" in value &&
  typeof value.jti === "string" &&
  "label" in value &&
  typeof value.label === "string" &&
  "createdAt" in value &&
  typeof value.createdAt === "string" &&
  "expiresAt" in value &&
  typeof value.expiresAt === "string";

const responseError = async (response: Response) => {
  const body: unknown = await response.json().catch(() => undefined);
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
  )
    return body.error.message;
  return `Request failed (${response.status})`;
};

const maskedKey = (key: string, revealed: boolean) =>
  revealed ? key : `${key.slice(0, 8)}${"•".repeat(18)}`;

const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });

export function ApiKeysPanel() {
  const [records, setRecords] = useState<ApiKeyRecord[]>([]);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState("90");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyJti, setBusyJti] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void getApiKeys()
      .then(setRecords)
      .catch(() => setError("Could not load local API keys."))
      .finally(() => setLoading(false));
  }, []);

  const createKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError(undefined);
    try {
      const response = await fetch("/api/agent/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(label ? { label } : {}),
          days: Number(days),
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const body: unknown = await response.json();
      if (!isKeyResponse(body)) throw new Error("Invalid key response");
      const record: ApiKeyRecord = { ...body, revoked: false };
      await saveApiKey(record);
      setRecords((current) => [record, ...current]);
      setLabel("");
      setRevealed((current) => new Set(current).add(record.jti));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create key.",
      );
    } finally {
      setCreating(false);
    }
  };

  const copyKey = async (record: ApiKeyRecord) => {
    try {
      await navigator.clipboard.writeText(record.key);
      setCopied(record.jti);
      window.setTimeout(() => setCopied(undefined), 1600);
    } catch {
      setError("Could not copy the key. Reveal it and copy it manually.");
    }
  };

  const revokeKey = async (record: ApiKeyRecord) => {
    if (record.revoked || !window.confirm(`Revoke “${record.label}”?`)) return;
    setBusyJti(record.jti);
    setError(undefined);
    try {
      const response = await fetch("/api/agent/v1/keys/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: record.key }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      await markApiKeyRevoked(record.jti);
      setRecords((current) =>
        current.map((item) =>
          item.jti === record.jti ? { ...item, revoked: true } : item,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not revoke key.",
      );
    } finally {
      setBusyJti(undefined);
    }
  };

  const removeKey = async (jti: string) => {
    setBusyJti(jti);
    setError(undefined);
    try {
      await deleteApiKey(jti);
      setRecords((current) => current.filter((item) => item.jti !== jti));
    } catch {
      setError("Could not delete the local key record.");
    } finally {
      setBusyJti(undefined);
    }
  };

  return (
    <div className={styles.panel}>
      <form className={styles.form} onSubmit={createKey}>
        <label className={styles.field}>
          Label
          <input
            className={styles.input}
            value={label}
            maxLength={64}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="developer"
          />
        </label>
        <label className={styles.field}>
          Expires in
          <select
            className={styles.select}
            value={days}
            onChange={(event) => setDays(event.target.value)}
          >
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="180">180 days</option>
            <option value="365">365 days</option>
          </select>
        </label>
        <button className={styles.button} type="submit" disabled={creating}>
          {creating ? "Creating…" : "Create key"}
        </button>
      </form>
      <p className="note">
        The full key is returned once and saved only in this browser. Clearing
        local data removes your saved copy.
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.list}>
        {loading ? (
          <p className="note">Loading local keys…</p>
        ) : records.length === 0 ? (
          <p className={styles.empty}>No API keys saved in this browser yet.</p>
        ) : (
          records.map((record) => {
            const isRevealed = revealed.has(record.jti);
            const busy = busyJti === record.jti;
            return (
              <div className={styles.row} key={record.jti}>
                <div>
                  <div
                    className={`${styles.label}${record.revoked ? ` ${styles.revoked}` : ""}`}
                  >
                    {record.label}
                  </div>
                  <div className={styles.key}>
                    {maskedKey(record.key, isRevealed)}
                  </div>
                  <div className={styles.meta}>
                    {record.revoked
                      ? "Revoked"
                      : `Expires ${dateLabel(record.expiresAt)}`}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button
                    className={styles.smallButton}
                    type="button"
                    onClick={() =>
                      setRevealed((current) => {
                        const next = new Set(current);
                        if (next.has(record.jti)) next.delete(record.jti);
                        else next.add(record.jti);
                        return next;
                      })
                    }
                  >
                    {isRevealed ? "Hide" : "Reveal"}
                  </button>
                  <button
                    className={styles.smallButton}
                    type="button"
                    onClick={() => void copyKey(record)}
                    disabled={busy}
                  >
                    {copied === record.jti ? "Copied" : "Copy"}
                  </button>
                  {!record.revoked && (
                    <button
                      className={`${styles.smallButton} ${styles.danger}`}
                      type="button"
                      onClick={() => void revokeKey(record)}
                      disabled={busy}
                    >
                      {busy ? "Revoking…" : "Revoke"}
                    </button>
                  )}
                  <button
                    className={styles.smallButton}
                    type="button"
                    onClick={() => void removeKey(record.jti)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
