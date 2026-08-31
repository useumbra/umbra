import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const secret =
  process.env.UMBRA_API_SECRET ?? randomBytes(32).toString("base64url");
if (!process.env.UMBRA_API_SECRET)
  console.warn(
    "UMBRA_API_SECRET is not set; using an ephemeral developer API secret for this process.",
  );

export type ApiClaims = {
  jti?: string;
  sub: string;
  label?: string;
  tier?: string;
  iat: number;
  exp: number;
};

export type ApiKeyOptions = {
  label: string;
  days: number;
};

type ApiKeyStore = {
  get: (key: string) => Promise<string | null>;
  put: (
    key: string,
    value: string,
    options: { expirationTtl: number },
  ) => Promise<void>;
};

const encode = (value: string) => Buffer.from(value).toString("base64url");
const tokenBody = (token: string) =>
  token.startsWith("umb_") ? token.slice(4) : token;
const holderTierIds = new Set(["base", "holder", "circle", "council"]);

export const signPayload = (payload: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export const verifySignedPayload = (payload: string, signature: string) => {
  const expected = signPayload(payload);
  const receivedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
};

export const createApiTokenDetails = (
  subject = "developer",
  lifetimeSeconds = 86_400,
  label = subject,
  tier?: string,
) => {
  const now = Math.floor(Date.now() / 1000);
  const claims: ApiClaims = {
    jti: randomBytes(16).toString("base64url"),
    sub: subject,
    label,
    iat: now,
    exp: now + lifetimeSeconds,
    ...(tier ? { tier } : {}),
  };
  const payload = encode(JSON.stringify(claims));
  const signature = signPayload(payload);
  return { token: `umb_${payload}.${signature}`, claims };
};

export const createApiToken = (
  subject = "developer",
  lifetimeSeconds = 86_400,
  label = subject,
) => createApiTokenDetails(subject, lifetimeSeconds, label).token;

export const validateApiKeyOptions = (
  input: unknown,
): ApiKeyOptions | string => {
  const body =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const label = body.label === undefined ? "developer" : body.label;
  const days = body.days === undefined ? 90 : body.days;
  if (typeof label !== "string" || label.length > 64)
    return "label must be a string of 64 characters or fewer";
  if (
    typeof days !== "number" ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 365
  )
    return "days must be an integer from 1 to 365";
  return { label, days };
};

export const getApiTokenClaims = (
  token: string,
  allowExpired = false,
): ApiClaims | undefined => {
  const [payload, signature] = tokenBody(token).split(".");
  if (!payload || !signature) return undefined;
  if (!verifySignedPayload(payload, signature)) return undefined;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as ApiClaims;
    if (
      typeof claims.sub !== "string" ||
      typeof claims.iat !== "number" ||
      typeof claims.exp !== "number" ||
      (claims.jti !== undefined && typeof claims.jti !== "string") ||
      (claims.label !== undefined && typeof claims.label !== "string") ||
      (claims.tier !== undefined &&
        (typeof claims.tier !== "string" || !holderTierIds.has(claims.tier)))
    )
      return undefined;
    if (!allowExpired && claims.exp <= Math.floor(Date.now() / 1000))
      return undefined;
    return claims;
  } catch {
    return undefined;
  }
};

export const isValidApiToken = (token: string) =>
  getApiTokenClaims(token) !== undefined;

export const dailyQuotaForTier = (tier?: string) => {
  switch (tier) {
    case "holder":
      return 1_000;
    case "circle":
      return 5_000;
    case "council":
      return 20_000;
    default:
      return 200;
  }
};

export const usageKey = (jti: string, date = new Date()) =>
  `usage:${jti}:${date.toISOString().slice(0, 10)}`;

let warnedMissingStore = false;

const getApiKeyStore = async (): Promise<ApiKeyStore | undefined> => {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const store = (env as CloudflareEnv & { UMBRA_KEYS?: ApiKeyStore })
      .UMBRA_KEYS;
    if (store) return store;
  } catch {
    // Local development and tests may not provide a Cloudflare context.
  }
  if (!warnedMissingStore) {
    warnedMissingStore = true;
    console.warn(
      "UMBRA_KEYS is not configured; API key revocation checks are skipped.",
    );
  }
  return undefined;
};

export const isApiTokenRevoked = async (jti: string) => {
  const store = await getApiKeyStore();
  return Boolean(store && (await store.get(`revoked:${jti}`)));
};

export const revokeApiToken = async (token: string) => {
  const claims = getApiTokenClaims(token, true);
  if (!claims?.jti) return undefined;
  const store = await getApiKeyStore();
  if (store) {
    const ttl = Math.max(60, claims.exp - Math.floor(Date.now() / 1000));
    await store.put(`revoked:${claims.jti}`, "1", {
      expirationTtl: ttl,
    });
  }
  return claims;
};

export const requireApiAuth = async (request: Request) => {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const claims = token ? getApiTokenClaims(token) : undefined;
  if (!claims)
    return Response.json(
      { error: { message: "Invalid API key", type: "authentication_error" } },
      { status: 401 },
    );
  const store = claims.jti ? await getApiKeyStore() : undefined;
  if (store && claims.jti && (await store.get(`revoked:${claims.jti}`)))
    return Response.json(
      { error: { message: "Invalid API key", type: "authentication_error" } },
      { status: 401 },
    );
  if (store && claims.jti) {
    // KV counters are not atomic, so this quota is an approximation.
    const current = Number.parseInt(
      (await store.get(usageKey(claims.jti))) ?? "0",
      10,
    );
    const count = Number.isNaN(current) ? 0 : current;
    if (count >= dailyQuotaForTier(claims.tier))
      return Response.json(
        {
          error: {
            message: "Daily quota exceeded for this key tier",
            type: "rate_limit_exceeded",
          },
        },
        { status: 429 },
      );
    await store.put(usageKey(claims.jti), String(count + 1), {
      expirationTtl: 172_800,
    });
  }
  return undefined;
};
