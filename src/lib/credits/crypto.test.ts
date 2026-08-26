import { describe, expect, it } from "vitest";
import {
  addGrant,
  balanceOf,
  deductCredits,
  decryptVault,
  encryptVault,
  exportVault,
  importVault,
} from "./crypto";
import { deductModelRequest, estimateModelCost } from "./pricing";

describe("encrypted credits vault", () => {
  it("round trips encryption through export and import", async () => {
    const vault = addGrant({ ledger: [] }, 25);
    const encrypted = await encryptVault(vault, "correct horse battery staple");
    const recovered = importVault(exportVault(encrypted));
    await expect(decryptVault(recovered, "wrong passphrase")).rejects.toThrow();
    await expect(
      decryptVault(recovered, "correct horse battery staple"),
    ).resolves.toEqual(vault);
  });

  it("keeps ledger balance math accurate", () => {
    let vault = addGrant({ ledger: [] }, 100);
    vault = addGrant(vault, 25, "Second grant");
    vault = deductCredits(vault, 30, "Image request");
    expect(balanceOf(vault.ledger)).toBe(95);
    expect(() => deductCredits(vault, 96, "Too expensive")).toThrow(
      /Insufficient/,
    );
  });

  it("uses each model's configured token pricing for deductions", () => {
    const cost = estimateModelCost("nova-4", 1_000_000, 1_000_000);
    expect(cost).toBe(12.5);
    const vault = deductModelRequest(
      addGrant({ ledger: [] }, 20),
      "nova-4",
      1_000_000,
      1_000_000,
    );
    expect(balanceOf(vault.ledger)).toBe(7.5);
  });
});
