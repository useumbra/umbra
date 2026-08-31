import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDictation,
  dictationSupported,
  speak,
  speechSupported,
  stopSpeaking,
} from "./speech";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser speech helpers", () => {
  it("are safe when browser speech APIs are unavailable", () => {
    expect(dictationSupported()).toBe(false);
    expect(speechSupported()).toBe(false);
    expect(
      createDictation(
        () => undefined,
        () => undefined,
      ),
    ).toBeUndefined();
    expect(() => speak("hello")).not.toThrow();
    expect(() => stopSpeaking()).not.toThrow();
  });
});
