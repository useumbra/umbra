import type { MemoryEntry } from "./memory";

const match = (text: string, pattern: RegExp) => text.match(pattern);

const patterns: readonly ((text: string) => string | undefined)[] = [
  (text) => {
    const value = match(text, /\bmy name is ([^.,;!?\n]{2,60})/i)?.[1];
    return value ? `Name: ${value}` : undefined;
  },
  (text) => {
    const value = match(text, /\bcall me ([^.,;!?\n]{2,40})/i)?.[1];
    return value ? `Prefers to be called ${value}` : undefined;
  },
  (text) => {
    const value = match(text, /\bi work (?:at|for) ([^.,;!?\n]{2,60})/i)?.[1];
    return value ? `Works at ${value}` : undefined;
  },
  (text) => {
    const value = match(
      text,
      /\bi(?:'m| am) (?:a|an) ([^.,;!?\n]{2,60})/i,
    )?.[1];
    return value ? `Works as a ${value}` : undefined;
  },
  (text) => {
    const value = match(
      text,
      /\bi (?:live|am based) in ([^.,;!?\n]{2,60})/i,
    )?.[1];
    return value ? `Based in ${value}` : undefined;
  },
  (text) => {
    const value = match(text, /\bi (?:prefer|like) ([^.,;!?\n]{3,80})/i)?.[1];
    return value ? `Prefers ${value}` : undefined;
  },
  (text) => {
    const value = match(text, /\bi use ([^.,;!?\n]{3,80})/i)?.[1];
    return value ? `Uses ${value}` : undefined;
  },
  (text) => match(text, /\bremember (?:that )?([^.,;!?\n]{3,120})/i)?.[1],
  (text) => {
    const match = text.match(
      /\b(?:please )?(always|never) ([^.,;!?\n]{3,80})/i,
    );
    return match ? `${match[1]} ${match[2]}` : undefined;
  },
];

const capitalize = (text: string) =>
  text ? `${text[0].toUpperCase()}${text.slice(1)}` : text;

const normalize = (text: string) => {
  const compact = text.trim().replace(/\s+/g, " ");
  if (compact.length <= 140) return compact;
  const truncated = compact
    .slice(0, 140)
    .replace(/\s+\S*$/, "")
    .trim();
  return truncated || compact.slice(0, 140).trim();
};

export const suggestMemories = (
  text: string,
  entries: readonly MemoryEntry[],
  dismissed: readonly string[],
): string[] => {
  const existing = entries.map((entry) => entry.text.toLowerCase());
  const rejected = dismissed.map((item) => item.toLowerCase());
  const seen = new Set<string>();
  const suggestions: string[] = [];
  for (const pattern of patterns) {
    const value = pattern(text);
    if (!value) continue;
    const candidate = normalize(
      pattern === patterns[7] || pattern === patterns[8]
        ? capitalize(value)
        : value,
    );
    const lower = candidate.toLowerCase();
    if (
      candidate.length < 4 ||
      seen.has(lower) ||
      rejected.includes(lower) ||
      existing.some(
        (item) =>
          item === lower || item.includes(lower) || lower.includes(item),
      )
    )
      continue;
    seen.add(lower);
    suggestions.push(candidate);
    if (suggestions.length === 2) break;
  }
  return suggestions;
};
