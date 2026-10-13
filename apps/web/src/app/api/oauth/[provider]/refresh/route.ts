import { exchange, getOAuthProvider } from "@/lib/oauth";

// Swap a refresh token for a fresh access token (needs the server-side client secret).
export async function POST(req: Request, ctx: RouteContext<"/api/oauth/[provider]/refresh">) {
  const { provider } = await ctx.params;
  try {
    const { refreshToken } = (await req.json()) as { refreshToken?: string };
    if (!refreshToken) throw new Error("Reconnect this account.");
    const t = await exchange(getOAuthProvider(provider), { grant_type: "refresh_token", refresh_token: refreshToken });
    return Response.json({ accessToken: t.accessToken, expiresAt: t.expiresAt });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Reconnect this account." }, { status: 400 });
  }
}
