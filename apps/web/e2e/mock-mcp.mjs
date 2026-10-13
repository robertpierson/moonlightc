// Tiny MCP server for end-to-end tests: one "add" tool over stateless Streamable HTTP.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { z } from "zod";

createServer(async (req, res) => {
  if (req.url !== "/mcp") return res.writeHead(404).end();
  if (req.headers.authorization !== "Bearer test-token") return res.writeHead(401).end();
  let raw = "";
  for await (const c of req) raw += c;
  const server = new McpServer({ name: "mock", version: "1.0.0" });
  server.registerTool("add", { description: "Add two numbers", inputSchema: { a: z.number(), b: z.number() } }, async ({ a, b }) => ({ content: [{ type: "text", text: `sum=${a + b}` }] }));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, raw ? JSON.parse(raw) : undefined);
}).listen(4020, "127.0.0.1");
