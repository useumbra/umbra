import { describe, expect, it } from "vitest";
import { UpstreamError } from "./upstream";

describe("UpstreamError", () => {
  it("preserves the upstream status", () => {
    const error = new UpstreamError(503, "provider unavailable");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("UpstreamError");
    expect(error.status).toBe(503);
    expect(error.message).toBe("provider unavailable");
  });
});
