import { describe, expect, it } from "vitest";
import { mapFalVideoStatus, StubVideoProvider } from "./video";

describe("video provider status mapping", () => {
  it("maps FAL queue states", () => {
    expect(mapFalVideoStatus("IN_QUEUE")).toBe("queued");
    expect(mapFalVideoStatus("IN_PROGRESS")).toBe("running");
    expect(mapFalVideoStatus("COMPLETED")).toBe("done");
    expect(mapFalVideoStatus("FAILED")).toBe("failed");
    expect(mapFalVideoStatus("unexpected")).toBe("failed");
  });

  it("keeps the stub submit and status flow synchronous", async () => {
    const provider = new StubVideoProvider();
    const submitted = await provider.submit({ prompt: "A quiet lake" });
    await expect(provider.status(submitted.requestId)).resolves.toMatchObject({
      state: "done",
      url: expect.stringContaining("data:image/svg+xml;base64,"),
    });
  });
});
