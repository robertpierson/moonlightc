// An MCP server that requires OAuth, with discovery, dynamic client registration and PKCE, for end-to-end tests.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { z } from "zod";

const BASE = "http://127.0.0.1:4040";
const clients = new Map();
const codes = new Map();
const json = (res, status, body, headers = {}) => res.writeHead(status, { "content-type": "application/json", ...headers }).end(JSON.stringify(body));
const readBody = async (req) => {
  let raw = "";
  for await (const c of req) raw += c;
  return raw;
};

createServer(async (req, res) => {
  const url = new URL(req.url, BASE);
  if (url.pathname === "/.well-known/oauth-protected-resource" || url.pathname === "/.well-known/oauth-protected-resource/mcp")
    return json(res, 200, { resource: `${BASE}/mcp`, authorization_servers: [BASE] });
  if (url.pathname === "/.well-known/oauth-authorization-server")
    return json(res, 200, {
      issuer: BASE,
      authorization_endpoint: `${BASE}/authorize`,
      token_endpoint: `${BASE}/token`,
      registration_endpoint: `${BASE}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    });
  if (url.pathname === "/register" && req.method === "POST") {
    const meta = JSON.parse(await readBody(req));
    const client_id = `client-${clients.size + 1}`;
    clients.set(client_id, meta);
    return json(res, 201, { client_id, ...meta });
  }
  if (url.pathname === "/authorize") {
    const c = clients.get(url.searchParams.get("client_id"));
    const redirect = url.searchParams.get("redirect_uri");
    if (!c || !c.redirect_uris.includes(redirect)) return json(res, 400, { error: "invalid_client" });
    const code = `code-${Math.random().toString(36).slice(2)}`;
    codes.set(code, url.searchParams.get("code_challenge"));
    const back = new URL(redirect);
    back.searchParams.set("code", code);
    back.searchParams.set("state", url.searchParams.get("state"));
    return res.writeHead(302, { location: back.toString() }).end();
  }
  if (url.pathname === "/token" && req.method === "POST") {
    const p = new URLSearchParams(await readBody(req));
    if (p.get("grant_type") === "refresh_token") return json(res, 200, { access_token: "mcp-access-2", refresh_token: "mcp-refresh", expires_in: 3600, token_type: "Bearer" });
    const challenge = codes.get(p.get("code"));
    const ok = challenge && createHash("sha256").update(p.get("code_verifier") ?? "").digest("base64url") === challenge;
    if (!ok) return json(res, 400, { error: "invalid_grant" });
    return json(res, 200, { access_token: "mcp-access", refresh_token: "mcp-refresh", expires_in: 3600, token_type: "Bearer" });
  }
  if (url.pathname === "/mcp") {
    if (!/^Bearer mcp-access/.test(req.headers.authorization ?? ""))
      return json(res, 401, { error: "unauthorized" }, { "www-authenticate": `Bearer resource_metadata="${BASE}/.well-known/oauth-protected-resource"` });
    const raw = await readBody(req);
    const server = new McpServer({ name: "notes", version: "1.0.0" });
    server.registerTool("list_notes", { description: "List the user's notes", inputSchema: {} }, async () => ({ content: [{ type: "text", text: "groceries, trip plan" }] }));
    void z;
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => transport.close());
    await server.connect(transport);
    return transport.handleRequest(req, res, raw ? JSON.parse(raw) : undefined);
  }
  res.writeHead(404).end();
}).listen(4040, "127.0.0.1");
