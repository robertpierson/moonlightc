import { getProvider, languageModel, ProviderError } from "@moonc/core";
import { fileTools, readGrants } from "@/lib/local-files";
import { APICallError, convertToModelMessages, isStepCount, jsonSchema, tool, type ToolSet, createUIMessageStreamResponse, streamText, toUIMessageStream, type UIMessage } from "ai";
import { readConnection } from "@/lib/server-guard";
import { discordTools, slackTools, spotifyTools, xTools } from "@/lib/account-tools";
import { googleTools } from "@/lib/google-tools";
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
  memory?: boolean;
  skills?: boolean;
  files?: boolean;
  browser?: boolean;
  homePc?: boolean;
  computer?: boolean;
  google?: { accessToken?: string };
  accounts?: { spotify?: string; slack?: string; discord?: string; x?: string };
  /** Code assistant: true = may change files; "plan" = plan only, no file changes. */
  code?: boolean | "plan";
}

// Code workspace: the browser holds the project, so these tools run there and report back.
const codeTools: ToolSet = {
  write_files: tool({
    description: "Create or replace files in the user's project. Always send each file's complete content.",
    inputSchema: jsonSchema({
      type: "object",
      properties: {
        summary: { type: "string", description: "One sentence: what changed and why" },
        files: { type: "array", items: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
      },
      required: ["summary", "files"],
    }),
  }),
  delete_files: tool({
    description: "Delete files from the user's project.",
    inputSchema: jsonSchema({ type: "object", properties: { paths: { type: "array", items: { type: "string" } } }, required: ["paths"] }),
  }),
};

const COMPUTER_INSTRUCTIONS = `You can use this person's computer with the computer tool. Start with a screenshot. Coordinates are pixels in the latest screenshot. Work step by step and take a screenshot after anything changes. Before any step that deletes, buys, sends a message or installs something, set destructive: true and explain why in reason; the person will be asked. If something looks wrong, stop and explain.`;

// Runs in the desktop app (the browser executes it through the bridge and returns a screenshot).
const computerTool = tool({
  description: "Look at and operate the person's computer: screenshot, click, double_click, right_click, move, type, key (like ctrl+s), scroll (amount: negative = down), wait.",
  inputSchema: jsonSchema({
    type: "object",
    properties: {
      action: { type: "string", enum: ["screenshot", "click", "double_click", "right_click", "move", "type", "key", "scroll", "wait"] },
      x: { type: "number" },
      y: { type: "number" },
      text: { type: "string" },
      keys: { type: "string" },
      amount: { type: "number" },
      ms: { type: "number" },
      destructive: { type: "boolean" },
      reason: { type: "string" },
    },
    required: ["action"],
  }),
  toModelOutput: ({ output }) => {
    const o = output as { image?: string; width?: number; height?: number; note?: string; error?: string };
    if (!o?.image) return { type: "content", value: [{ type: "text", text: o?.note ?? o?.error ?? "Done." }] };
    return {
      type: "content",
      value: [
        { type: "text", text: `Screenshot ${o.width}x${o.height}.` },
        { type: "file", mediaType: "image/png", data: { type: "data", data: o.image } },
      ],
    };
  },
});

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
    const memoryTool: ToolSet = body.memory
      ? { save_memory: tool({ description: "Remember a lasting fact about the user for future chats.", inputSchema: jsonSchema({ type: "object", properties: { fact: { type: "string" } }, required: ["fact"] }) }) }
      : {};
    // Plugin skills live on the device; the model asks for one and the browser hands it over.
    const skillTool: ToolSet = body.skills
      ? { load_skill: tool({ description: "Load the full instructions of one of your skills (name as plugin:skill).", inputSchema: jsonSchema({ type: "object", properties: { name: { type: "string" } }, required: ["name"] }) }) }
      : {};
    // Chrome extension: tabs the person shared. These run in the browser; risky clicks ask on the page itself.
    const tabId = { tabId: { type: "number" as const, description: "From browser_tabs; leave out for the most recently used shared tab." } };
    const target = { ref: { type: "string" as const, description: "Control ref from browser_read" }, text: { type: "string" as const, description: "Or the control's visible text" } };
    const browserTools: ToolSet = body.browser
      ? {
          browser_tabs: tool({ description: "List the browser tabs the person shared with you.", inputSchema: jsonSchema({ type: "object", properties: {} }) }),
          browser_read: tool({ description: "Read a shared tab: its text and the buttons, links and fields you can use (with refs).", inputSchema: jsonSchema({ type: "object", properties: tabId }) }),
          browser_click: tool({ description: "Click a button or link in a shared tab. Buying, sending, deleting or submitting asks the person first.", inputSchema: jsonSchema({ type: "object", properties: { ...tabId, ...target } }) }),
          browser_type: tool({ description: "Type into a field in a shared tab; submit=true also submits (asks the person first).", inputSchema: jsonSchema({ type: "object", properties: { ...tabId, ...target, value: { type: "string" }, submit: { type: "boolean" } }, required: ["value"] }) }),
          browser_open: tool({ description: "Open a web address in a shared tab.", inputSchema: jsonSchema({ type: "object", properties: { ...tabId, url: { type: "string" } }, required: ["url"] }) }),
        }
      : {};
    // Cowork on another device: the home PC's files and commands (run there; the person approves changes first).
    const homeTools: ToolSet = body.homePc
      ? {
          pc_list_files: tool({ description: "List a folder on the person's home PC (paths relative to their home folder; leave out for the home folder).", inputSchema: jsonSchema({ type: "object", properties: { path: { type: "string" } } }) }),
          pc_read_file: tool({ description: "Read a text file on the home PC.", inputSchema: jsonSchema({ type: "object", properties: { path: { type: "string" } }, required: ["path"] }) }),
          pc_write_file: tool({ description: "Create or replace a text file on the home PC. The person approves it first.", inputSchema: jsonSchema({ type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] }) }),
          pc_run_command: tool({ description: "Run a shell command on the home PC (for example to build, test or use git) and get its output. The person approves it first.", inputSchema: jsonSchema({ type: "object", properties: { command: { type: "string" }, cwd: { type: "string", description: "Folder to run in (relative to home)" } }, required: ["command"] }) }),
        }
      : {};
    const desktopComputer = body.computer && process.env.MOONC_DESKTOP === "1";
    // Screenshots must reach the model as images; OpenAI-compatible APIs only accept text in tool results.
    const visionTools = ["anthropic", "openai", "google", "azure", "bedrock"].includes(getProvider(c.providerId).kind) || process.env.MOONC_E2E_AUTO_APPROVE === "1";
    if (desktopComputer && !visionTools) {
      throw new ProviderError("Computer use needs a Claude, GPT or Gemini model connected with its own key (Anthropic, OpenAI, Google, Azure or Bedrock). Pick one in the model menu.");
    }
    const google = typeof body.google?.accessToken === "string" ? googleTools(body.google.accessToken) : undefined;
    const acc = body.accounts ?? {};
    const slack = typeof acc.slack === "string" ? slackTools(acc.slack) : undefined;
    const accountTools = { ...(typeof acc.spotify === "string" ? spotifyTools(acc.spotify) : {}), ...slack?.tools, ...(typeof acc.discord === "string" ? discordTools(acc.discord) : {}), ...(typeof acc.x === "string" ? xTools(acc.x) : {}) };
    // Desktop app: files in the folders the user shared (writing asks first).
    const grants = body.files && process.env.MOONC_DESKTOP === "1" ? await readGrants() : [];
    const files = grants.length ? fileTools(grants) : undefined;
    const tools = { ...files?.tools, ...builtIn, ...mcp?.tools, ...google?.tools, ...accountTools, ...readModTools(body.modTools), ...memoryTool, ...skillTool, ...browserTools, ...homeTools, ...(desktopComputer ? { computer: computerTool } : {}), ...(body.code === true ? codeTools : {}) };
    const hasTools = Object.keys(tools).length > 0;

    const result = streamText({
      model: languageModel(c, body.modelId),
      instructions:
        [
          typeof body.instructions === "string" ? body.instructions.slice(0, 80000) : "",
          desktopComputer ? COMPUTER_INSTRUCTIONS : "",
          body.code === "plan" ? "Plan mode: don't change any files. Read the request and the current files, then reply with a short, numbered plan of the changes you would make and why." : "",
        ].filter(Boolean).join("\n\n") || undefined,
      temperature: typeof body.temperature === "number" ? Math.min(2, Math.max(0, body.temperature)) : undefined,
      messages: await convertToModelMessages(body.messages),
      abortSignal: req.signal,
      ...(hasTools ? { tools, toolApproval: { ...mcp?.approval, ...google?.approval, ...slack?.approval, ...files?.approval }, stopWhen: isStepCount(body.research || desktopComputer || body.code ? 40 : 8) } : {}),
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
