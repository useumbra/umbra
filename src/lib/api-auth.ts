import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const secret =
  process.env.UMBRA_API_SECRET ?? randomBytes(32).toString("base64url");
if (!process.env.UMBRA_API_SECRET)
  console.warn(
    "UMBRA_API_SECRET is not set; using an ephemeral developer API secret for this process.",
  );

type ApiClaims = {
  sub: string;
  iat: number;
  exp: number;
};

const encode = (value: string) => Buffer.from(value).toString("base64url");

export const createApiToken = (
  subject = "developer",
  lifetimeSeconds = 86_400,
) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = encode(
    JSON.stringify({ sub: subject, iat: now, exp: now + lifetimeSeconds }),
  );
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
};

export const isValidApiToken = (token: string) => {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  const receivedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    receivedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(receivedBytes, expectedBytes)
  )
    return false;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as ApiClaims;
    return (
      typeof claims.sub === "string" &&
      typeof claims.exp === "number" &&
      claims.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
};

export const requireApiAuth = (request: Request) => {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  return token && isValidApiToken(token)
    ? undefined
    : Response.json(
        { error: { message: "Invalid API key", type: "authentication_error" } },
        { status: 401 },
      );
};
