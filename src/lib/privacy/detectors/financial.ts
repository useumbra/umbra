import type { Detector, EntityType } from "../types";
const make =
  (
    type: EntityType,
    regex: RegExp,
    severity: "low" | "medium" | "high" = "high",
  ): Detector =>
  (text) =>
    [...text.matchAll(regex)].map((m) => ({
      type,
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      value: m[0],
      severity,
      confidence: 0.97,
    }));
const luhn = (value: string) => {
  const digits = value.replace(/\D/g, "");
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt && (n *= 2) > 9) n -= 9;
    sum += n;
    alt = !alt;
  }
  return digits.length >= 13 && sum % 10 === 0;
};
export const detectCreditCard: Detector = (text) =>
  [...text.matchAll(/\b(?:\d[ -]?){13,19}\b/g)]
    .filter((m) => luhn(m[0]))
    .map((m) => ({
      type: "CREDIT_CARD" as const,
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      value: m[0],
      severity: "high" as const,
      confidence: 0.99,
    }));
export const detectIban = make("IBAN", /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi);
export const detectNationalId: Detector = (text) =>
  [...text.matchAll(/(?<!\d)(?:\d{16}|\d{3}-\d{2}-\d{4})(?!\d)/g)].map((m) => ({
    type: "NATIONAL_ID" as const,
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
    value: m[0],
    severity: "high" as const,
    confidence: 0.94,
  }));
export { luhn };
