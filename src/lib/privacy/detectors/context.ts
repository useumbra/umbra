import type { Detector, EntityType } from "../types";
import { locations } from "../data/gazetteer";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const make = (type: EntityType, regex: RegExp, severity: "low" | "medium" | "high" = "medium"): Detector => (text) => [...text.matchAll(regex)].map((m) => ({ type, start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, value: m[0], severity, confidence: 0.86 }));
export const detectLocation: Detector = (text) => {
  const regex = new RegExp(`\\b(?:${[...locations].sort((a, b) => b.length - a.length).map(esc).join("|")})\\b`, "gi");
  return [...text.matchAll(regex)].map((m) => ({ type: "LOCATION" as const, start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, value: m[0], severity: "medium" as const, confidence: 0.89 }));
};
export const detectPerson: Detector = (text) => {
  const results: ReturnType<Detector> = [];
  const honorific = /\b(?:Mr|Mrs|Ms|Dr|Pak|Bu|Ibu|Bapak)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g;
  const phrases = /\b(?:my name is|nama saya|I'm|I am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
  for (const regex of [honorific, phrases]) for (const m of text.matchAll(regex)) {
    const value = m[1] && /^(?:my name is|nama saya|I'm|I am)$/i.test(m[0].split(/\s+/)[0]) ? m[1] : m[0];
    const start = m[1] ? (m.index ?? 0) + m[0].lastIndexOf(m[1]) : m.index ?? 0;
    results.push({ type: "PERSON", start, end: start + value.length, value, severity: "medium", confidence: 0.9 });
  }
  const stop = new Set("The This That These Those Your My Our Their Hello Thanks Please Today Monday Tuesday Wednesday Thursday Friday Saturday Sunday".split(" "));
  const bigram = /\b([A-Z][a-z]{2,})\s+([A-Z][a-z]{2,})\b/g;
  for (const m of text.matchAll(bigram)) if ((m.index ?? 0) > 0 && !stop.has(m[1]) && !stop.has(m[2])) results.push({ type: "PERSON", start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, value: m[0], severity: "medium", confidence: 0.72 });
  return results;
};
export const detectOrg = make("ORG", /\b[A-Z][A-Za-z0-9& ]{1,40}\s(?:Inc|Ltd|LLC|GmbH|PT|Tbk|Pte)\.?\b/g, "low");
export const detectMoney = make("MONEY", /(?:[$€£¥]\s?\d[\d,.]*|\b\d[\d,.]*\s?(?:USD|EUR|GBP|IDR|USDG)\b)/gi, "low");
export const detectDob = make("DATE_OF_BIRTH", /\b(?:DOB|date of birth|born on)\s*:?\s*\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/gi);
export const detectHealth: Detector = (text) => {
  const terms = ["diabetes","cancer","depression","anxiety","HIV","migraine","asthma","cholesterol","hypertension","medication","diagnosis","symptoms"];
  const regex = new RegExp(`\\b(?:${terms.join("|")})\\b`, "gi");
  return [...text.matchAll(regex)].map((m) => ({ type: "HEALTH_TERM" as const, start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, value: m[0], severity: "medium" as const, confidence: 0.84 }));
};
