import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const request = (body: unknown) =>
  new NextRequest("http://localhost/api/video", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("video route upstream status", () => {
  it("returns the provider HTTP status without provider details", async () => {
    vi.stubEnv("FAL_KEY", "test-fal-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream detail", { status: 503 })),
    );

    const response = await POST(request({ prompt: "test prompt" }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Video generation unavailable",
      upstream: 503,
    });
  });

  it("returns zero when the provider fetch fails", async () => {
    vi.stubEnv("FAL_KEY", "test-fal-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("private network detail");
      }),
    );

    const response = await POST(request({ prompt: "test prompt" }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Video generation unavailable",
      upstream: 0,
    });
  });
});
