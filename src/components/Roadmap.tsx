import Link from "next/link";
import { Header } from "./Header";

const roadmap = [
  {
    status: "Live now",
    items: [
      "UmbraChat with streaming + multi-model routing (umbra-auto)",
      "Smart Privacy engine",
      "/leak-check",
      "browser-local conversations with search + export/import",
      "attachments (text/PDF/image)",
      "UmbraCode with sandboxed browser preview",
      "Umbra Memory",
      "MCP connectors (manual discovery + invocation)",
      "OpenAI-compatible Umbra API",
      "encrypted browser-local credits",
      "read-only Robinhood Chain wallet reads",
      "docs",
    ],
  },
  {
    status: "Waiting on funding",
    items: [
      "UmbraImage and UmbraVideo — the provider integration is wired and the key is configured, but generation fails until the image/video provider balance is topped up.",
    ],
  },
  {
    status: "In progress / next",
    items: [
      "automatic agentic tool use over connectors",
      "smarter memory suggestions",
      "web search",
    ],
  },
  {
    status: "Planned",
    items: [
      "on-chain credit funding on Robinhood Chain",
      "persistent API key management",
      "hosted accounts as an opt-in (never required)",
      "$UMB token — subject to technical and legal decisions, not a commitment or a promise of any kind.",
    ],
  },
] as const;

const linkItem = (item: string) => {
  if (item === "/leak-check") return <Link href={item}>{item}</Link>;
  if (item === "docs") return <Link href="/docs">{item}</Link>;
  return item;
};

export function Roadmap() {
  return (
    <div>
      <Header />
      <main className="shell roadmap-page">
        <section className="hero roadmap-hero">
          <div className="eyebrow">Umbra roadmap</div>
          <h1>
            What is here.
            <br />
            <span style={{ color: "var(--accent)" }}>What comes next.</span>
          </h1>
          <p>
            A status view of the browser-first workspace and the work still
            ahead.
          </p>
        </section>
        {roadmap.map((group) => (
          <section className="section roadmap-section" key={group.status}>
            <div className="section-heading">
              <h2>{group.status}</h2>
              <p>Current product status, without dates or promises.</p>
            </div>
            <div className="feature-grid">
              {group.items.map((item) => (
                <div className="feature" key={item}>
                  <span className="badge">{group.status}</span>
                  <h3>{linkItem(item)}</h3>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
