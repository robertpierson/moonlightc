import { auth, type OAuthClientProvider } from "@ai-sdk/mcp";
import { isPublicURL } from "./server-guard";

// OAuth for MCP connectors (Notion, Linear, Atlassian, ...). Servers that support dynamic client registration need no
// app set up by us. The server here is stateless: the browser keeps the client registration, PKCE verifier and tokens,
// and sends what's needed with each step.

type ClientInfo = Awaited<ReturnType<OAuthClientProvider["clientInformation"]>>;
type Tokens = NonNullable<Awaited<ReturnType<OAuthClientProvider["tokens"]>>>;

export interface McpAuthState {
  clientInformation?: ClientInfo;
  codeVerifier?: string;
  tokens?: Tokens;
}

function provider(redirectUrl: string, saved: McpAuthState) {
  const out: McpAuthState & { authorizationUrl?: string; state?: string } = { ...saved };
  const p: OAuthClientProvider = {
    get redirectUrl() {
      return redirectUrl;
    },
    get clientMetadata() {
      return { client_name: "MoonlightC", redirect_uris: [redirectUrl], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" };
    },
    clientInformation: () => out.clientInformation,
    saveClientInformation: (c) => void (out.clientInformation = c),
    tokens: () => out.tokens,
    saveTokens: (t) => void (out.tokens = t),
    saveCodeVerifier: (v) => void (out.codeVerifier = v),
    codeVerifier: () => {
      if (!out.codeVerifier) throw new Error("The sign-in expired. Start again.");
      return out.codeVerifier;
    },
    redirectToAuthorization: (url) => void (out.authorizationUrl = url.toString()),
    state: () => (out.state = crypto.randomUUID()),
  };
  return { p, out };
}

function checkUrl(url: string) {
  if (process.env.MOONC_DESKTOP !== "1" && !isPublicURL(url)) throw new Error("Connectors on the web must use a public https:// URL.");
}

/** Step 1: register (if needed) and get the address of the provider's sign-in page. */
export async function startAuth(serverUrl: string, redirectUrl: string, saved: McpAuthState) {
  checkUrl(serverUrl);
  // A registration made for another address (for example, the desktop app's port changed) can't be reused.
  const reg = saved.clientInformation as { redirect_uris?: string[] } | undefined;
  const clean = reg?.redirect_uris && !reg.redirect_uris.includes(redirectUrl) ? { ...saved, clientInformation: undefined } : saved;
  const { p, out } = provider(redirectUrl, { clientInformation: clean.clientInformation });
  const result = await auth(p, { serverUrl });
  return { result, authorizationUrl: out.authorizationUrl, state: out.state, clientInformation: out.clientInformation, codeVerifier: out.codeVerifier, tokens: out.tokens };
}

/** Step 2: trade the code from the sign-in page for tokens. */
export async function finishAuth(serverUrl: string, redirectUrl: string, saved: McpAuthState, code: string) {
  checkUrl(serverUrl);
  const { p, out } = provider(redirectUrl, saved);
  await auth(p, { serverUrl, authorizationCode: code });
  if (!out.tokens) throw new Error("The sign-in didn't return access. Try again.");
  return { tokens: out.tokens, clientInformation: out.clientInformation };
}

/** Refresh expired tokens (no user interaction). Returns undefined if the person must sign in again. */
export async function refreshAuth(serverUrl: string, redirectUrl: string, saved: McpAuthState) {
  checkUrl(serverUrl);
  const { p, out } = provider(redirectUrl, saved);
  const result = await auth(p, { serverUrl }).catch(() => "REDIRECT" as const);
  return result === "AUTHORIZED" && out.tokens ? { tokens: out.tokens } : undefined;
}
