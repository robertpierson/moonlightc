"use client";

import { getState } from "./store";

// Which connectors and Claude plugins a chat gets: everything switched on, plus whatever its project adds.

export function activeServers(extra: string[] = []) {
  return (getState().mcpServers ?? []).filter((m) => m.enabled || extra.includes(m.id));
}

export function activePlugins(extra: string[] = []) {
  return (getState().plugins ?? []).map((p) => (extra.includes(p.id) ? { ...p, enabled: true } : p));
}

export const mcpPayload = (servers: ReturnType<typeof activeServers>, bypass = false) =>
  servers.map(({ id, name, kind, url, token, command, args, policy, oauth }) => ({
    id,
    name,
    kind,
    url,
    token,
    accessToken: oauth?.tokens?.access_token,
    command,
    args,
    // "Bypass permissions" (code only): every tool runs without asking, except ones the person blocked.
    policy: bypass ? { "*": "always" as const, ...Object.fromEntries(Object.entries(policy).map(([k, v]) => [k, v === "never" ? ("never" as const) : ("always" as const)])) } : policy,
  }));
