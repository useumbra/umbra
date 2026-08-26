import { describe, expect, it } from "vitest";
import {
  Vault,
  findEntities,
  redact,
  redactWithDetectors,
  resolveEntities,
  restore,
  scoreLeaks,
} from "./index";
import { luhn } from "./detectors/financial";
import type { Detector } from "./types";

describe("privacy engine", () => {
  it("round trips repeated and adjacent entities", () => {
    const vault = new Vault();
    const text = "a@b.com,a@b.com";
    expect(restore(redact(text, vault, "smart").text, vault)).toBe(text);
    expect(redact(text, vault, "smart").text).toBe("[EMAIL_1],[EMAIL_1]");
  });

  it("keeps placeholders stable across turns", () => {
    const vault = new Vault();
    expect(redact("Email a@b.com", vault, "smart").text).toContain("[EMAIL_1]");
    expect(redact("Again a@b.com", vault, "smart").text).toContain("[EMAIL_1]");
  });

  it("resolves overlapping crypto and secret spans", () => {
    const vault = new Vault();
    const text = "wallet 0x0123456789012345678901234567890123456789";
    const result = redact(text, vault, "smart");
    expect(result.text).toContain("[WALLET_1]");
    expect(restore(result.text, vault)).toBe(text);
  });

  it("validates Luhn cards", () => {
    expect(luhn("4111 1111 1111 1111")).toBe(true);
    expect(luhn("4111 1111 1111 1112")).toBe(false);
  });

  it("changes behavior by mode", () => {
    const vault = new Vault();
    expect(redact("Visit https://example.com", vault, "smart").text).toContain(
      "https://",
    );
    expect(redact("Visit https://example.com", vault, "full").text).toContain(
      "[URL_1]",
    );
  });

  it("finds a seed phrase and EVM address together", () => {
    const vault = new Vault();
    const text =
      "abandon ability able about above absent absorb abstract absurd abuse access accident and 0x0123456789012345678901234567890123456789";
    const result = redact(text, vault, "smart");
    expect(result.entities.some((e) => e.type === "SECRET")).toBe(true);
    expect(result.entities.some((e) => e.type === "EVM_ADDRESS")).toBe(true);
    expect(restore(result.text, vault)).toBe(text);
  });

  it("scores findings by severity", () => {
    const result = scoreLeaks("contact a@b.com or use 4111111111111111");
    expect(result.score).toBeGreaterThan(0);
    expect(result.bySeverity.high.length).toBe(1);
  });

  it("round trips the reported identity and wallet sentence", () => {
    const text =
      "Hi, my name is John Smith, my wallet is 0x1234567890123456789012345678901234567890 and I live in Jakarta.";
    const vault = new Vault();
    const result = redact(text, vault, "smart");
    expect(result.text).toContain("Hi, my name is [PERSON_1], my wallet");
    expect(restore(result.text, vault)).toBe(text);
  });

  it("uses the capture group for Indonesian name phrases", () => {
    const text = "nama saya Budi Santoso, email budi@contoh.id";
    const vault = new Vault();
    const result = redact(text, vault, "smart");
    expect(result.text).toBe("nama saya [PERSON_1], email [EMAIL_1]");
    expect(restore(result.text, vault)).toBe(text);
  });

  it("drops a detector span that violates its value invariant", () => {
    const broken: Detector = () => [
      {
        type: "PERSON",
        start: 0,
        end: 3,
        value: "Alice",
        severity: "medium",
        confidence: 1,
      },
    ];
    const text = "Bob stays intact";
    const result = redactWithDetectors(text, new Vault(), "smart", [broken]);
    expect(result.text).toBe(text);
    expect(result.entities).toHaveLength(0);
  });

  it("round trips identity data in a generated corpus for both modes", () => {
    const names = ["Alice Smith", "Budi Santoso", "Maya Chen", "Omar Khan"];
    const emails = [
      "alice@example.com",
      "budi@contoh.id",
      "maya@example.net",
      "omar@sample.org",
    ];
    const wallets = [
      "0x1234567890123456789012345678901234567890",
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    ];
    const cities = ["Jakarta", "London", "Tokyo", "Bandung"];
    const cards = ["4111111111111111", "4012888888881881"];
    for (let i = 0; i < 200; i += 1) {
      const text = `Note ${i}: my name is ${names[i % names.length]}, email ${emails[i % emails.length]}, wallet ${wallets[i % wallets.length]}, city ${cities[i % cities.length]}, card ${cards[i % cards.length]}.`;
      for (const mode of ["smart", "full"] as const) {
        const vault = new Vault();
        const result = redact(text, vault, mode);
        expect(restore(result.text, vault)).toBe(text);
        const spans = resolveEntities(findEntities(text));
        let cursor = 0;
        let expected = "";
        for (const span of spans) {
          expected += text.slice(cursor, span.start);
          const redacted = result.entities.find(
            (entity) =>
              entity.start === span.start &&
              entity.end === span.end &&
              entity.type === span.type,
          );
          expected += redacted ? redacted.placeholder : span.value;
          cursor = span.end;
        }
        expected += text.slice(cursor);
        expect(result.text).toBe(expected);
      }
    }
  });

  it("detects Indonesian NIK, US SSN, and IBAN", () => {
    const result = redact(
      "NIK 3175091201900001, SSN 123-45-6789, IBAN GB82WEST12345698765432",
      new Vault(),
      "smart",
    );
    expect(result.entities.map((entity) => entity.type)).toEqual(
      expect.arrayContaining(["NATIONAL_ID", "IBAN"]),
    );
    expect(
      result.entities.filter((entity) => entity.type === "NATIONAL_ID"),
    ).toHaveLength(2);
  });

  it("keeps off mode unchanged while reporting findings", () => {
    const text = "Email budi@contoh.id and visit https://example.com";
    const result = redact(text, new Vault(), "off");
    expect(result.text).toBe(text);
    expect(result.receipt.count).toBeGreaterThan(0);
    expect(result.receipt.entities.length).toBeGreaterThan(0);
  });

  it("handles adjacent person and location spans", () => {
    const text = "Dr John,Jakarta";
    const vault = new Vault();
    const result = redact(text, vault, "smart");
    expect(result.entities.map((entity) => entity.type)).toEqual([
      "PERSON",
      "LOCATION",
    ]);
    expect(restore(result.text, vault)).toBe(text);
  });
});
