import Link from "next/link";
import { brand } from "@/config/brand";
import { Reveal } from "./Reveal";

function ChatMock() {
  return (
    <div
      className="mock"
      role="img"
      aria-label={`${brand.products.chat} interface preview`}
    >
      <div className="mock-bar">
        <span className="mock-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="mock-title">
          {brand.wordmark} · chat
          <span className="mock-pill">Smart Privacy</span>
        </span>
      </div>
      <div className="mock-body mock-chat">
        <p className="mock-bubble">
          Draft a reply for Maria Alves about the Lisbon lease.
        </p>
        <p className="mock-route">{brand.wordmark} · auto → protected prompt</p>
        <p className="mock-answer">
          Here is a reply that keeps your position clear while the details you
          redacted stay on your device…
        </p>
        <div className="mock-composer">
          <span className="mock-select">auto ▾</span>
          <span className="mock-input">Ask anything, privately.</span>
          <span className="mock-send" aria-hidden="true">
            ↑
          </span>
        </div>
      </div>
    </div>
  );
}

function CodeMock() {
  return (
    <div
      className="mock"
      role="img"
      aria-label={`${brand.products.code} interface preview`}
    >
      <div className="mock-bar">
        <span className="mock-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="mock-title">
          {brand.wordmark}code / project / landing-page
        </span>
      </div>
      <div className="mock-body mock-code">
        <div className="mock-files">
          <span className="mock-file">index.html</span>
          <span className="mock-file">styles.css</span>
          <span className="mock-file">script.js</span>
          <span className="mock-log">plan → files → preview</span>
        </div>
        <div className="mock-preview">
          <p className="mock-preview-title">Build things that feel alive.</p>
          <p className="mock-preview-copy">
            A generated landing page, rendered in a sandboxed frame.
          </p>
          <span className="mock-preview-button">Get started</span>
        </div>
      </div>
    </div>
  );
}

export function ProductShowcase() {
  return (
    <>
      <Reveal className="section">
        <div className="showcase">
          <div className="showcase-copy">
            <span className="eyebrow">{brand.products.chat.toUpperCase()}</span>
            <h2>
              Ask anything,
              <br />
              <span style={{ color: "var(--accent)" }}>privately.</span>
            </h2>
            <p>
              Route across frontier and open models, keep every conversation in
              this browser, and watch Smart Privacy hide your identity anchors
              before a provider sees them.
            </p>
            <Link className="button" href={brand.appPath}>
              Open {brand.products.chat} →
            </Link>
          </div>
          <div className="showcase-visual">
            <ChatMock />
            <p className="mock-caption">
              redact in the browser → answer → restore your context
            </p>
          </div>
        </div>
      </Reveal>
      <Reveal className="section">
        <div className="showcase reverse">
          <div className="showcase-copy">
            <span className="eyebrow">{brand.products.code.toUpperCase()}</span>
            <h2>
              Describe an idea.
              <br />
              <span style={{ color: "var(--accent)" }}>See it running.</span>
            </h2>
            <p>
              Give {brand.products.code} a product idea and it writes the files,
              then serves them straight into a sandboxed browser preview you can
              keep refining.
            </p>
            <Link className="button" href="/code">
              Build with {brand.products.code} →
            </Link>
          </div>
          <div className="showcase-visual">
            <CodeMock />
            <p className="mock-caption">
              one prompt → working files → live browser preview
            </p>
          </div>
        </div>
      </Reveal>
    </>
  );
}
