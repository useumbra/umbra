export const projectFiles = ["index.html", "styles.css", "script.js"] as const;

export type ProjectFileName = (typeof projectFiles)[number];

export type CodeProject = {
  files: Record<string, string>;
  warnings: string[];
};

const allowedFiles = new Set<string>(projectFiles);

export const inlineCodeProject = (files: Record<string, string>) => {
  const html =
    files["index.html"] ?? "<!doctype html><html><body></body></html>";
  const css = (files["styles.css"] ?? "").replace(/<\/style/gi, "<\\/style");
  const js = (files["script.js"] ?? "").replace(/<\/script/gi, "<\\/script");
  const style = `<style>${css}</style>`;
  const script = `<script>${js}</script>`;
  let withCss = html;
  if (/<\/head>/i.test(withCss))
    withCss = withCss.replace(/<\/head>/i, `${style}</head>`);
  else if (/<\/body>/i.test(withCss))
    withCss = withCss.replace(/<\/body>/i, `${style}</body>`);
  else if (/<body\b[^>]*>/i.test(withCss))
    withCss = withCss.replace(/(<body\b[^>]*>)/i, `$1${style}`);
  else if (/<\/html>/i.test(withCss))
    withCss = withCss.replace(/<\/html>/i, `${style}</html>`);
  else withCss = `${style}${withCss}`;

  let withScript = withCss;
  if (/<\/body>/i.test(withScript))
    withScript = withScript.replace(/<\/body>/i, `${script}</body>`);
  else if (/<\/html>/i.test(withScript))
    withScript = withScript.replace(/<\/html>/i, `${script}</html>`);
  else withScript += script;
  return withScript.includes("<html")
    ? withScript
    : `<!doctype html><html><head></head><body>${withScript}</body></html>`;
};

const filenameFromInfo = (info: string) => {
  const candidates = info
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[(),;]+$/g, "").toLowerCase());
  return candidates.find((candidate) => allowedFiles.has(candidate));
};

export const parseCodeProject = (markdown: string): CodeProject => {
  const files: Record<string, string> = {};
  const warnings: string[] = [];
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let current: { filename?: string; lines: string[] } | undefined;

  const saveCurrent = (unterminated: boolean) => {
    if (!current) return;
    if (current.filename) {
      if (files[current.filename] !== undefined)
        warnings.push(`Duplicate ${current.filename} block; kept the latest.`);
      files[current.filename] = current.lines.join("\n");
    }
    if (unterminated)
      warnings.push("Unterminated code fence was parsed to EOF.");
    current = undefined;
  };

  for (const line of lines) {
    if (!current) {
      const opening = line.match(/^\s*```(.*)$/);
      if (!opening) continue;
      const info = opening[1].trim();
      const filename = filenameFromInfo(info);
      if (!info) warnings.push("Unlabelled code fence was ignored.");
      else if (!filename)
        warnings.push(`Unsupported project file hint: ${info}`);
      current = { filename, lines: [] };
      continue;
    }

    if (/^\s*```\s*$/.test(line)) {
      saveCurrent(false);
      continue;
    }
    current.lines.push(line);
  }

  saveCurrent(true);
  if (!Object.keys(files).length && !warnings.length)
    warnings.push("No supported project files were found.");
  return { files, warnings };
};
