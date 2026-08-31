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
        description:
          "Context you write yourself, with browser-local suggestions from your wording.",
      },
      {
        title: "Voice",
        description:
          "Browser dictation and local read-aloud controls for chat replies.",
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
        title: "API keys",
        description:
          "Persistent browser-managed keys with server-side revocation.",
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
      {
        title: "$UMBRA tier check",
        description:
          "Read a wallet's $UMBRA balance on Robinhood Chain and see its tier; signed proofs unlock enforced limits.",
      },
      {
        title: "Holder API quota",
        description:
          "A signed wallet proof sets your key's tier and its enforced daily request quota.",
      },
      {
        title: "Holder limits",
        description:
          "A signed holder proof raises Council seats and the max-token ceiling in chat and UmbraCode.",
      },
      {
        title: "Holder priority routing",
        description:
          "A signed holder proof retries congested premium models and upgrades the auto route for Circle and Council.",
      },
    ],
  },
  {
    status: "Live now",
    blurb: "Available when the treasury is configured.",
    items: [
      {
        title: "On-chain funding",
        description:
          "Top up local credits with a verified USDG transfer on Robinhood Chain.",
      },
    ],
  },
  {
    status: "Planned",
    blurb: "Intended, without dates or promises.",
    items: [
      {
        title: "Optional accounts",
        description: "Opt-in sync, never required.",
      },
      {
        title: "$UMBRA credits",
        description:
          "Convert held $UMBRA into browser-side credits at a holder rate.",
      },
      {
        title: "Holder votes",
        description:
          "Vote on new providers and on which redaction detectors ship next.",
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
