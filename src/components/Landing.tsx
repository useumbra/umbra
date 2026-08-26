"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { brand } from "@/config/brand";
import { chainNetworks } from "@/config/chain";
import { models } from "@/config/models";
import { Header } from "./Header";
export function Landing() {
  const products = [
    [brand.products.chat, "A private workspace for everyday questions.", true],
    [brand.products.image, "Visual generation with the same boundary.", false],
    [brand.products.video, "Long-form creation, coming into focus.", false],
    [brand.products.code, "A guarded pair-programming surface.", false],
    [brand.products.pay, "Programmable credits for your workflow.", false],
    [brand.products.api, "Privacy-first model access for builders.", false],
  ] as const;
  return (
    <>
      <Header />
      <main className="shell">
        <section className="hero">
          <div className="eyebrow">
            Private intelligence / {chainNetworks.mainnet.name}
          </div>
          <h1>
            Your thoughts.
            <br />
            <span style={{ color: "var(--accent)" }}>Kept yours.</span>
          </h1>
          <p>
            {brand.name} puts a clear privacy boundary between your words and
            the models that help you shape them. Redact in your browser, get an
            answer, restore your context.
          </p>
          <div className="actions">
            <Link className="button" href={brand.appPath}>
              Try {brand.products.chat}
            </Link>
            <Link className="button secondary" href="/leak-check">
              Inspect a prompt
            </Link>
          </div>
        </section>
        <section className="section">
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
            >
              <span className="step-number">01 / LOCAL</span>
              <h3>Redact</h3>
              <p>
                Identity anchors become reversible placeholders on your device.
              </p>
            </motion.div>
            <motion.div
              className="boundary-step"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
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
            >
              <span className="step-number">03 / CONTEXT</span>
              <h3>Restore</h3>
              <p>
                Your browser puts your original context back into the answer.
              </p>
            </motion.div>
          </div>
        </section>
        <section className="section">
          <div className="section-heading">
            <h2>One boundary. Many ways to make.</h2>
            <p>
              Start with chat today. The rest of the suite is marked clearly
              while it is being built.
            </p>
          </div>
          <div className="feature-grid">
            {products.map(([name, description, live]) => (
              <div className="feature" key={name}>
                <span className="badge">
                  {live ? "LIVE NOW" : "COMING SOON"}
                </span>
                <h3>{name}</h3>
                <p>{description}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="section">
          <div className="section-heading">
            <h2>Choose the right mind for the job.</h2>
            <p>
              Model access and pricing are shown transparently. Rates below are
              indicative credits per million tokens, not a payment feature yet.
            </p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="price-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Context</th>
                  <th>Input / 1M</th>
                  <th>Output / 1M</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <tr key={model.id}>
                    <td>
                      <strong>{model.label}</strong>
                      <br />
                      <span className="note">{model.description}</span>
                    </td>
                    <td>{(model.contextWindow / 1000).toLocaleString()}k</td>
                    <td>{model.creditPricing.inPer1M.toFixed(2)} cr</td>
                    <td>{model.creditPricing.outPer1M.toFixed(2)} cr</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="section">
          <div className="section-heading">
            <h2>Credits with a clear destination.</h2>
            <p>
              Payments are planned, not live in this MVP. When enabled, credits
              will be funded with USDG (Global Dollar) or {brand.token} on{" "}
              {brand.chain.name}.
            </p>
          </div>
          <p className="note">
            The canonical stablecoin is resolved by its contract address, not a
            ticker. Mainnet USDG: <code>{chainNetworks.mainnet.usdG}</code>.{" "}
            {brand.chain.name} is an Arbitrum Orbit L2 using ETH for gas.
          </p>
          <div
            className="actions"
            style={{ justifyContent: "flex-start", marginTop: 28 }}
          >
            <Link className="button" href={brand.appPath}>
              Open the workspace
            </Link>
          </div>
        </section>
        <footer>
          <span>
            {brand.name} / {brand.domain}
          </span>
          <span style={{ float: "right" }}>Built for clearer boundaries.</span>
        </footer>
      </main>
    </>
  );
}
