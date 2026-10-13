import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// OAuth for connectors (Google first). Client secrets stay on the server; tokens go back to the user's device.
// ponytail: tokens live on the device until accounts exist; then they move to Supabase Vault.

export interface OAuthProvider {
  id: string;
  name: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId?: string;
  clientSecret?: string;
  extraAuthParams?: Record<string, string>;
}

// Test runs can point these at a local fake; real deployments always use Google.
const GOOGLE_AUTH = process.env.MOONC_TEST_GOOGLE_AUTH_URL ?? "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = process.env.MOONC_TEST_GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token";

export function oauthProviders(): OAuthProvider[] {
  return [
    {
      id: "google",
      name: "Google",
      authUrl: GOOGLE_AUTH,
      tokenUrl: GOOGLE_TOKEN,
      scopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/youtube.readonly",
      ],
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    },
  ];
}

export const configured = () => oauthProviders().filter((p) => p.clientId && p.clientSecret);

export function getOAuthProvider(id: string) {
  const p = configured().find((x) => x.id === id);
  if (!p) throw new Error("That connection isn't set up on this server yet.");
  return p;
}

const secret = () => process.env.OAUTH_STATE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? "";
const b64url = (b: Buffer) => b.toString("base64url");

/** Signed, short-lived state cookie value carrying the PKCE verifier. */
export function makeState(provider: string) {
  const verifier = b64url(randomBytes(32));
  const payload = b64url(Buffer.from(JSON.stringify({ p: provider, v: verifier, n: b64url(randomBytes(12)), t: Date.now() })));
  const sig = b64url(createHmac("sha256", secret()).update(payload).digest());
  return { state: `${payload}.${sig}`, verifier, challenge: b64url(createHash("sha256").update(verifier).digest()) };
}

export function readState(state: string, provider: string): { verifier: string } {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) throw new Error("Invalid sign-in state.");
  const expect = createHmac("sha256", secret()).update(payload).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) throw new Error("Invalid sign-in state.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { p: string; v: string; t: number };
  if (data.p !== provider || Date.now() - data.t > 10 * 60_000) throw new Error("The sign-in took too long. Try again.");
  return { verifier: data.v };
}

export interface TokenSet {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email?: string;
  scopes: string[];
}

export async function exchange(p: OAuthProvider, body: Record<string, string>): Promise<Omit<TokenSet, "provider">> {
  const res = await fetch(p.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: p.clientId!, client_secret: p.clientSecret!, ...body }),
  });
  const d = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; id_token?: string; error_description?: string };
  if (!res.ok || !d.access_token) throw new Error(d.error_description ?? `${p.name} didn't accept the sign-in (${res.status}).`);
  let email: string | undefined;
  if (d.id_token) {
    try {
      email = JSON.parse(Buffer.from(d.id_token.split(".")[1], "base64url").toString()).email;
    } catch {}
  }
  return { accessToken: d.access_token, refreshToken: d.refresh_token, expiresAt: Date.now() + (d.expires_in ?? 3600) * 1000, email, scopes: (d.scope ?? "").split(" ").filter(Boolean) };
}
