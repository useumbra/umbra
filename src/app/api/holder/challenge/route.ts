import { createChallenge, isAddress } from "@/lib/holder-proof";

export const runtime = "nodejs";

const invalid = (message: string) =>
  Response.json(
    { error: { message, type: "invalid_request_error" } },
    { status: 400 },
  );

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid("Request body must be valid JSON");
  }
  const address =
    typeof body === "object" &&
    body !== null &&
    "address" in body &&
    typeof body.address === "string"
      ? body.address
      : undefined;
  if (!address || !isAddress(address))
    return invalid("address must be a valid EVM address");
  return Response.json({
    address: address.toLowerCase(),
    ...createChallenge(address),
  });
}
