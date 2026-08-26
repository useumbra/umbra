export type ImageRequest = {
  prompt: string;
  model?: string;
  aspectRatio?: "square" | "landscape" | "portrait";
  steps?: number;
};

export type MediaResult = {
  url: string;
  stub: boolean;
  model: string;
};

export type MediaProvider = {
  generate(request: ImageRequest): Promise<MediaResult>;
};

export const falAspect = (aspectRatio: ImageRequest["aspectRatio"]) =>
  ({
    square: "square",
    landscape: "landscape_16_9",
    portrait: "portrait_16_9",
  })[aspectRatio ?? "landscape"];

export const deterministicSvg = (prompt: string, kind: "image" | "video") => {
  let hash = 2166136261;
  for (const character of prompt) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const hue = Math.abs(hash) % 360;
  const label = kind === "image" ? "stub image" : "stub video frame";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="hsl(${hue} 55% 18%)"/><stop offset="1" stop-color="hsl(${(hue + 80) % 360} 65% 45%)"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><circle cx="640" cy="300" r="110" fill="white" opacity=".14"/><text x="640" y="510" fill="white" font-family="Arial,sans-serif" font-size="42" text-anchor="middle">Umbra · ${label}</text><text x="640" y="565" fill="white" opacity=".75" font-family="monospace" font-size="18" text-anchor="middle">local demo • ${Math.abs(hash).toString(16)}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

export const mediaUrl = (result: unknown, kind: "image" | "video") => {
  const data = (result as { data?: unknown }).data ?? result;
  const object = data as {
    images?: { url?: string }[];
    video?: { url?: string };
    url?: string;
  };
  return kind === "image"
    ? (object.images?.[0]?.url ?? object.url)
    : (object.video?.url ?? object.url);
};
