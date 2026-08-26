import type { Detector, EntityType } from "../types";
const make = (type: EntityType, regex: RegExp, severity: "low" | "medium" | "high" = "medium", confidence = 0.98): Detector =>
  (text) => [...text.matchAll(regex)].map((m) => ({ type, start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, value: m[0], severity, confidence }));
export const detectEmail = make("EMAIL", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
export const detectPhone = make("PHONE", /(?:\+\d{1,3}[\s.-]?(?:\d[\s.-]?){7,14}\d|(?<!\d)08\d{8,12}(?!\d))/g);
export const detectUrl = make("URL", /\bhttps?:\/\/[^\s<]+/gi, "low");
export const detectIpv4 = make("IP_V4", /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/gi);
export const detectIpv6 = make("IP_V6", /(?<![A-Za-z0-9:])(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}(?![A-Za-z0-9:])/gi);
