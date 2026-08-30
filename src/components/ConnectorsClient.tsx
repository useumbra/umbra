"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getConnectors,
  saveConnectors,
  type Connector,
  type McpTool,
} from "@/lib/connectors";
import styles from "./ConnectorsClient.module.css";

const id = () => Math.random().toString(36).slice(2);

type ConnectorDraft = Omit<Connector, "id" | "tools">;

const emptyDraft: ConnectorDraft = { name: "", url: "" };

const errorText = async (response: Response) => {
  const body = await response.text();
  try {
    return JSON.stringify(JSON.parse(body));
  } catch {
    return body;
  }
};

export function ConnectorsClient() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [draft, setDraft] = useState<ConnectorDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string>();
  const [message, setMessage] = useState("");
  const [veniceApiKey, setVeniceApiKey] = useState("");
  const [busyId, setBusyId] = useState<string>();
  const [argumentsByTool, setArgumentsByTool] = useState<
    Record<string, string>
  >({});
  const [results, setResults] = useState<Record<string, string>>({});
  useEffect(() => {
    void getConnectors().then(setConnectors);
  }, []);
  const persist = async (next: Connector[]) => {
    const saved = await saveConnectors(next);
    setConnectors(saved);
  };
  const addVeniceConnector = async (event: React.FormEvent) => {
    event.preventDefault();
    const key = veniceApiKey.trim();
    if (!key) {
      setMessage("Enter an Umbra API key to add Venice tools.");
      return;
    }
    await persist([
      {
        id: id(),
        name: "Venice tools",
        url: `${window.location.origin}/api/mcp/venice`,
        headerName: "Authorization",
        headerValue: `Bearer ${key}`,
      },
      ...connectors,
    ]);
    setVeniceApiKey("");
    setMessage(
      "Venice tools added. The connector and key are stored only in this browser.",
    );
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.url.trim()) return;
    const next: Connector = {
      id: editingId ?? id(),
      name: draft.name.trim(),
      url: draft.url.trim(),
      ...(draft.headerName?.trim()
        ? { headerName: draft.headerName.trim() }
        : {}),
      ...(draft.headerValue ? { headerValue: draft.headerValue } : {}),
      ...(editingId
        ? { tools: connectors.find((item) => item.id === editingId)?.tools }
        : {}),
    };
    await persist(
      editingId
        ? connectors.map((item) => (item.id === editingId ? next : item))
        : [next, ...connectors],
    );
    setDraft(emptyDraft);
    setEditingId(undefined);
    setMessage("Connector saved only in this browser.");
  };
  const invoke = async (
    connector: Connector,
    method: "initialize" | "tools/list" | "tools/call",
    params: unknown,
  ) => {
    const response = await fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: connector.url,
        method,
        params,
        ...(connector.headerName && connector.headerValue
          ? {
              header: {
                name: connector.headerName,
                value: connector.headerValue,
              },
            }
          : {}),
      }),
    });
    if (!response.ok) throw new Error(await errorText(response));
    return (await response.json()) as unknown;
  };
  const connect = async (connector: Connector) => {
    setBusyId(connector.id);
    setMessage("");
    try {
      await invoke(connector, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "Umbra", version: "0.1.0" },
      });
      const response = await invoke(connector, "tools/list", {});
      const tools =
        typeof response === "object" &&
        response !== null &&
        "result" in response &&
        typeof response.result === "object" &&
        response.result !== null &&
        "tools" in response.result &&
        Array.isArray(response.result.tools)
          ? response.result.tools.filter(
              (tool): tool is McpTool =>
                typeof tool === "object" &&
                tool !== null &&
                "name" in tool &&
                typeof tool.name === "string",
            )
          : [];
      await persist(
        connectors.map((item) =>
          item.id === connector.id ? { ...item, tools } : item,
        ),
      );
      setMessage(
        `Discovered ${tools.length} tool${tools.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connector failed.");
    } finally {
      setBusyId(undefined);
    }
  };
  const runTool = async (connector: Connector, tool: McpTool) => {
    const key = `${connector.id}:${tool.name}`;
    let args: unknown = {};
    try {
      args = JSON.parse(argumentsByTool[key] || "{}") as unknown;
    } catch {
      setResults((items) => ({
        ...items,
        [key]: "Arguments must be valid JSON.",
      }));
      return;
    }
    setBusyId(key);
    try {
      const response = await invoke(connector, "tools/call", {
        name: tool.name,
        arguments: args,
      });
      setResults((items) => ({
        ...items,
        [key]: JSON.stringify(response, null, 2),
      }));
    } catch (error) {
      setResults((items) => ({
        ...items,
        [key]:
          error instanceof Error ? error.message : "Tool invocation failed.",
      }));
    } finally {
      setBusyId(undefined);
    }
  };
  return (
    <div className={styles.page}>
      <main className={`shell ${styles.content}`}>
        <div className="eyebrow">Browser-local connectors</div>
        <h1>Bring your tools closer.</h1>
        <p className={styles.intro}>
          Discover and invoke MCP tools manually from this browser. Umbra does
          not run tools automatically, and connector credentials never leave
          this browser except for the request you start.
        </p>
        <section className={`panel ${styles.card} ${styles.builtinCard}`}>
          <h2>Venice tools</h2>
          <p>
            Add Umbra&apos;s built-in Venice endpoint with your{" "}
            <Link href="/developers">Umbra API key</Link>. Tool arguments leave
            this browser after privacy processing, and these calls spend Umbra
            Venice credit. Exactly three tools are available: web answers,
            character search, and model listing.
          </p>
          <form
            className={styles.builtinForm}
            onSubmit={(event) => void addVeniceConnector(event)}
          >
            <label>
              Umbra API key
              <input
                type="password"
                value={veniceApiKey}
                onChange={(event) => setVeniceApiKey(event.target.value)}
                placeholder="umb_…"
                autoComplete="off"
              />
            </label>
            <button className="button" type="submit">
              Add Venice tools
            </button>
          </form>
        </section>
        <section className={`panel ${styles.card}`}>
          <h2>{editingId ? "Edit connector" : "Add a connector"}</h2>
          <form
            className={styles.form}
            onSubmit={(event) => void submit(event)}
          >
            <label>
              Name
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, name: event.target.value }))
                }
                placeholder="My MCP server"
              />
            </label>
            <label>
              HTTPS endpoint
              <input
                type="url"
                value={draft.url}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, url: event.target.value }))
                }
                placeholder="https://example.com/mcp"
              />
            </label>
            <label>
              Header name <span className="note">(optional)</span>
              <input
                value={draft.headerName ?? ""}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    headerName: event.target.value,
                  }))
                }
                placeholder="Authorization"
              />
            </label>
            <label>
              Header value <span className="note">(optional)</span>
              <input
                type="password"
                value={draft.headerValue ?? ""}
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    headerValue: event.target.value,
                  }))
                }
                placeholder="Stored locally"
              />
            </label>
            <div className={styles.actions}>
              <button className="button" type="submit">
                {editingId ? "Save changes" : "Save connector"}
              </button>
              {editingId && (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    setEditingId(undefined);
                    setDraft(emptyDraft);
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
          {message && (
            <p className={styles.message} role="status">
              {message}
            </p>
          )}
        </section>
        <div className={styles.list}>
          {connectors.length === 0 && (
            <section className={`panel ${styles.card}`}>
              <p className="note">
                No connectors yet. Add an HTTPS MCP endpoint to begin discovery.
              </p>
            </section>
          )}
          {connectors.map((connector) => (
            <section className={`panel ${styles.card}`} key={connector.id}>
              <div className={styles.connectorHeading}>
                <div>
                  <h2>{connector.name}</h2>
                  <code>{connector.url}</code>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    onClick={() => void connect(connector)}
                    disabled={busyId === connector.id}
                  >
                    {busyId === connector.id ? "Connecting…" : "Connect"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(connector.id);
                      setDraft({
                        name: connector.name,
                        url: connector.url,
                        headerName: connector.headerName,
                        headerValue: connector.headerValue,
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void persist(
                        connectors.filter((item) => item.id !== connector.id),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
              {connector.tools?.length ? (
                <div className={styles.tools}>
                  {connector.tools.map((tool) => {
                    const key = `${connector.id}:${tool.name}`;
                    return (
                      <div className={styles.tool} key={tool.name}>
                        <h3>{tool.name}</h3>
                        <p className="note">
                          {tool.description || "No description provided."}
                        </p>
                        <textarea
                          aria-label={`Arguments for ${tool.name}`}
                          value={argumentsByTool[key] ?? "{}"}
                          onChange={(event) =>
                            setArgumentsByTool((items) => ({
                              ...items,
                              [key]: event.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          onClick={() => void runTool(connector, tool)}
                          disabled={busyId === key}
                        >
                          {busyId === key ? "Running…" : "Run"}
                        </button>
                        {results[key] && (
                          <pre className={styles.result}>{results[key]}</pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="note">
                  No tools discovered yet. Connect to run initialize and
                  tools/list.
                </p>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
