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
    const codeRequest = messages.some(
      (message) =>
        message.role === "system" &&
        typeof message.content === "string" &&
        message.content.includes("UMBRA_CODE_PROJECT"),
    );
    const hasPrompt = Array.isArray(prompt)
      ? prompt.some((part) => part.type === "text" && part.text)
      : Boolean(prompt);
    const reply = codeRequest
      ? [
          "```html index.html",
          "<!doctype html>",
          '<html lang="en">',
          "  <head>",
          '    <meta charset="UTF-8" />',
          '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
          "    <title>UmbraCode demo</title>",
          "  </head>",
          "  <body>",
          '    <main class="card">',
          '      <p class="eyebrow">LOCAL DEMO</p>',
          "      <h1>Small steps, visible progress.</h1>",
          "      <p>Tap the button to keep a tiny streak.</p>",
          '      <button id="count">Complete a step</button>',
          '      <strong id="streak" aria-live="polite">0 steps</strong>',
          "    </main>",
          "  </body>",
          "</html>",
          "```",
          "```css styles.css",
          ":root { font-family: system-ui, sans-serif; color: #172018; background: #eaf5df; }",
          "body { min-height: 100vh; display: grid; place-items: center; margin: 0; }",
          ".card { width: min(90vw, 520px); padding: 32px; border-radius: 24px; background: white; box-shadow: 0 20px 60px #8aa47a55; }",
          ".eyebrow { color: #38701f; font-size: 12px; letter-spacing: .16em; }",
          "button { padding: 12px 16px; border: 0; border-radius: 10px; color: white; background: #38701f; cursor: pointer; }",
          "#streak { display: block; margin-top: 20px; font-size: 24px; }",
          "```",
          "```js script.js",
          "const button = document.querySelector('#count');",
          "const streak = document.querySelector('#streak');",
          "let count = 0;",
          "button.addEventListener('click', () => {",
          "  count += 1;",
          "  streak.textContent = `${count} ${count === 1 ? 'step' : 'steps'}`;",
          "});",
          "```",
        ].join("\n")
      : `I received your protected request${hasPrompt ? " and can help you work through it." : "."} Your private details stayed inside this browser.`;
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
