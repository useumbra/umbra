import { brand } from "@/config/brand";
import { models } from "@/config/models";
import { Header } from "@/components/Header";
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
          <h2>Get a development key.</h2>
          <p>
            Set <code>UMBRA_API_SECRET</code> on the server, then sign a
            short-lived token locally. The token is a base64url JSON claims
            payload followed by an HMAC-SHA256 signature, separated by a dot.
          </p>
          <pre className={styles.code}>{`export UMBRA_API_SECRET="replace-me"
node - <<'NODE'
const crypto = require("node:crypto");
const now = Math.floor(Date.now() / 1000);
const payload = Buffer.from(JSON.stringify({
  sub: "developer", iat: now, exp: now + 86400
})).toString("base64url");
const signature = crypto.createHmac("sha256", process.env.UMBRA_API_SECRET)
  .update(payload).digest("base64url");
console.log(payload + "." + signature);
NODE`}</pre>
          <p className="note">
            In local development without <code>UMBRA_API_SECRET</code>, Umbra
            generates an ephemeral secret and prints a warning. Tokens from that
            process stop working after restart.
          </p>
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
          <table className={styles.table}>
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
                    <strong>{model.id}</strong>
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
          <p className="note">
            Credits are indicative local test pricing. On-chain funding is not
            connected in this MVP.
          </p>
        </section>
      </main>
    </div>
  );
}
