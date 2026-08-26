import { getSetting, saveSetting } from "./storage";

export type McpTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

export type Connector = {
  id: string;
  name: string;
  url: string;
  headerName?: string;
  headerValue?: string;
  tools?: McpTool[];
};

const connectorsKey = "connectors";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeTool = (value: unknown): McpTool | undefined => {
  if (!isRecord(value) || typeof value.name !== "string") return undefined;
  return {
    name: value.name,
    ...(typeof value.description === "string"
      ? { description: value.description }
      : {}),
    ...(Object.hasOwn(value, "inputSchema")
      ? { inputSchema: value.inputSchema }
      : {}),
  };
};

const normalize = (value: unknown): Connector[] =>
  Array.isArray(value)
    ? value.flatMap((item): Connector[] => {
        if (
          !isRecord(item) ||
          typeof item.id !== "string" ||
          typeof item.name !== "string" ||
          typeof item.url !== "string"
        )
          return [];
        const tools = Array.isArray(item.tools)
          ? item.tools.flatMap((tool) => {
              const normalized = normalizeTool(tool);
              return normalized ? [normalized] : [];
            })
          : undefined;
        return [
          {
            id: item.id,
            name: item.name,
            url: item.url,
            ...(typeof item.headerName === "string"
              ? { headerName: item.headerName }
              : {}),
            ...(typeof item.headerValue === "string"
              ? { headerValue: item.headerValue }
              : {}),
            ...(tools ? { tools } : {}),
          },
        ];
      })
    : [];

export const getConnectors = async () =>
  normalize(await getSetting<unknown>(connectorsKey, []));

export const saveConnectors = async (connectors: Connector[]) => {
  const next = normalize(connectors);
  await saveSetting(connectorsKey, next);
  return next;
};
