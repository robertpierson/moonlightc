import { ProviderError } from "@moonc/core";
import { connect, readServers } from "@/lib/mcp-server";

// Connects to one connector and lists its tools, so the user can test it and set permissions.
export async function POST(req: Request) {
  const [server] = readServers([await req.json().catch(() => null)]);
  if (!server) return Response.json({ error: "That connector isn't set up correctly." }, { status: 400 });
  let client;
  try {
    client = await connect(server);
    const tools = await client.tools();
    return Response.json({
      tools: Object.entries(tools).map(([name, t]) => ({ name, description: (t as { description?: string }).description?.slice(0, 300) ?? "" })),
    });
  } catch (e) {
    // The server wants a sign-in (OAuth). The app then runs the sign-in flow.
    if (server.kind === "http" && !server.token && /401|unauthori[sz]ed/i.test(e instanceof Error ? `${e.name} ${e.message}` : "")) {
      return Response.json({ needsAuth: true }, { status: 401 });
    }
    const msg = e instanceof ProviderError ? e.message : `Couldn't connect to ${server.name}. Check the address and token. (${e instanceof Error ? e.message.slice(0, 160) : "unknown error"})`;
    return Response.json({ error: msg }, { status: 400 });
  } finally {
    await client?.close().catch(() => {});
  }
}
