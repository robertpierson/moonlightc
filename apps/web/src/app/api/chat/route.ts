import { getProvider, languageModel, ProviderError } from "@moonc/core";
import { APICallError, convertToModelMessages, isStepCount, jsonSchema, tool, type ToolSet, createUIMessageStreamResponse, streamText, toUIMessageStream, type UIMessage } from "ai";
import { readConnection } from "@/lib/server-guard";
import { mcpTools, readServers } from "@/lib/mcp-server";
import { buildTools, readSearchKey, type SearchKey } from "@/lib/tools";

export const maxDuration = 300;

interface Body {
  messages: UIMessage[];
  connection: unknown;
  modelId: string;
  instructions?: string;
  temperature?: number;
  tools?: { search?: SearchKey };
  research?: boolean;
  mcp?: unknown;
  modTools?: unknown;
}

function readModTools(v: unknown): ToolSet {
  const out: ToolSet = {};
  if (!Array.isArray(v)) return out;
  for (const t of v.slice(0, 50)) {
    if (!t || typeof t.name !== "string" || !/^mod_[a-z0-9_]+__[A-Za-z0-9_]{1,40}$/.test(t.name) || t.inputSchema?.type !== "object") continue;
    out[t.name] = tool({ description: String(t.description ?? "").slice(0, 500), inputSchema: jsonSchema(t.inputSchema) });
  }
  return out;
}

// Thin streaming proxy: the key arrives with the request, is used for this one call, and is never stored or logged.
export async function POST(req: Request) {
  let body: Body;
  let providerName = "The provider";
  try {
    body = await req.json();
    const c = readConnection(body.connection);
    providerName = getProvider(c.providerId).name;
    if (typeof body.modelId !== "string" || !Array.isArray(body.messages)) throw new ProviderError("Pick a model first.");

    // Connectors (MCP): their tools join the built-in ones; "ask" tools pause for the user's approval in the chat.
    const servers = readServers(body.mcp);
    const mcp = servers.length ? await mcpTools(servers) : undefined;
    const builtIn = body.tools ? buildTools(readSearchKey(body.tools.search)) : {};
    const tools = { ...builtIn, ...mcp?.tools, ...readModTools(body.modTools) };
    const hasTools = Object.keys(tools).length > 0;

    const result = streamText({
      model: languageModel(c, body.modelId),
      instructions: typeof body.instructions === "string" && body.instructions ? body.instructions.slice(0, 20000) : undefined,
      temperature: typeof body.temperature === "number" ? Math.min(2, Math.max(0, body.temperature)) : undefined,
      messages: await convertToModelMessages(body.messages),
      abortSignal: req.signal,
      ...(hasTools ? { tools, toolApproval: mcp?.approval, stopWhen: isStepCount(body.research ? 40 : 8) } : {}),
      onEnd: async () => {
        await mcp?.close();
      },
      onError: async () => {
        await mcp?.close();
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        sendReasoning: true,
        messageMetadata: ({ part }) =>
          part.type === "finish"
            ? { usage: part.totalUsage, modelId: body.modelId, createdAt: Date.now() }
            : part.type === "start" && mcp?.errors.length
              ? { connectorErrors: mcp.errors }
              : undefined,
        onError: (e) => friendlyError(e, providerName),
      }),
    });
  } catch (e) {
    return Response.json({ error: friendlyError(e, providerName) }, { status: 400 });
  }
}

function friendlyError(e: unknown, provider: string): string {
  if (e instanceof ProviderError) return e.message;
  if (APICallError.isInstance(e)) {
    if (e.statusCode === 401 || e.statusCode === 403) return `${provider} rejected your key. Open Settings → Models and paste a fresh key.`;
    if (e.statusCode === 402) return `${provider} says your account is out of credit. Add credit on their site, then retry.`;
    if (e.statusCode === 404) return `${provider} doesn't recognize this model. Pick another model and retry.`;
    if (e.statusCode === 429) return `${provider} is rate-limiting you. Wait a moment, then retry.`;
    return `${provider} returned an error${e.statusCode ? ` (${e.statusCode})` : ""}: ${e.message.slice(0, 200)}`;
  }
  return `${provider} couldn't answer. Retry, or pick another model.`;
}
