"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { XIcon } from "./XIcon";
import { GitHubIcon } from "./GitHubIcon";
import { Vault, redact, scoreLeaks } from "@/lib/privacy";
import { brand } from "@/config/brand";
const samples = {
  "job application":
    "Hi, I'm Maya Chen. Please send my resume to maya.chen@example.com and call me at +1 415 555 0199.",
  "health question":
    "I was diagnosed with asthma in London and my medication has made my symptoms worse.",
  "code debug":
    "The deploy uses 0x0123456789012345678901234567890123456789 and the API key sk-example-secret-token-123456789.",
};
export function LeakChecker() {
  const [text, setText] = useState("");
  const result = useMemo(() => scoreLeaks(text), [text]);
  const protectedView = useMemo(
    () => redact(text, new Vault(), "smart").text,
    [text],
  );
  return (
    <>
      <main className="shell">
        <section
          className="hero"
          style={{ paddingBottom: 65, textAlign: "left" }}
        >
          <div className="eyebrow">Local diagnostic</div>
          <h1 style={{ marginLeft: 0, fontSize: "clamp(50px, 8vw, 88px)" }}>
            See what
            <br />
            <span style={{ color: "var(--accent)" }}>could leak.</span>
          </h1>
          <p style={{ marginLeft: 0 }}>
            Paste a prompt and get a private, in-browser readout. Nothing is
            sent while you inspect it.
          </p>
        </section>
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="sample-row">
            {Object.entries(samples).map(([label, sample]) => (
              <button
                className="sample"
                key={label}
                onClick={() => setText(sample)}
              >
                Try {label}
              </button>
            ))}
          </div>
          <div className="leak-layout">
            <div className="panel">
              <div className="eyebrow">Your text · 10,000 character limit</div>
              <textarea
                maxLength={10000}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste a prompt, note, or message here…"
              />
              <div className="note">
                {text.length.toLocaleString()} / 10,000
              </div>
            </div>
            <div className="panel">
              <div className="eyebrow">Exposure score</div>
              <div className="score">
                {result.score}
                <span className="score-suffix">/100</span>
              </div>
              <div className="gauge">
                <i style={{ width: `${result.score}%` }} />
              </div>
              <p className="note">
                {result.score
                  ? `${result.findings.length} signal${result.findings.length === 1 ? "" : "s"} found. Review before sharing.`
                  : "No obvious sensitive signals found."}
              </p>
              <h3>What a model would see</h3>
              <div className="message-bubble" style={{ minHeight: 100 }}>
                {protectedView || (
                  <span className="note">
                    Your protected preview appears here.
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
        <section className="section">
          <div className="section-heading">
            <h2>Findings, grouped by risk.</h2>
            <p>
              Detection runs locally and is designed to help you make an
              informed choice, not to judge your words.
            </p>
          </div>
          {(["high", "medium", "low"] as const).map((severity) => (
            <div key={severity} style={{ marginBottom: 28 }}>
              <div className="eyebrow">
                {severity} · {result.bySeverity[severity].length}
              </div>
              {result.bySeverity[severity].map((finding) => (
                <div
                  className="finding"
                  key={`${finding.start}-${finding.type}`}
                >
                  <span>
                    <strong>{finding.type}</strong> · {finding.value}
                  </span>
                  <span>
                    {Math.round(finding.confidence * 100)}% confidence
                  </span>
                </div>
              ))}
            </div>
          ))}
        </section>
        <footer>
          <span>
            <Link href="/">← Back to {brand.name}</Link>
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
        </footer>
      </main>
    </>
  );
}
