import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport as StdioTransport } from "@ai-sdk/mcp/mcp-stdio";
import { ProviderError } from "@moonc/core";
import type { ToolSet } from "ai";
import fs from "node:fs";
import { isPublicURL } from "./server-guard";

/** Commands the user approved in a native dialog of the desktop app (written by its main process, not by pages). */
function approvedCommand(command: string, args: string[]) {
  const file = process.env.MOONC_MCP_ALLOWLIST;
  if (!file) return false;
  try {
    const list = JSON.parse(fs.readFileSync(file, "utf8")) as { command: string; args: string[] }[];
    return list.some((e) => e.command === command && JSON.stringify(e.args) === JSON.stringify(args));
  } catch {
    return false;
  }
}

// A connector the user added: a remote MCP server URL, or (desktop app only) a local command.
export interface McpServerConfig {
  id: string;
  name: string;
  kind: "http" | "stdio";
  url?: string;
  token?: string;
  /** Access token from an OAuth sign-in (takes priority over token). */
  accessToken?: string;
  command?: string;
  args?: string[];
  /** Per-tool permission. Missing tools default to "ask". */
  policy?: Record<string, "ask" | "always" | "never">;
}

export function readServers(v: unknown): McpServerConfig[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 20).flatMap((s): McpServerConfig[] => {
    if (!s || typeof s.id !== "string" || (s.kind !== "http" && s.kind !== "stdio")) return [];
    return [{ id: s.id.slice(0, 64), name: String(s.name ?? "Connector").slice(0, 80), kind: s.kind, url: s.url, token: s.token, accessToken: typeof s.accessToken === "string" ? s.accessToken : undefined, command: s.command, args: Array.isArray(s.args) ? s.args.map(String) : undefined, policy: s.policy }];
  });
}

export async function connect(s: McpServerConfig): Promise<MCPClient> {
  if (s.kind === "stdio") {
    if (process.env.MOONC_DESKTOP !== "1") throw new ProviderError("Local command connectors only work in the MoonlightC desktop app.");
    if (!s.command) throw new ProviderError("Enter the command that starts the MCP server.");
    if (!approvedCommand(s.command, s.args ?? [])) throw new ProviderError(`"${s.command}" hasn't been approved on this computer. Add the connector again to approve it.`);
    return createMCPClient({ transport: new StdioTransport({ command: s.command, args: s.args ?? [] }) });
  }
  const url = s.url ?? "";
  // Desktop: the server runs on the user's own computer, so local and LAN servers are allowed there.
  if (process.env.MOONC_DESKTOP !== "1" && !isPublicURL(url)) {
    throw new ProviderError("Connectors on the web must use a public https:// URL. Local servers work in the desktop app.");
  }
  return createMCPClient({
    // A few servers (for example Asana) still use the older SSE transport, marked by a /sse path.
    transport: { type: /\/sse\/?$/.test(new URL(url).pathname) ? "sse" : "http", url, headers: s.accessToken || s.token ? { authorization: `Bearer ${s.accessToken || s.token}` } : undefined },
  });
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 20) || "mcp";

/** Collect tools from every enabled connector. Tool names are prefixed so two servers can't collide. */
export async function mcpTools(servers: McpServerConfig[]) {
  const clients: MCPClient[] = [];
  const tools: ToolSet = {};
  const approval: Record<string, "user-approval" | "not-applicable"> = {};
  const errors: string[] = [];
  await Promise.all(
    servers.map(async (s) => {
      try {
        const client = await connect(s);
        clients.push(client);
        const set = await client.tools();
        for (const [name, t] of Object.entries(set)) {
          const policy = s.policy?.[name] ?? s.policy?.["*"] ?? "ask"; // "*": default for tools not listed (used by Bypass permissions)
          if (policy === "never") continue;
          const key = `${slug(s.name)}__${name}`.slice(0, 64);
          tools[key] = t;
          approval[key] = policy === "always" ? "not-applicable" : "user-approval";
        }
      } catch (e) {
        errors.push(`${s.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }),
  );
  return { tools, approval, errors, close: () => Promise.all(clients.map((c) => c.close().catch(() => {}))) };
}
