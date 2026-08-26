import { describe, expect, it } from "vitest";
import { inlineCodeProject, parseCodeProject } from "../code-project";

describe("code project parser", () => {
  it("parses a complete multi-file project", () => {
    const result = parseCodeProject(
      "```html index.html\n<h1>Hello</h1>\n```\n```css styles.css\nh1 { color: red; }\n```\n```js script.js\nconsole.log('hi');\n```",
    );
    expect(result.files).toEqual({
      "index.html": "<h1>Hello</h1>",
      "styles.css": "h1 { color: red; }",
      "script.js": "console.log('hi');",
    });
    expect(result.warnings).toEqual([]);
  });

  it("accepts an html-only project", () => {
    const result = parseCodeProject(
      "```html index.html\n<h1>Only HTML</h1>\n```",
    );
    expect(result.files).toEqual({ "index.html": "<h1>Only HTML</h1>" });
    expect(result.warnings).toEqual([]);
  });

  it("keeps an unterminated final fence while streaming", () => {
    const result = parseCodeProject("```js script.js\nbutton.onclick = run;");
    expect(result.files["script.js"]).toBe("button.onclick = run;");
    expect(result.warnings).toEqual([
      "Unterminated code fence was parsed to EOF.",
    ]);
  });

  it("warns and ignores an unlabelled fence", () => {
    const result = parseCodeProject("```\n<h1>Unknown</h1>\n```");
    expect(result.files).toEqual({});
    expect(result.warnings).toContain("Unlabelled code fence was ignored.");
  });

  it("warns and ignores a disallowed filename", () => {
    const result = parseCodeProject(
      "```ts app.ts\nexport const answer = 42;\n```",
    );
    expect(result.files).toEqual({});
    expect(result.warnings).toContain(
      "Unsupported project file hint: ts app.ts",
    );
  });

  it("inlines assets when the html document has no head or body close", () => {
    const result = inlineCodeProject({
      "index.html": "<html><main>Demo</main></html>",
      "styles.css": "main { color: red; }",
      "script.js": "document.title = 'Demo';",
    });
    expect(result).toContain("<style>main { color: red; }</style>");
    expect(result).toContain("<script>document.title = 'Demo';</script>");
    expect(result.indexOf("<style>")).toBeLessThan(result.indexOf("</html>"));
    expect(result.indexOf("<script>")).toBeLessThan(result.indexOf("</html>"));
  });
});
