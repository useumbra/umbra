import { brand } from "@/config/brand";
import { models } from "@/config/models";
import { ApiKeysPanel } from "@/components/ApiKeysPanel";
import { Header } from "@/components/Header";
import { HolderTier } from "@/components/HolderTier";
import styles from "@/components/Developers.module.css";

const baseUrl = `https://{your-domain}${brand.apiBasePath}`;

export default function DevelopersPage() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={`shell ${styles.content}`}>
        <div className="eyebrow">Build with Umbra</div>
        <h1 style={{ marginLeft: 0, fontSize: "clamp(50px, 8vw, 88px)" }}>
          A familiar API boundary.
        </h1>
        <p className={styles.intro}>
          Use OpenAI-compatible clients with Umbra&apos;s model registry. Your
          API key authorizes requests; prompts are never logged.
        </p>
        <section className="section" style={{ paddingTop: 35 }}>
          <h2>Your API keys.</h2>
          <p>
            Create persistent keys for the OpenAI-compatible API. Keys are
            revocable and the full value is kept only in this browser. The
            server stores a short-lived revocation entry, not the key itself.
          </p>
          <ApiKeysPanel />
          <p className="note">
            In self-hosted deployments, signing a token with
            <code> UMBRA_API_SECRET</code> still works for direct
            administration. Local development without that secret uses an
            ephemeral process secret.
          </p>
        </section>
        <section className="section" style={{ paddingTop: 35 }}>
          <h2>Holder tier.</h2>
          <p>
            Umbra reads your $UMBRA balance on Robinhood Chain to show which
            tier you would be in. Holder quotas on the API are not enforced yet.
          </p>
          <HolderTier />
        </section>
        <section className="section" style={{ paddingTop: 35 }}>
          <h2>Chat completions.</h2>
          <pre className={styles.code}>{`curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer $UMBRA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"umbra-auto","stream":true,"messages":[{"role":"user","content":"Hello"}]}'`}</pre>
          <pre className={styles.code}>{`from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key=os.environ["UMBRA_API_KEY"],
)
response = client.chat.completions.create(
    model="umbra-auto",
    messages=[{"role": "user", "content": "Hello"}],
)
print(response.choices[0].message.content)`}</pre>
          <p className="note">
            The base URL is <code>{brand.apiBasePath}</code> relative to your
            Umbra host. Set it from your deployment origin rather than
            hardcoding a local port.
          </p>
          <p>
            <strong>Privacy boundary:</strong> server-side redaction is not
            applied to API calls. Client applications own redaction before
            sending requests to this endpoint.
          </p>
        </section>
        <section className="section" style={{ paddingTop: 35 }}>
          <h2>Models and indicative credits.</h2>
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
                    <td>{model.contextWindow.toLocaleString()}</td>
                    <td>{model.creditPricing.inPer1M.toFixed(2)} cr</td>
                    <td>{model.creditPricing.outPer1M.toFixed(2)} cr</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Credits are indicative local test pricing. On-chain funding is not
            connected in this MVP.
          </p>
        </section>
      </main>
    </div>
  );
}
