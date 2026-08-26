import type { Detector, EntityType } from "../types";
const make = (type: EntityType, regex: RegExp, severity: "low" | "medium" | "high" = "high"): Detector => (text) => [...text.matchAll(regex)].map((m) => ({ type, start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, value: m[0], severity, confidence: 0.99 }));
export const detectTx = make("TX_HASH", /\b0x[0-9a-fA-F]{64}\b/g);
export const detectEvm = make("EVM_ADDRESS", /\b0x[0-9a-fA-F]{40}\b/g);
const keys = /\b(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|[0-9a-fA-F]{64})\b/g;
const words = new Set("abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid acoustic acquire across act action actor adapt add addict address adjust admit adult advance advice aerobic affair afford afraid again age agent agree ahead aim air airport aisle alarm album alcohol alert alien all alley allow almost alone alpha already also alter always amateur amazing among amount amused analyst anchor ancient anger angle angry animal announce annual another answer antenna antique anxiety apart apology appear apple approve april arch argue arm armed armor army around arrange arrest arrive arrow art artefact artist artwork ask aspect assault asset assist assume asthma athlete atom attack attend attitude attract auction audit august aunt author auto autumn average avocado avoid awake aware awesome awful awkward axis".split(" "));
export const detectSecrets: Detector = (text) => {
  const found = [...text.matchAll(keys)].map((m) => ({ type: "SECRET" as const, start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, value: m[0], severity: "high" as const, confidence: 0.99 }));
  for (const m of text.matchAll(/\b[A-Za-z0-9_-]{32,}\b/g)) {
    const value = m[0];
    const classes = Number(/[a-z]/.test(value)) + Number(/[A-Z]/.test(value)) + Number(/\d/.test(value)) + Number(/[_-]/.test(value));
    const diversity = new Set(value).size / value.length;
    if (!value.startsWith("0x") && classes >= 3 && diversity > 0.45) found.push({ type: "SECRET", start: m.index ?? 0, end: (m.index ?? 0) + value.length, value, severity: "high", confidence: 0.82 });
  }
  for (const m of text.matchAll(/\b(?:[a-z]{3,}\s+){11}[a-z]{3,}\b|\b(?:[a-z]{3,}\s+){23}[a-z]{3,}\b/gi)) {
    const tokens = m[0].toLowerCase().split(/\s+/);
    if (tokens.every((word) => words.has(word))) found.push({ type: "SECRET", start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, value: m[0], severity: "high", confidence: 0.93 });
  }
  return found;
};
