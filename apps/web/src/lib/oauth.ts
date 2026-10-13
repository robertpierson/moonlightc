import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// OAuth for connectors. Client secrets stay on the server; tokens go back to the user's device.
// ponytail: tokens live on the device until accounts exist; then they move to Supabase Vault.

export type OAuthProviderId = "google" | "spotify" | "slack" | "discord";

export interface OAuthProvider {
  id: OAuthProviderId;
  name: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Slack asks for user permissions under "user_scope" instead of "scope". */
  scopeParam?: string;
  scopeSeparator?: string;
  clientId?: string;
  clientSecret?: string;
  extraAuthParams?: Record<string, string>;
  /** Where to read the account's name/email after sign-in. */
  profile?: { url: string; pick: (d: Record<string, unknown>) => string | undefined };
}

// Test runs can point providers at local fakes; real deployments always use the real services.
const T = process.env;

export function oauthProviders(): OAuthProvider[] {
  return [
    {
      id: "google",
      name: "Google",
      authUrl: T.MOONC_TEST_GOOGLE_AUTH_URL ?? "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: T.MOONC_TEST_GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token",
      scopes: [
        "openid",
        "email",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/youtube.readonly",
      ],
      clientId: T.GOOGLE_CLIENT_ID,
      clientSecret: T.GOOGLE_CLIENT_SECRET,
      extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    },
    {
      id: "spotify",
      name: "Spotify",
      authUrl: T.MOONC_TEST_SPOTIFY_AUTH_URL ?? "https://accounts.spotify.com/authorize",
      tokenUrl: T.MOONC_TEST_SPOTIFY_TOKEN_URL ?? "https://accounts.spotify.com/api/token",
      scopes: ["user-read-playback-state", "user-modify-playback-state", "user-read-currently-playing", "playlist-read-private", "user-top-read", "user-read-email"],
      clientId: T.SPOTIFY_CLIENT_ID,
      clientSecret: T.SPOTIFY_CLIENT_SECRET,
      profile: { url: `${T.MOONC_TEST_SPOTIFY_API ?? "https://api.spotify.com"}/v1/me`, pick: (d) => (d.email ?? d.display_name) as string | undefined },
    },
    {
      id: "slack",
      name: "Slack",
      authUrl: "https://slack.com/oauth/v2/authorize",
      tokenUrl: "https://slack.com/api/oauth.v2.access",
      scopes: ["channels:read", "groups:read", "channels:history", "groups:history", "search:read", "chat:write", "users:read"],
      scopeParam: "user_scope",
      scopeSeparator: ",",
      clientId: T.SLACK_CLIENT_ID,
      clientSecret: T.SLACK_CLIENT_SECRET,
    },
    {
      id: "discord",
      name: "Discord",
      authUrl: "https://discord.com/oauth2/authorize",
      tokenUrl: "https://discord.com/api/oauth2/token",
      scopes: ["identify", "guilds"],
      clientId: T.DISCORD_CLIENT_ID,
      clientSecret: T.DISCORD_CLIENT_SECRET,
      profile: { url: "https://discord.com/api/users/@me", pick: (d) => d.username as string | undefined },
    },
  ];
}

export const configured = () => oauthProviders().filter((p) => p.clientId && p.clientSecret);

export function getOAuthProvider(id: string) {
  const p = configured().find((x) => x.id === id);
  if (!p) throw new Error("That connection isn't set up on this server yet.");
  return p;
}

const secret = () => T.OAUTH_STATE_SECRET ?? T.GOOGLE_CLIENT_SECRET ?? T.SPOTIFY_CLIENT_SECRET ?? "";
const b64url = (b: Buffer) => b.toString("base64url");

/** Signed, short-lived state carrying the PKCE verifier. */
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
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email?: string;
  scopes: string[];
}

type RawToken = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
  authed_user?: { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
};

/** Reads the different token answers (Slack nests the user's token under authed_user). */
export function parseToken(d: RawToken): Omit<TokenSet, "email"> & { idToken?: string } {
  const t = d.authed_user?.access_token ? d.authed_user : d;
  if (!t.access_token) throw new Error(d.error_description ?? d.error ?? "The sign-in didn't return access.");
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: t.expires_in ? Date.now() + t.expires_in * 1000 : Date.now() + 365 * 86_400_000,
    scopes: (t.scope ?? "").split(/[ ,]/).filter(Boolean),
    idToken: d.id_token,
  };
}

export async function exchange(p: OAuthProvider, body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(p.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ client_id: p.clientId!, client_secret: p.clientSecret!, ...body }),
  });
  const d = (await res.json().catch(() => ({}))) as RawToken;
  if (!res.ok) throw new Error(d.error_description ?? `${p.name} didn't accept the sign-in (${res.status}).`);
  const { idToken, ...t } = parseToken(d);
  let email: string | undefined;
  if (idToken) {
    try {
      email = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString()).email;
    } catch {}
  } else if (p.profile) {
    email = await fetch(p.profile.url, { headers: { authorization: `Bearer ${t.accessToken}` } })
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => p.profile!.pick(j as Record<string, unknown>))
      .catch(() => undefined);
  }
  return { ...t, email };
}
