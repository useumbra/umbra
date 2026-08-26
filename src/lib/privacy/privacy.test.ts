import { describe, expect, it } from "vitest";
import { Vault, redact, restore, scoreLeaks } from "./index";
import { luhn } from "./detectors/financial";
describe("privacy engine", () => {
  it("round trips repeated and adjacent entities", () => { const vault = new Vault(); const text = "a@b.com,a@b.com"; expect(restore(redact(text, vault, "smart").text, vault)).toBe(text); expect(redact(text, vault, "smart").text).toBe("[EMAIL_1],[EMAIL_1]"); });
  it("keeps placeholders stable across turns", () => { const vault = new Vault(); expect(redact("Email a@b.com", vault, "smart").text).toContain("[EMAIL_1]"); expect(redact("Again a@b.com", vault, "smart").text).toContain("[EMAIL_1]"); });
  it("resolves overlapping crypto and secret spans", () => { const vault = new Vault(); const text = "wallet 0x0123456789012345678901234567890123456789"; const result = redact(text, vault, "smart"); expect(result.text).toContain("[WALLET_1]"); expect(restore(result.text, vault)).toBe(text); });
  it("validates Luhn cards", () => { expect(luhn("4111 1111 1111 1111")).toBe(true); expect(luhn("4111 1111 1111 1112")).toBe(false); });
  it("changes behavior by mode", () => { const vault = new Vault(); expect(redact("Visit https://example.com", vault, "smart").text).toContain("https://"); expect(redact("Visit https://example.com", vault, "full").text).toContain("[URL_1]"); });
  it("finds a seed phrase and EVM address together", () => { const vault = new Vault(); const text = "abandon ability able about above absent absorb abstract absurd abuse access accident and 0x0123456789012345678901234567890123456789"; const result = redact(text, vault, "smart"); expect(result.entities.some((e) => e.type === "SECRET")).toBe(true); expect(result.entities.some((e) => e.type === "EVM_ADDRESS")).toBe(true); expect(restore(result.text, vault)).toBe(text); });
  it("scores findings by severity", () => { const result = scoreLeaks("contact a@b.com or use 4111111111111111"); expect(result.score).toBeGreaterThan(0); expect(result.bySeverity.high.length).toBe(1); });
});
