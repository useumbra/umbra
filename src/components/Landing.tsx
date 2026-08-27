"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { brand } from "@/config/brand";
import { models } from "@/config/models";
import { Vault, redact } from "@/lib/privacy";
import { BoundaryArt } from "./BoundaryArt";
import { DemoVideo } from "./DemoVideo";
import { Header } from "./Header";
import { HeroSigil } from "./HeroSigil";
import { Marquee } from "./Marquee";
import { ModelHub } from "./ModelHub";
import { ProductShowcase } from "./ProductShowcase";
import { Reveal } from "./Reveal";
import { XIcon } from "./XIcon";
import { GitHubIcon } from "./GitHubIcon";

const marqueeItems = [
  ...models.slice(0, 8).map((model) => model.label),
  "Smart Privacy",
  "browser-only memory",
  "MCP connectors",
  "OpenAI-compatible API",
] as const;

const privacySample =
  "Hi, my name is John Smith, my email is john@example.com, my wallet is 0x1234567890123456789012345678901234567890 and I live in Lisbon.";
export function Landing() {
  const [mediaLive, setMediaLive] = useState(false);
  const [codeLive, setCodeLive] = useState(false);
  useEffect(() => {
    void fetch("/api/image")
      .then((response) => response.json() as Promise<{ stub?: boolean }>)
      .then((body) => setMediaLive(body.stub === false))
      .catch(() => setMediaLive(false));
    void fetch("/api/code")
      .then((response) => response.json() as Promise<{ stub?: boolean }>)
      .then((body) => setCodeLive(body.stub === false))
      .catch(() => setCodeLive(false));
  }, []);
  const mediaStatus = mediaLive ? "LIVE NOW" : "DEMO · STUB";
  const codeStatus = codeLive ? "LIVE NOW" : "DEMO · STUB";
  const privacyShowcase = redact(privacySample, new Vault(), "smart");
  const products = [
    [
      brand.products.chat,
      "A private workspace for everyday questions.",
      "LIVE NOW",
    ],
    [
      brand.products.image,
      mediaLive
        ? "Visual generation with the same boundary."
        : "Local image stub until a FAL_KEY provider is configured.",
      mediaStatus,
    ],
    [
      brand.products.video,
      mediaLive
        ? "Long-form creation with the same boundary."
        : "Local video frame stub until a FAL_KEY provider is configured.",
      mediaStatus,
    ],
    [
      brand.products.code,
      codeLive
        ? "A guarded pair-programming surface."
        : "A local project demo until an OpenRouter key is configured.",
      codeStatus,
    ],
    [
      brand.products.api,
      "OpenAI-compatible model access for builders.",
      "LIVE NOW",
    ],
  ] as const;
  return (
    <>
      <Header />
      <main className="shell">
        <section className="hero hero-split">
          <div className="hero-copy">
            <div className="hero-entrance hero-badges">
              <span className="eyebrow">
                Private intelligence / browser-first
              </span>
              <Link className="hero-pill" href="/docs">
                <span className="mark">◒</span>
                <span className="hero-pill-label">how privacy works</span>
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <h1 className="hero-entrance">
              Your thoughts.
              <br />
              <span style={{ color: "var(--accent)" }}>Kept yours.</span>
            </h1>
            <p className="hero-entrance">
              {brand.name} puts a clear boundary between your words and helpful
              models. Redact in your browser, get an answer, restore your
              context.
            </p>
            <div className="actions hero-entrance">
              <Link className="button" href={brand.appPath}>
                Try {brand.products.chat}
              </Link>
              <Link className="button secondary" href="/leak-check">
                Inspect a prompt
              </Link>
            </div>
            <div
              className="privacy-chips hero-entrance"
              aria-label="Privacy principles"
            >
              <span>zero retention</span>
              <span>no account</span>
              <span>no training on your data</span>
              <span>browser-only memory</span>
            </div>
          </div>
          <div className="hero-visual hero-entrance">
            <HeroSigil />
          </div>
        </section>
        <Marquee items={marqueeItems} />
        <Reveal className="section">
          <section>
            <div className="section-heading">
              <span className="eyebrow">The real thing</span>
              <h2>This is the actual app.</h2>
              <p>
                One prompt with a name, an email, and a city. Watch the receipt:
                the provider only ever saw placeholders.
              </p>
            </div>
            <DemoVideo />
            <p className="showcase-link">
              <Link href={brand.appPath}>Open {brand.products.chat} →</Link>
            </p>
          </section>
        </Reveal>
        <Reveal className="section">
          <section>
            <BoundaryArt />
          </section>
        </Reveal>
        <Reveal className="section">
          <section>
            <div className="section-heading">
              <h2>See the boundary before you trust it.</h2>
              <p>
                Umbra turns recognizable details into reversible placeholders in
                your browser before a provider sees the request.
              </p>
            </div>
            <div className="privacy-showcase">
              <div className="privacy-column">
                <span className="step-number">WHAT YOU WROTE</span>
                <p className="privacy-copy">{privacySample}</p>
              </div>
              <div className="privacy-column">
                <span className="step-number">WHAT THE MODEL SAW</span>
                <p className="privacy-copy">{privacyShowcase.text}</p>
              </div>
              <div className="privacy-receipt">
                <div>
                  <span className="step-number">LOCAL RECEIPT</span>
                  <p className="note">
                    {privacyShowcase.receipt.count} details protected in this
                    example.
                  </p>
                </div>
                <ul className="privacy-receipt-list">
                  {privacyShowcase.receipt.entities.map((entity, index) => (
                    <li key={`${entity.type}-${index}`}>
                      <span>{entity.type}</span>
                      <code>{entity.placeholder}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="showcase-link">
              <Link href="/leak-check">See what your own prompt reveals →</Link>
            </p>
          </section>
        </Reveal>
        <Reveal className="section">
          <section>
            <div className="section-heading">
              <h2>A quiet boundary around every conversation.</h2>
              <p>
                Nothing private needs to leave your device as readable text. The
                browser handles the sensitive part before a provider sees a
                request.
              </p>
            </div>
            <div className="boundary">
              <motion.div
                className="boundary-step"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <span className="step-number">01 / LOCAL</span>
                <h3>Redact</h3>
                <p>
                  Identity anchors become reversible placeholders on your
                  device.
                </p>
              </motion.div>
              <motion.div
                className="boundary-step"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                viewport={{ once: true }}
              >
                <span className="step-number">02 / PRIVATE</span>
                <h3>Send</h3>
                <p>Only the protected version travels to the selected model.</p>
              </motion.div>
              <motion.div
                className="boundary-step"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24 }}
                viewport={{ once: true }}
              >
                <span className="step-number">03 / CONTEXT</span>
                <h3>Restore</h3>
                <p>
                  Your browser puts your original context back into the answer.
                </p>
              </motion.div>
            </div>
          </section>
        </Reveal>
        <ProductShowcase />
        <Reveal className="section">
          <section>
            <div className="section-heading">
              <span className="eyebrow">One private layer</span>
              <h2>One boundary across every model.</h2>
              <p>
                Most apps hand you a single model. {brand.name} keeps one
                browser-side boundary in front of many models, tools, and
                surfaces.
              </p>
            </div>
            <ModelHub />
          </section>
        </Reveal>
        <Reveal className="section">
          <section>
            <div className="section-heading">
              <h2>One boundary. Many ways to make.</h2>
              <p>
                Bring the same browser-first boundary to conversations, media,
                projects, and your own tools.
              </p>
            </div>
            <div className="feature-grid">
              {products.map(([name, description, status]) => (
                <div className="feature" key={name}>
                  <span className="badge">{status}</span>
                  <h3>{name}</h3>
                  <p>
                    {description}{" "}
                    {name === brand.products.api && (
                      <Link href="/developers">Read the API guide →</Link>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
        <Reveal className="section">
          <section>
            <div className="models-strip">
              <div>
                <span className="eyebrow">Model shelf</span>
                <p>
                  {models.length} models, including{" "}
                  {models
                    .slice(0, 3)
                    .map((model) => model.label)
                    .join(", ")}
                  .
                </p>
              </div>
              <Link href="/developers">See all models and rates →</Link>
            </div>
          </section>
        </Reveal>
        <footer>
          <nav className="footer-links" aria-label="Umbra resources">
            <Link href="/connectors">Connectors</Link>
            <Link href="/credits">Credits</Link>
            <Link href="/developers">Developers</Link>
            <Link href="/roadmap">Roadmap</Link>
          </nav>
          <div className="footer-meta">
            <span>
              {brand.name} / {brand.domain} · Built for clearer boundaries.
            </span>{" "}
            <a
              href={brand.social.x.url}
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              aria-label={`${brand.name} on X`}
              title={brand.social.x.handle}
            >
              <XIcon />
            </a>
            <a
              href={brand.social.github.url}
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              aria-label={`${brand.name} on GitHub`}
              title={brand.social.github.handle}
            >
              <GitHubIcon />
            </a>
          </div>
        </footer>
      </main>
    </>
  );
}
