import { getProvider, languageModel, ProviderError } from "@moonc/core";
import { generateText, isStepCount } from "ai";
import { mcpTools, readServers } from "@/lib/mcp-server";
import { readConnection } from "@/lib/server-guard";
import { buildTools, readSearchKey } from "@/lib/tools";

export const maxDuration = 300;

// One unattended run (Automations). No one is there to approve tools, so only connector tools set to
// "Always allow" are offered; "Ask every time" tools are left out.
export async function POST(req: Request) {
  let provider = "The provider";
  try {
    const body = await req.json();
    const c = readConnection(body.connection);
    provider = getProvider(c.providerId).name;
    const prompt = String(body.prompt ?? "").slice(0, 20000);
    if (!prompt.trim()) throw new ProviderError("This automation has no prompt.");
    const servers = readServers(body.mcp).map((s) => ({ ...s, policy: Object.fromEntries(Object.entries(s.policy ?? {}).filter(([, v]) => v === "always")) }));
    const mcp = servers.length ? await mcpTools(servers) : undefined;
    const alwaysOnly = Object.fromEntries(Object.entries(mcp?.tools ?? {}).filter(([k]) => mcp?.approval[k] === "not-applicable"));
    try {
      const { text } = await generateText({
        model: languageModel(c, String(body.modelId)),
        instructions: typeof body.instructions === "string" ? body.instructions.slice(0, 20000) : undefined,
        prompt,
        tools: { ...(body.tools ? buildTools(readSearchKey(body.tools.search)) : {}), ...alwaysOnly },
        stopWhen: isStepCount(10),
        abortSignal: req.signal,
      });
      return Response.json({ text, connectorErrors: mcp?.errors ?? [] });
    } finally {
      await mcp?.close();
    }
  } catch (e) {
    const message = e instanceof ProviderError ? e.message : `${provider} couldn't finish: ${e instanceof Error ? e.message.slice(0, 200) : "unknown error"}`;
    return Response.json({ error: message }, { status: 400 });
  }
}
