"use client";

import type { WalletOption } from "@/lib/wallet-session";
import styles from "./WalletPicker.module.css";

export function WalletPicker({
  options,
  onChoose,
  onCancel,
}: {
  options: WalletOption[];
  onChoose: (id: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className={styles.picker} role="dialog" aria-label="Choose a wallet">
      <strong>Choose a wallet</strong>
      <div className={styles.options}>
        {options.map((option) => (
          <button
            className={styles.option}
            key={option.id}
            type="button"
            onClick={() => onChoose(option.id)}
          >
            {option.icon && (
              <span
                className={styles.icon}
                aria-hidden="true"
                style={{
                  backgroundImage: `url(${JSON.stringify(option.icon)})`,
                }}
              />
            )}
            <span>{option.name}</span>
          </button>
        ))}
      </div>
      <button className={styles.cancel} type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
