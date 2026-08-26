import Link from "next/link";
import { brand } from "@/config/brand";
import { chainNetworks } from "@/config/chain";
import { Header } from "./Header";

const topics = [
  {
    title: "Getting started",
    content: (
      <>
        <p>
          There is no account to create and nothing to install. Open{" "}
          <Link href={brand.appPath}>{brand.products.chat}</Link>, pick a model,
          and start a conversation.
        </p>
        <p>
          Conversations live in this browser&apos;s IndexedDB storage and are
          not stored on an Umbra server.
        </p>
      </>
    ),
  },
  {
    title: "Smart Privacy",
    content: (
      <>
        <p>
          Smart Privacy detects identity anchors in your prompt in the browser,
          replaces them with reversible placeholders, and keeps the mapping in a
          vault for that conversation. Choose Smart, Full, or Off in the chat
          controls.
        </p>
        <p>
          A local receipt shows what was protected, and the browser restores
          your context when the model response comes back. Use{" "}
          <Link href="/leak-check">/leak-check</Link> to inspect your own prompt
          without sending it anywhere.
        </p>
        <p className="note">
          Detection and restoration happen in the browser; the current limit is
          that protection depends on the detectors and mode you choose.
        </p>
      </>
    ),
  },
  {
    title: "Attachments",
    content: (
      <>
        <p>
          Text, PDF, and image attachments are extracted and redacted in the
          browser before their contents are included in a provider request.
        </p>
        <p className="note">
          Attachment extraction is client-side and bounded by the limits shown
          in the chat surface; Umbra does not provide server-side file storage.
        </p>
      </>
    ),
  },
  {
    title: "Umbra Memory",
    content: (
      <>
        <p>
          Memory entries are things you write yourself. They are stored only in
          this browser, injected as a system message when enabled, and redacted
          through the same conversation vault before they are sent.
        </p>
        <p>
          Toggle Memory off to stop sending entries. This is manual context, not
          automatic learning or an automatic profile built from your
          conversations.
        </p>
      </>
    ),
  },
  {
    title: "Connectors (MCP)",
    content: (
      <>
        <p>
          Connectors are stored in this browser. The{" "}
          <Link href="/connectors">Connectors</Link> surface uses the{" "}
          <code>/api/mcp</code> proxy only to reach cross-origin endpoints; the
          proxy is stateless, accepts HTTPS URLs only, and permits initialize,
          tools/list, and tools/call.
        </p>
        <p>
          Discovery and invocation are manual today. Umbra does not
          automatically choose or run connector tools.
        </p>
      </>
    ),
  },
  {
    title: "Umbra API",
    content: (
      <>
        <p>
          Umbra exposes an OpenAI-compatible API at{" "}
          <code>{brand.apiBasePath}</code>. Authenticate with a key in the
          <code> Authorization: Bearer $UMBRA_API_KEY</code> header. The key is
          checked by the server against its configured API secret.
        </p>
        <pre className="panel docs-code">{`curl https://{your-domain}${brand.apiBasePath}/chat/completions \\
  -H "Authorization: Bearer $UMBRA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"umbra-auto","stream":true,"messages":[{"role":"user","content":"Hello"}]}'`}</pre>
        <p className="note">
          This route authenticates and routes requests server-side, but
          server-side redaction is not applied to API calls. Client applications
          own redaction before sending prompts.
        </p>
        <p>
          See the <Link href="/developers">developer guide</Link> for the token
          shape and the complete model and pricing details.
        </p>
      </>
    ),
  },
  {
    title: "Credits and chain",
    content: (
      <>
        <p>
          Credits are held in an encrypted, browser-only vault. You can export
          an encrypted recovery file or import one; Umbra never receives the
          passphrase or ledger.
        </p>
        <p>
          The credits surface can read wallet balances on{" "}
          {chainNetworks.mainnet.name} (chain ID {chainNetworks.mainnet.chainId}
          ) , including USDG at <code>{chainNetworks.mainnet.usdG}</code>. These
          wallet reads are read-only.
        </p>
        <p className="note">
          On-chain credit funding is not live yet. The local vault is not an
          on-chain balance.
        </p>
      </>
    ),
  },
  {
    title: "Privacy posture",
    content: (
      <>
        <p>
          Umbra has no account requirement and does not store browser
          conversations on a server. In browser chat, provider requests carry
          the protected text produced by the local privacy boundary.
        </p>
        <p className="note">
          The OpenAI-compatible API is a separate server endpoint: API clients
          are responsible for redacting their own prompts before sending them.
        </p>
      </>
    ),
  },
] as const;

export function Docs() {
  return (
    <div>
      <Header />
      <main className="shell docs-page">
        <section className="hero docs-hero">
          <div className="eyebrow">Umbra documentation</div>
          <h1>
            A clear guide to
            <br />
            <span style={{ color: "var(--accent)" }}>the boundary.</span>
          </h1>
          <p>
            Learn where Umbra keeps your data, what each surface does, and which
            capabilities are still local or limited.
          </p>
        </section>
        {topics.map((topic) => (
          <section className="section docs-section" key={topic.title}>
            <div className="section-heading">
              <h2>{topic.title}</h2>
              <p>What it does, where it runs, and its current limits.</p>
            </div>
            <div className="panel docs-copy">{topic.content}</div>
          </section>
        ))}
      </main>
    </div>
  );
}
