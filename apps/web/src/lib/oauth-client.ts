"use client";

import { toast } from "sonner";
import { getState, update, type OAuthProviderId } from "./store";

const NAMES: Record<OAuthProviderId, string> = { google: "Google", spotify: "Spotify", slack: "Slack", discord: "Discord" };
const isProvider = (p: string): p is OAuthProviderId => p in NAMES;

/** Takes tokens handed back by the OAuth callback route (in the URL fragment or a moonlightc:// link) and stores them. */
export function consumeOAuthResult(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const err = params.get("oauth_error");
  if (err) {
    toast.error(err);
    return true;
  }
  const raw = params.get("oauth");
  if (!raw) return false;
  try {
    const t = JSON.parse(atob(raw.replace(/-/g, "+").replace(/_/g, "/"))) as { provider: string; accessToken: string; refreshToken?: string; expiresAt: number; email?: string; scopes: string[] };
    if (!isProvider(t.provider) || !t.accessToken) throw new Error();
    const id = t.provider;
    update((s) => ({
      ...s,
      oauth: { ...s.oauth, [id]: { accessToken: t.accessToken, refreshToken: t.refreshToken ?? s.oauth?.[id]?.refreshToken, expiresAt: t.expiresAt, email: t.email, scopes: t.scopes, enabled: true } },
    }));
    toast.success(`${NAMES[id]} connected${t.email ? ` as ${t.email}` : ""}.`);
  } catch {
    toast.error("That sign-in result couldn't be read. Try connecting again.");
  }
  return true;
}

/** A valid access token for a connected account, refreshed if it's about to expire. Undefined when not connected or off. */
export async function oauthToken(id: OAuthProviderId): Promise<string | undefined> {
  const a = getState().oauth?.[id];
  if (!a?.enabled || !a.accessToken) return undefined;
  if (a.expiresAt - Date.now() > 60_000 || !a.refreshToken) return a.accessToken;
  const res = await fetch(`/api/oauth/${id}/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: a.refreshToken }) }).catch(() => null);
  const d = (await res?.json().catch(() => ({}))) as { accessToken?: string; expiresAt?: number } | undefined;
  if (!res?.ok || !d?.accessToken) return a.accessToken;
  update((s) => ({ ...s, oauth: { ...s.oauth, [id]: { ...s.oauth![id]!, accessToken: d.accessToken!, expiresAt: d.expiresAt! } } }));
  return d.accessToken;
}

export const googleToken = () => oauthToken("google");
