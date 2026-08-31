"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { brand } from "@/config/brand";
import { chainNetworks } from "@/config/chain";
import { Header } from "./Header";

const toc = [
  ["overview", "Overview"],
  ["privacy-model", "Privacy model"],
  ["chat-routing", "Chat and routing"],
  ["local-storage", "Local storage and memory"],
  ["attachments", "Attachments"],
  ["connectors", "Connectors (MCP)"],
  ["umbracode", "UmbraCode"],
  ["api", "API"],
  ["credits", "Credits and funding"],
  ["limits", "Limits and status"],
] as const;

const apiBaseUrl = `https://{your-domain}${brand.apiBasePath}`;

export function Docs() {
  const [activeSection, setActiveSection] = useState<string>(toc[0][0]);

  useEffect(() => {
    const sections = toc
      .map(([id]) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => b.boundingClientRect.top - a.boundingClientRect.top,
          )[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-8% 0px -72% 0px", threshold: [0, 0.1, 0.5] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      <Header />
      <main className="shell docs-page">
        <section className="docs-masthead">
          <div className="eyebrow">UMBRA DOCS / V1 / SYSTEM SPECIFICATION</div>
          <h1>
            Private intelligence,
            <br />
            <span>specified.</span>
          </h1>
          <p className="docs-abstract">
            Umbra is a browser-first private AI workspace. Redaction happens on
            your device, conversations and credits stay in the browser, models
            are swappable, and USDG funding settles on Robinhood Chain when a
            treasury is configured.
          </p>
          <div className="actions docs-actions">
            <Link className="button" href={brand.appPath}>
              Launch Umbra
            </Link>
            <a
              className="button secondary"
              href={brand.social.github.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Source on GitHub
            </a>
            <Link className="button secondary" href="/leak-check">
              Inspect a prompt
            </Link>
          </div>
          <div className="docs-meta-grid">
            <div>
              <span>Maintainer</span>
              <strong>useumbra</strong>
            </div>
            <div>
              <span>System class</span>
              <strong>
                Browser-first private AI workspace on Cloudflare Workers
              </strong>
            </div>
            <div>
              <span>Hard constraints</span>
              <strong>
                No account · no server-side conversation storage · no training
                on user data
              </strong>
            </div>
            <div>
              <span>Scope</span>
              <strong>
                Privacy boundary, local state, routing, tools, API, and funding
              </strong>
            </div>
          </div>
        </section>

        <div className="docs-layout">
          <aside className="docs-toc" aria-label="Documentation sections">
            <div className="docs-toc-label">Contents</div>
            <nav>
              {toc.map(([id, title], index) => (
                <a
                  href={`#${id}`}
                  key={id}
                  className={activeSection === id ? "is-active" : undefined}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="docs-content">
            <section className="docs-spec-section" id="overview">
              <SectionHeading number="01" title="Overview">
                The boundary is local; the providers are replaceable.
              </SectionHeading>
              <div className="docs-copy">
                <p>
                  Umbra is a private AI workspace for asking questions, making
                  images and video, writing code, and connecting your own tools.
                  It is not a model, an account system, or a server-side archive
                  of your conversations.
                </p>
                <p>
                  In browser chat, Smart Privacy detects recognizable details
                  before the request leaves your device. A provider receives the
                  redacted text; the browser keeps the reversible mapping and
                  restores your context when the response returns.
                </p>
                <div className="docs-callout">
                  <span className="step-number">THREAT BOUNDARY</span>
                  <p>
                    Umbra reduces exposure at the browser boundary. It cannot
                    guarantee that every sensitive detail is detected, and it
                    does not redact API clients on their behalf.
                  </p>
                </div>
              </div>
            </section>

            <section className="docs-spec-section" id="privacy-model">
              <SectionHeading number="02" title="Privacy model">
                Detect locally, substitute reversibly, restore locally.
              </SectionHeading>
              <div className="docs-copy">
                <p>
                  Smart Privacy is the default. Full adds lower-confidence
                  contextual categories, while Off leaves the prompt unchanged.
                  The detector set covers names, email addresses, phone numbers,
                  locations, URLs, IP addresses, EVM addresses and transaction
                  hashes, secrets, financial identifiers, organizations, money,
                  dates of birth, and health terms.
                </p>
                <div className="docs-two-column">
                  <div>
                    <h3>Mode matrix</h3>
                    <div className="docs-table-wrap">
                      <table className="docs-table">
                        <thead>
                          <tr>
                            <th>Mode</th>
                            <th>Behavior</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Smart</td>
                            <td>Protects identity and high-signal details.</td>
                          </tr>
                          <tr>
                            <td>Full</td>
                            <td>
                              Adds contextual and lower-confidence categories.
                            </td>
                          </tr>
                          <tr>
                            <td>Off</td>
                            <td>
                              Sends the text without browser substitutions.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="docs-example">
                    <h3>Placeholder contract</h3>
                    <pre className="docs-code">{`Avery Chen → [PERSON_1]
avery@example.com → [EMAIL_1]
0x1234…7890 → [WALLET_1]
Lisbon → [LOCATION_1]`}</pre>
                  </div>
                </div>
                <p>
                  Each replacement is recorded in a local receipt. When the
                  response arrives, the browser restores placeholders such as
                  <code> [PERSON_1]</code> and <code>[EMAIL_1]</code> from the
                  conversation vault. The{" "}
                  <Link href="/leak-check">Leak check</Link> surface lets you
                  inspect a prompt without sending it anywhere.
                </p>
                <div className="docs-callout">
                  <span className="step-number">LIMITS</span>
                  <p>
                    Detection is heuristic. Coverage changes with the selected
                    mode and detector categories, and unusual phrasing or unseen
                    formats can pass through. Review the local receipt before
                    trusting a protected request.
                  </p>
                </div>
              </div>
            </section>

            <section className="docs-spec-section" id="chat-routing">
              <SectionHeading number="03" title="Chat and routing">
                One local boundary in front of many models and controls.
              </SectionHeading>
              <div className="docs-copy">
                <p>
                  UmbraChat can use the configured model catalog directly or
                  choose with <code>umbra-auto</code>. The router considers the
                  prompt and available model capabilities; a selected model is
                  shown with the response.
                </p>
                <p>
                  The Tune panel exposes temperature, reasoning effort where a
                  model supports it, and optional web search. Search results
                  include URL citations beneath the answer. UmbraCouncil sends
                  one browser-redacted brief to up to three seats in parallel;
                  council runs remain in memory and are not saved as
                  conversations.
                </p>
                <p>
                  The <Link href="/models">model catalog</Link> lists the
                  configured models, context windows, pricing, and declared
                  capabilities. The <Link href="/usage">usage dashboard</Link>{" "}
                  stores only provider-reported accounting by day and model.
                </p>
              </div>
            </section>

            <section className="docs-spec-section" id="local-storage">
              <SectionHeading number="04" title="Local storage and memory">
                Browser state is useful, portable by export, and not synced.
              </SectionHeading>
              <div className="docs-copy">
                <p>
                  Conversations, manually written memory entries, settings,
                  usage records, connector registrations, and API key records
                  use IndexedDB in this browser. Memory is optional manual
                  context, not automatic learning or a profile inferred from
                  your conversations.
                </p>
                <p>
                  The credits vault is encrypted with Web Crypto and can be
                  exported as an encrypted recovery file. A wipe-data control
                  clears local application state. There is no sync service:
                  switching browsers or devices does not bring these records
                  with you unless you explicitly export and import the relevant
                  recovery data.
                </p>
                <div className="docs-callout">
                  <span className="step-number">STORAGE POSTURE</span>
                  <p>
                    Clearing local data, losing a recovery file, or losing
                    access to this browser can make local conversations, memory,
                    keys, and displayed credits unavailable.
                  </p>
                </div>
              </div>
            </section>

            <section className="docs-spec-section" id="attachments">
              <SectionHeading number="05" title="Attachments">
                Extract in the browser, redact before a provider sees text.
              </SectionHeading>
              <div className="docs-copy">
                <p>
                  Text files (<code>.txt</code>, <code>.md</code>,{" "}
                  <code>.csv</code>, and <code>.json</code>), PDFs, and images
                  can be attached in Chat. Text and PDF content is extracted in
                  the browser; image data is passed only to models that declare
                  vision support.
                </p>
                <p>
                  Extracted text uses the same privacy boundary as the prompt.
                  The combined extracted text sent for a turn is capped at
                  120,000 characters, and the chat surface marks truncated
                  attachments. Umbra does not provide server-side file storage.
                </p>
              </div>
            </section>

            <section className="docs-spec-section" id="connectors">
              <SectionHeading number="06" title="Connectors (MCP)">
                Bring an HTTPS MCP endpoint into the browser-local workspace.
              </SectionHeading>
              <div className="docs-copy">
                <p>
                  The <Link href="/connectors">Connectors</Link> surface stores
                  endpoint registrations in this browser and uses the{" "}
                  <code>/api/mcp</code> proxy for cross-origin requests. The
                  proxy accepts HTTPS URLs and supports initialize, tools/list,
                  and tools/call operations.
                </p>
                <p>
                  Discover tools and run them manually from the connector
                  surface. Optional agentic tool use can ask the model to choose
                  from discovered tools, with a maximum of three tool rounds in
                  a turn. Arguments are restored before a connector call and
                  results are redacted before returning to the model.
                </p>
                <div className="docs-callout">
                  <span className="step-number">EXPERIMENTAL</span>
                  <p>
                    Agentic tool use is experimental and has not been tested
                    against a third-party MCP server.
                  </p>
                </div>
                <div className="docs-callout">
                  <strong>Built-in Venice tools</strong>
                  <p>
                    Umbra also exposes its own Venice-backed MCP endpoint at{" "}
                    <code>/api/mcp/venice</code>. Send{" "}
                    <code>Authorization: Bearer &lt;Umbra API key&gt;</code>{" "}
                    using a key from <Link href="/developers">Developers</Link>.
                    It provides exactly three tools:{" "}
                    <code>venice_web_answer</code>,{" "}
                    <code>venice_characters_search</code>, and{" "}
                    <code>venice_models</code>. Arguments leave the browser
                    after redaction, and calls spend Umbra&apos;s Venice credit.
                  </p>
                </div>
              </div>
            </section>

            <section className="docs-spec-section" id="umbracode">
              <SectionHeading number="07" title="UmbraCode">
                Describe a build, then inspect it inside an isolated preview.
              </SectionHeading>
              <div className="docs-copy">
                <p>
                  UmbraCode turns a product idea into project files through the
                  configured coding model. Its preview renders those files in an
                  isolated sandboxed iframe rather than mixing generated markup
                  into the workspace page.
                </p>
                <p>
                  The surface is designed for iterative prompts, file
                  inspection, and a live preview. It does not promise a
                  production deployment or replace a project&apos;s own security
                  review.
                </p>
              </div>
            </section>

            <section className="docs-spec-section" id="api">
              <SectionHeading number="08" title="API">
                An OpenAI-compatible interface for builders who own the client
                boundary.
              </SectionHeading>
              <div className="docs-copy">
                <p>
                  The API is available at <code>{brand.apiBasePath}</code>{" "}
                  relative to your Umbra host. Create persistent keys from{" "}
                  <Link href="/developers">Developers</Link>; keys can be
                  revoked there or through the revoke endpoint. The full key is
                  returned once and stored only in the browser that created it.
                </p>
                <p>
                  There are no accounts, so possession of a key is the
                  authorization to revoke it. API requests are not browser chat:
                  client applications must redact their own prompts before
                  sending them.
                </p>
                <p>
                  A signed holder proof can attach a verified $UMBRA tier to a
                  new key. Each key then has an enforced daily quota: 200 for
                  Base, 1,000 for Holder, 5,000 for Circle, and 20,000 for
                  Council.
                </p>
                <pre className="docs-code panel">{`curl ${apiBaseUrl}/chat/completions \\
  -H "Authorization: Bearer $UMBRA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"umbra-auto","stream":false,"messages":[{"role":"user","content":"Hello"}]}'`}</pre>
                <pre className="docs-code panel">{`const response = await fetch("${apiBaseUrl}/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.UMBRA_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "umbra-auto",
    stream: false,
    messages: [{ role: "user", content: "Hello" }],
  }),
});
const completion = await response.json();
console.log(completion.choices[0].message.content);`}</pre>
                <div className="docs-table-wrap">
                  <table className="docs-table">
                    <thead>
                      <tr>
                        <th>Method</th>
                        <th>Path</th>
                        <th>Purpose</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>POST</td>
                        <td>
                          <code>/chat/completions</code>
                        </td>
                        <td>Stream or return a routed completion.</td>
                      </tr>
                      <tr>
                        <td>GET</td>
                        <td>
                          <code>/models</code>
                        </td>
                        <td>List configured models and capabilities.</td>
                      </tr>
                      <tr>
                        <td>POST</td>
                        <td>
                          <code>/keys</code>
                        </td>
                        <td>Create a key from a label and expiry window.</td>
                      </tr>
                      <tr>
                        <td>POST</td>
                        <td>
                          <code>/keys/revoke</code>
                        </td>
                        <td>Revoke a possessed key.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="note">
                  Self-hosters can still sign tokens directly with{" "}
                  <code>UMBRA_API_SECRET</code>. The API server does not store
                  prompt or response text.
                </p>
              </div>
            </section>

            <section className="docs-spec-section" id="credits">
              <SectionHeading number="09" title="Credits and on-chain funding">
                A local ledger can be funded by a verified USDG transfer.
              </SectionHeading>
              <div className="docs-copy">
                <p>
                  Credits are held in an encrypted, browser-only vault. The
                  Credits surface reads wallet balances on{" "}
                  {chainNetworks.mainnet.name} and, when a treasury is
                  configured, sends USDG to that treasury. After confirmation,
                  the browser verifies the receipt through the public RPC and
                  grants matching local credits once per transaction hash.
                </p>
                <p>
                  Sending USDG transfers real funds. It does not create an
                  account or imply refunds. The treasury address is public build
                  configuration from <code>NEXT_PUBLIC_UMBRA_TREASURY</code>;
                  when it is absent, the top-up form remains unavailable.
                </p>
                <div className="docs-table-wrap">
                  <table className="docs-table">
                    <thead>
                      <tr>
                        <th>Chain fact</th>
                        <th>Configured value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Network / chain ID</td>
                        <td>
                          {chainNetworks.mainnet.name} ·{" "}
                          {chainNetworks.mainnet.chainId}
                        </td>
                      </tr>
                      <tr>
                        <td>RPC</td>
                        <td>
                          <code>{chainNetworks.mainnet.rpc}</code>
                        </td>
                      </tr>
                      <tr>
                        <td>Explorer</td>
                        <td>
                          <code>{chainNetworks.mainnet.explorer}</code>
                        </td>
                      </tr>
                      <tr>
                        <td>USDG contract</td>
                        <td>
                          <code>{chainNetworks.mainnet.usdG}</code>
                        </td>
                      </tr>
                      <tr>
                        <td>Treasury</td>
                        <td>
                          <code>
                            {chainNetworks.mainnet.treasury ??
                              "Not configured in this build"}
                          </code>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="note">
                  Clearing local data or losing the recovery file loses the
                  displayed local balance. Umbra does not hold an account
                  balance on your behalf.
                </p>
              </div>
            </section>

            <section className="docs-spec-section" id="limits">
              <SectionHeading number="10" title="Limits and honest status">
                The useful boundary includes knowing what is not implemented.
              </SectionHeading>
              <div className="docs-copy">
                <div className="docs-table-wrap">
                  <table className="docs-table">
                    <thead>
                      <tr>
                        <th>Feature</th>
                        <th>Status</th>
                        <th>Current statement</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Accounts and cross-device sync</td>
                        <td>
                          <Status>Not implemented</Status>
                        </td>
                        <td>State remains local to each browser.</td>
                      </tr>
                      <tr>
                        <td>Voice</td>
                        <td>
                          <Status>Not implemented</Status>
                        </td>
                        <td>
                          No voice capture or playback surface is shipped.
                        </td>
                      </tr>
                      <tr>
                        <td>Conversation sharing</td>
                        <td>
                          <Status>Not implemented</Status>
                        </td>
                        <td>Conversations have no public sharing link.</td>
                      </tr>
                      <tr>
                        <td>$UMBRA tier check</td>
                        <td>
                          <Status>Live</Status>
                        </td>
                        <td>
                          Reads a wallet&apos;s $UMBRA balance through the
                          public Robinhood Chain RPC and can verify ownership
                          with a signed wallet message; additional holder perks
                          remain unimplemented.
                        </td>
                      </tr>
                      <tr>
                        <td>Holder API quota</td>
                        <td>
                          <Status>Live</Status>
                        </td>
                        <td>
                          Signed wallet proof sets a key&apos;s tier; daily
                          request quota per key is 200 (base), 1,000 (Holder),
                          5,000 (Circle), 20,000 (Council).
                        </td>
                      </tr>
                      <tr>
                        <td>Holder limits</td>
                        <td>
                          <Status>Live</Status>
                        </td>
                        <td>
                          A signed holder proof raises Council seats (5 on
                          Circle and Council) and the max-token ceiling in chat
                          and UmbraCode.
                        </td>
                      </tr>
                      <tr>
                        <td>$UMBRA token</td>
                        <td>
                          <Status>Planned</Status>
                        </td>
                        <td>
                          Contract is live on Robinhood Chain; no token utility
                          or transfer flow is implemented in the app.
                        </td>
                      </tr>
                      <tr>
                        <td>Agentic MCP tool use</td>
                        <td>
                          <Status>Experimental</Status>
                        </td>
                        <td>
                          Available with a three-round cap; third-party MCP
                          coverage is untested.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p>
                  Provider availability, model capabilities, browser storage,
                  detector coverage, and local credentials can all affect a
                  result. This specification describes the shipped boundary, not
                  a guarantee that every provider or browser behaves the same
                  way.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function SectionHeading({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: string;
}) {
  return (
    <div className="docs-section-heading">
      <div className="docs-section-number">{number}</div>
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </div>
  );
}

function Status({ children }: { children: string }) {
  return <span className="docs-status">{children}</span>;
}
