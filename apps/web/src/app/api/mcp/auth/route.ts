import { finishAuth, refreshAuth, startAuth, type McpAuthState } from "@/lib/mcp-oauth";

// MCP connector sign-in steps. Everything needed between steps is kept by the browser and sent back here.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { action?: string; url?: string; saved?: McpAuthState; code?: string };
  const redirectUrl = `${new URL(req.url).origin}/api/mcp/auth/callback`;
  try {
    if (typeof b.url !== "string") throw new Error("Missing connector address.");
    if (b.action === "start") return Response.json(await startAuth(b.url, redirectUrl, b.saved ?? {}));
    if (b.action === "finish") return Response.json(await finishAuth(b.url, redirectUrl, b.saved ?? {}, String(b.code ?? "")));
    if (b.action === "refresh") return Response.json((await refreshAuth(b.url, redirectUrl, b.saved ?? {})) ?? { signInAgain: true });
    throw new Error("Unknown step.");
  } catch (e) {
    return Response.json({ error: `Sign-in failed: ${e instanceof Error ? e.message.slice(0, 200) : "unknown error"}` }, { status: 400 });
  }
}
