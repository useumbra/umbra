import type { Provider, ProviderMessage, ProviderOptions } from "./types";
export class StubProvider implements Provider {
  async stream(
    messages: ProviderMessage[],
    model?: string,
    options?: ProviderOptions,
  ) {
    void model;
    void options;
    const prompt = messages.at(-1)?.content;
    const hasPrompt = Array.isArray(prompt)
      ? prompt.some((part) => part.type === "text" && part.text)
      : Boolean(prompt);
    const reply = `I received your protected request${hasPrompt ? " and can help you work through it." : "."} Your private details stayed inside this browser.`;
    return new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        let index = 0;
        const timer = setInterval(() => {
          if (index >= reply.length) {
            clearInterval(timer);
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(reply.slice(index, index + 4)));
          index += 4;
        }, 18);
      },
    });
  }
}
