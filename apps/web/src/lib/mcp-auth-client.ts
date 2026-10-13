"use client";

import { toast } from "sonner";
import { desktop } from "./desktop";
import { getState, update, type McpServer } from "./store";

type OAuthState = NonNullable<McpServer["oauth"]>;
type Tokens = OAuthState["tokens"];

async function call<T>(body: object): Promise<T> {
  const res = await fetch("/api/mcp/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(d.error ?? "Sign-in failed.");
  return d;
}

async function fetchTools(s: Partial<McpServer> & { accessToken?: string }) {
  const res = await fetch("/api/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(s) });
  const d = (await res.json().catch(() => ({}))) as { tools?: McpServer["tools"]; error?: string };
  if (!res.ok || !d.tools) throw new Error(d.error ?? "Couldn't load the connector's tools.");
  return d.tools;
}

type Draft = { id: string; name: string; url: string };

async function save(draft: Draft, oauth: OAuthState) {
  const tools = await fetchTools({ ...draft, kind: "http", accessToken: oauth.tokens?.access_token });
  update((s) => ({
    ...s,
    mcpServers: [
      ...(s.mcpServers ?? []).filter((x) => x.id !== draft.id),
      { ...draft, kind: "http", enabled: true, tools, policy: s.mcpServers?.find((x) => x.id === draft.id)?.policy ?? {}, oauth },
    ],
  }));
  toast.success(`${draft.name} connected with ${tools.length} tools. The AI will ask before using each one.`);
}

/** Start signing in to an MCP server that asked for it. Leaves the page (or opens the browser on desktop). */
export async function beginMcpSignIn(draft: Draft, previous?: McpServer["oauth"]) {
  const r = await call<{ result: string; authorizationUrl?: string; state?: string; clientInformation?: unknown; codeVerifier?: string; tokens?: Tokens }>({
    action: "start",
    url: draft.url,
    saved: { clientInformation: previous?.clientInformation },
  });
  if (r.result === "AUTHORIZED" && r.tokens) return save(draft, { clientInformation: r.clientInformation, tokens: r.tokens, obtainedAt: Date.now() });
  if (!r.authorizationUrl || !r.state) throw new Error("This server didn't offer a sign-in page.");
  localStorage.setItem(`moonc:mcpauth:${r.state}`, JSON.stringify({ draft, saved: { clientInformation: r.clientInformation, codeVerifier: r.codeVerifier } }));
  const b = desktop();
  if (b) await b.openExternal(r.authorizationUrl);
  else location.assign(r.authorizationUrl);
}

/** Finish a sign-in when the provider sends the person back (address fragment or moonlightc:// link). */
export async function consumeMcpAuth(hash: string) {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  if (!p.has("mcpauth") && !p.has("mcperror")) return false;
  const key = `moonc:mcpauth:${p.get("mcpstate")}`;
  const pending = JSON.parse(localStorage.getItem(key) ?? "null") as { draft: Draft; saved: { clientInformation?: unknown; codeVerifier?: string } } | null;
  localStorage.removeItem(key);
  if (p.get("mcperror")) {
    toast.error(`Sign-in cancelled: ${p.get("mcperror")}`);
    return true;
  }
  if (!pending) {
    toast.error("That sign-in had expired. Add the connector again.");
    return true;
  }
  try {
    const r = await call<{ tokens: Tokens; clientInformation?: unknown }>({ action: "finish", url: pending.draft.url, saved: pending.saved, code: p.get("mcpauth") });
    await save(pending.draft, { clientInformation: r.clientInformation ?? pending.saved.clientInformation, tokens: r.tokens, obtainedAt: Date.now() });
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
  return true;
}

/** Refresh signed-in connectors whose access is about to expire (called before each chat request). */
export async function refreshMcpTokens() {
  for (const m of getState().mcpServers ?? []) {
    const t = m.oauth?.tokens;
    if (!m.enabled || !t?.refresh_token || !t.expires_in) continue;
    if (m.oauth!.obtainedAt + t.expires_in * 1000 - 60_000 > Date.now()) continue;
    const r = await call<{ tokens?: Tokens }>({ action: "refresh", url: m.url, saved: { clientInformation: m.oauth!.clientInformation, tokens: t } }).catch(() => undefined);
    if (r?.tokens) update((s) => ({ ...s, mcpServers: (s.mcpServers ?? []).map((x) => (x.id === m.id ? { ...x, oauth: { ...x.oauth!, tokens: r.tokens, obtainedAt: Date.now() } } : x)) }));
    else toast.error(`${m.name} needs you to sign in again (Connections).`);
  }
}
