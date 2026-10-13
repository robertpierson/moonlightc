"use client";

import { toast } from "sonner";
import { getState, update } from "./store";

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
    if (t.provider !== "google" || !t.accessToken) throw new Error();
    update((s) => ({ ...s, oauth: { ...s.oauth, google: { accessToken: t.accessToken, refreshToken: t.refreshToken ?? s.oauth?.google?.refreshToken, expiresAt: t.expiresAt, email: t.email, scopes: t.scopes, enabled: true } } }));
    toast.success(`Google connected${t.email ? ` as ${t.email}` : ""}.`);
  } catch {
    toast.error("That sign-in result couldn't be read. Try connecting again.");
  }
  return true;
}

/** A valid Google access token, refreshed if it's about to expire. Undefined when Google isn't connected or is turned off. */
export async function googleToken(): Promise<string | undefined> {
  const g = getState().oauth?.google;
  if (!g?.enabled || !g.accessToken) return undefined;
  if (g.expiresAt - Date.now() > 60_000 || !g.refreshToken) return g.accessToken;
  const res = await fetch("/api/oauth/google/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: g.refreshToken }) }).catch(() => null);
  const d = (await res?.json().catch(() => ({}))) as { accessToken?: string; expiresAt?: number } | undefined;
  if (!res?.ok || !d?.accessToken) return g.accessToken;
  update((s) => ({ ...s, oauth: { ...s.oauth, google: { ...s.oauth!.google!, accessToken: d.accessToken!, expiresAt: d.expiresAt! } } }));
  return d.accessToken;
}
