import type { Provider, ProviderMessage } from "./types";
export class StubProvider implements Provider {
  async stream(messages: ProviderMessage[]) {
    const prompt = messages.at(-1)?.content ?? "";
    const reply = `I received your protected request${prompt ? " and can help you work through it." : "."} Your private details stayed inside this browser.`;
    return new ReadableStream({ start(controller) { const encoder = new TextEncoder(); let index = 0; const timer = setInterval(() => { if (index >= reply.length) { clearInterval(timer); controller.close(); return; } controller.enqueue(encoder.encode(reply.slice(index, index + 4))); index += 4; }, 18); } });
  }
}
