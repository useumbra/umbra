import Link from "next/link";
import { Header } from "./Header";

const roadmap = [
  {
    status: "Live now",
    blurb: "Shipped and usable today.",
    items: [
      {
        title: "UmbraChat",
        description:
          "Streaming chat across models, with automatic routing via umbra-auto.",
      },
      {
        title: "UmbraImage",
        description: "Generate images through the connected provider.",
      },
      {
        title: "UmbraVideo",
        description:
          "Generate videos through the connected provider; renders take about two minutes.",
      },
      {
        title: "Smart Privacy",
        description:
          "Browser-side redaction with reversible placeholders and a local receipt.",
      },
      {
        title: "Leak check",
        description:
          "Inspect what a prompt reveals without sending it anywhere.",
      },
      {
        title: "Local conversations",
        description: "Stored in this browser, with search and export/import.",
      },
      {
        title: "Attachments",
        description: "Text, PDF and image content redacted before it is sent.",
      },
      {
        title: "UmbraCode",
        description:
          "Generate a small project and preview it in a sandboxed frame.",
      },
      {
        title: "Umbra Memory",
        description: "Context you write yourself, kept in this browser.",
      },
      {
        title: "Connectors (MCP)",
        description:
          "Register an MCP endpoint, discover its tools, run them manually.",
      },
      {
        title: "Umbra API",
        description: "OpenAI-compatible access for your own apps.",
      },
      {
        title: "Credits vault",
        description: "An encrypted, browser-only balance with a recovery file.",
      },
      {
        title: "Wallet reads",
        description: "Read-only ETH and USDG balances on Robinhood Chain.",
      },
      {
        title: "Docs",
        description: "How each surface works and where it runs.",
      },
      {
        title: "Agentic tool use",
        description:
          "Experimental: let a conversation choose and run connector tools.",
      },
      {
        title: "Web search",
        description:
          "Experimental: grounded answers with the same browser privacy boundary.",
      },
    ],
  },
  {
    status: "In progress / next",
    blurb: "Being worked on now.",
    items: [
      {
        title: "Smarter memory",
        description: "Suggest entries instead of relying on manual notes.",
      },
    ],
  },
  {
    status: "Planned",
    blurb: "Intended, without dates or promises.",
    items: [
      {
        title: "On-chain funding",
        description: "Top up credits on Robinhood Chain.",
      },
      {
        title: "API keys",
        description: "Persistent, revocable keys for the API.",
      },
      {
        title: "Optional accounts",
        description: "Opt-in sync, never required.",
      },
      {
        title: "$UMB",
        description:
          "Subject to technical and legal decisions; not a commitment.",
      },
    ],
  },
] as const;

const linkItem = (title: string) => {
  if (title === "Leak check") return <Link href="/leak-check">{title}</Link>;
  if (title === "Docs") return <Link href="/docs">{title}</Link>;
  return title;
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
              <p>{group.blurb}</p>
            </div>
            <div className="feature-grid">
              {group.items.map((item) => (
                <div className="feature" key={item.title}>
                  <h3>{linkItem(item.title)}</h3>
                  <p>{item.description}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
