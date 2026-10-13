import { getOAuthProvider, makeState } from "@/lib/oauth";

export async function GET(req: Request, ctx: RouteContext<"/api/oauth/[provider]/start">) {
  const { provider } = await ctx.params;
  let p;
  try {
    p = getOAuthProvider(provider);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Not available.", { status: 404 });
  }
  const url = new URL(req.url);
  const desktop = url.searchParams.get("return") === "desktop";
  const { state, challenge } = makeState(provider);
  const auth = new URL(p.authUrl);
  auth.search = new URLSearchParams({
    client_id: p.clientId!,
    redirect_uri: `${url.origin}/api/oauth/${provider}/callback`,
    response_type: "code",
    scope: p.scopes.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...p.extraAuthParams,
  }).toString();
  const headers = new Headers({ location: auth.toString() });
  const cookie = (name: string, value: string) => `${name}=${value}; Path=/api/oauth; HttpOnly; SameSite=Lax; Max-Age=600${url.protocol === "https:" ? "; Secure" : ""}`;
  headers.append("set-cookie", cookie("moonc_oauth", state));
  headers.append("set-cookie", cookie("moonc_oauth_return", desktop ? "desktop" : "web"));
  return new Response(null, { status: 302, headers });
}
