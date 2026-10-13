"use client";

import { useEffect, useRef } from "react";
import { desktop } from "@/lib/desktop";
import { googleToken } from "@/lib/oauth-client";
import { nextRun, type Schedule } from "@/lib/schedule";
import { findModel, getState, update, type ModelRef } from "@/lib/store";

export interface Automation {
  id: string;
  name: string;
  prompt: string;
  model?: ModelRef;
  schedule: Schedule;
  webTools: boolean;
  connectors: boolean;
  enabled: boolean;
  nextRunAt: number;
  runs: { at: number; ok: boolean; text: string }[];
}

export const patch = (id: string, p: Partial<Automation>) => update((s) => ({ ...s, automations: (s.automations ?? []).map((a) => (a.id === id ? { ...a, ...p } : a)) }));

export async function runOnce(a: Automation) {
  const found = findModel(a.model);
  let ok = false;
  let text: string;
  if (!found) text = "The model for this automation isn't connected anymore. Pick another model.";
  else {
    const st = getState();
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        connection: { providerId: found.conn.providerId, apiKey: found.conn.apiKey, baseURL: found.conn.baseURL },
        modelId: found.model.id,
        prompt: a.prompt,
        tools: a.webTools ? { search: st.searchKey } : undefined,
        mcp: a.connectors ? (st.mcpServers ?? []).filter((m) => m.enabled) : [],
        google: a.connectors ? { accessToken: await googleToken() } : undefined,
      }),
    }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as { text?: string; error?: string } | undefined;
    ok = !!res?.ok;
    text = ok ? (d?.text ?? "") : (d?.error ?? "Couldn't reach the model.");
  }
  const cur = getState().automations?.find((x) => x.id === a.id);
  patch(a.id, { nextRunAt: nextRun(a.schedule, new Date()).getTime(), runs: [{ at: Date.now(), ok, text: text.slice(0, 20000) }, ...(cur?.runs ?? [])].slice(0, 20) });
  desktop()?.notify(ok ? a.name : `${a.name} failed`, text.replace(/\s+/g, " ").slice(0, 140));
  return ok;
}

/** Checks every 30 seconds for automations that are due. Runs only in the desktop app (it keeps running in the tray). */
export function AutomationRunner() {
  const busy = useRef(false);
  useEffect(() => {
    if (!desktop()) return;
    const tick = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        for (const a of getState().automations ?? []) if (a.enabled && a.nextRunAt <= Date.now()) await runOnce(a);
      } finally {
        busy.current = false;
      }
    };
    const t = setInterval(tick, 30_000);
    tick();
    return () => clearInterval(t);
  }, []);
  return null;
}

