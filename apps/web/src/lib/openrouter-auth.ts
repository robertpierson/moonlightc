"use client";

import { getProvider, type ModelInfo } from "@moonc/core";
import { track } from "./analytics";
import { desktop } from "./desktop";
import { updateNow, type SavedConnection } from "./store";

// "Sign in with OpenRouter": OAuth with PKCE, no app registration needed. The result is an ordinary OpenRouter key
// saved like a pasted one. On the desktop the browser hands the code back through a moonlightc:// link.

const KEY = "moonc:openrouter-pkce";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moonlightc.vercel.app";
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function startOpenRouterSignIn() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  localStorage.setItem(KEY, JSON.stringify({ verifier, state, at: Date.now() }));
  const b = desktop();
  const callback = b ? `${SITE_URL}/openrouter` : `${location.origin}/app`;
  const url = `https://openrouter.ai/auth?${new URLSearchParams({ callback_url: callback, code_challenge: challenge, code_challenge_method: "S256", state })}`;
  if (b) await b.openExternal(url);
  else location.assign(url);
}

/** True if this address (or moonlightc:// link) carries an OpenRouter sign-in result. */
export const isOpenRouterReturn = (params: URLSearchParams) => params.has("code") && params.has("state") && !!localStorage.getItem(KEY);

/**
 * The model a new OpenRouter account starts on: a free one (new accounts have no credit, so a paid model's first reply
 * would fail), preferring well-known open model families. Read from OpenRouter's live list, never a fixed name.
 */
export function firstModel(models: { id: string }[]) {
  const free = models.filter((m) => m.id.endsWith(":free"));
  return (free.find((m) => /llama|gemini|gemma|deepseek|qwen|mistral|gpt-oss/i.test(m.id)) ?? free[0] ?? models[0]).id;
}

/** Exchanges the code for a key, checks it, and saves the connection. Returns the number of models unlocked. */
export async function finishOpenRouterSignIn(params: URLSearchParams): Promise<number> {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { verifier: string; state: string; at: number } | null;
  localStorage.removeItem(KEY);
  if (!saved || saved.state !== params.get("state")) throw new Error("That sign-in didn't start here. Try Sign in with OpenRouter again.");
  if (Date.now() - saved.at > 15 * 60_000) throw new Error("That sign-in took too long. Try again.");
  const res = await fetch("/api/openrouter/exchange", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: params.get("code"), verifier: saved.verifier }) });
  const d = (await res.json().catch(() => ({}))) as { key?: string; error?: string };
  if (!res.ok || !d.key) throw new Error(d.error ?? "Sign-in failed. Try again.");
  const m = await fetch("/api/models", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ providerId: "openrouter", apiKey: d.key }) });
  const md = (await m.json().catch(() => ({}))) as { models?: ModelInfo[]; error?: string };
  if (!m.ok || !md.models?.length) throw new Error(md.error ?? "Signed in, but OpenRouter didn't list any models.");
  const conn: SavedConnection = { id: crypto.randomUUID(), providerId: "openrouter", apiKey: d.key, label: getProvider("openrouter").name, models: md.models, addedAt: Date.now() };
  updateNow((s) => ({
    ...s,
    connections: [...s.connections, conn],
    lastModel: s.lastModel ?? { connectionId: conn.id, modelId: firstModel(md.models!) },
  }));
  track("provider.connected", { provider: "openrouter", via: "signin" });
  return md.models.length;
}
