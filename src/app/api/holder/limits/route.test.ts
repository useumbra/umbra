import { describe, expect, it } from "vitest";
import { createHolderProof } from "../../../../lib/holder-proof";
import { POST } from "./route";

const address = "0x827Bc6A9d7376E19EFd180D990AcC51018D1ccEe";

const request = (body: unknown) =>
  new Request("http://localhost/api/holder/limits", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("holder limits route", () => {
  it("returns the signed address and holder-rate percentage", async () => {
    const proof = createHolderProof(address, "circle", "1000000");
    const response = await POST(request({ proof }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      tier: "circle",
      address: address.toLowerCase(),
      creditBonusPercent: 10,
    });
  });

  it("returns the base rate without an address when no proof is supplied", async () => {
    const response = await POST(request({}));

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      tier: "base",
      creditBonusPercent: 0,
    });
    expect(body).not.toHaveProperty("address");
  });
});
