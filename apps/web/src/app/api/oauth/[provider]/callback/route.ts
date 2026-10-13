import { exchange, getOAuthProvider, readState } from "@/lib/oauth";

const cookie = (req: Request, name: string) => req.headers.get("cookie")?.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1];

// Google sends the user back here. Tokens go to the user's device in the URL fragment (never sent to any server).
export async function GET(req: Request, ctx: RouteContext<"/api/oauth/[provider]/callback">) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const back = (hash: string) => {
    const toDesktop = cookie(req, "moonc_oauth_return") === "desktop";
    const target = toDesktop ? `moonlightc://oauth#${hash}` : `${url.origin}/app#${hash}`;
    const headers = new Headers({ location: target });
    headers.append("set-cookie", "moonc_oauth=; Path=/api/oauth; Max-Age=0");
    headers.append("set-cookie", "moonc_oauth_return=; Path=/api/oauth; Max-Age=0");
    return new Response(null, { status: 302, headers });
  };
  try {
    const error = url.searchParams.get("error");
    if (error) throw new Error(error === "access_denied" ? "You cancelled the connection." : `Google said: ${error}`);
    const state = url.searchParams.get("state") ?? "";
    if (!state || state !== cookie(req, "moonc_oauth")) throw new Error("The sign-in didn't match. Start again from MoonlightC.");
    const { verifier } = readState(state, provider);
    const p = getOAuthProvider(provider);
    const tokens = await exchange(p, {
      grant_type: "authorization_code",
      code: url.searchParams.get("code") ?? "",
      redirect_uri: `${url.origin}/api/oauth/${provider}/callback`,
      code_verifier: verifier,
    });
    return back(`oauth=${Buffer.from(JSON.stringify({ provider, ...tokens })).toString("base64url")}`);
  } catch (e) {
    return back(`oauth_error=${encodeURIComponent(e instanceof Error ? e.message : "Connection failed.")}`);
  }
}
