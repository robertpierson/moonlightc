"use client";

import { Loader2, MessageSquare, Play, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ModelPicker } from "@/components/chat/model-picker";
import { desktop } from "@/lib/desktop";
import { describe, nextRun, type Schedule } from "@/lib/schedule";
import { findModel, getState, saveChat, update, useStore, type ModelRef } from "@/lib/store";

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

const patch = (id: string, p: Partial<Automation>) => update((s) => ({ ...s, automations: (s.automations ?? []).map((a) => (a.id === id ? { ...a, ...p } : a)) }));

async function runOnce(a: Automation) {
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

function Editor({ onDone }: { onDone: () => void }) {
  const lastModel = useStore((s) => s.lastModel);
  const [a, setA] = useState<Automation>(() => ({ id: crypto.randomUUID(), name: "", prompt: "", model: lastModel, schedule: { kind: "daily", time: "08:00" }, webTools: false, connectors: false, enabled: true, nextRunAt: 0, runs: [] }));
  return (
    <form
      className="grid gap-3 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!findModel(a.model)) return toast.error("Pick a model first.");
        update((s) => ({ ...s, automations: [...(s.automations ?? []), { ...a, nextRunAt: nextRun(a.schedule, new Date()).getTime() }] }));
        onDone();
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="auto-name">Name</Label>
        <Input id="auto-name" required maxLength={60} value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="Morning news brief" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="auto-prompt">What should the AI do?</Label>
        <Textarea id="auto-prompt" required className="min-h-24" value={a.prompt} onChange={(e) => setA({ ...a, prompt: e.target.value })} placeholder="Search the web for today's top AI news and give me 5 bullet points with links." />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label>Model</Label>
          <div className="rounded-md border">
            <ModelPicker value={a.model} onChange={(m) => setA({ ...a, model: m })} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="auto-when">When</Label>
          <Select
            value={a.schedule.kind === "hourly" ? `h${a.schedule.every}` : a.schedule.weekdaysOnly ? "weekdays" : "daily"}
            onValueChange={(v) => setA({ ...a, schedule: v.startsWith("h") ? { kind: "hourly", every: Number(v.slice(1)) } : { kind: "daily", time: a.schedule.kind === "daily" ? a.schedule.time : "08:00", weekdaysOnly: v === "weekdays" } })}
          >
            <SelectTrigger id="auto-when" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Every day</SelectItem>
              <SelectItem value="weekdays">Weekdays</SelectItem>
              <SelectItem value="h1">Every hour</SelectItem>
              <SelectItem value="h6">Every 6 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {a.schedule.kind === "daily" && (
          <div className="grid gap-1.5">
            <Label htmlFor="auto-time">At</Label>
            <Input id="auto-time" type="time" required value={a.schedule.time} onChange={(e) => setA({ ...a, schedule: { ...(a.schedule as Extract<Schedule, { kind: "daily" }>), time: e.target.value } })} className="w-32" />
          </div>
        )}
      </div>
      <label className="flex items-center justify-between text-sm">
        Let it search the web and read links
        <Switch checked={a.webTools} onCheckedChange={(v) => setA({ ...a, webTools: v })} />
      </label>
      <label className="flex items-center justify-between text-sm">
        Let it use connector tools set to &quot;Always allow&quot;
        <Switch checked={a.connectors} onCheckedChange={(v) => setA({ ...a, connectors: v })} />
      </label>
      <div className="flex gap-2">
        <Button type="submit">Save automation</Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function Automations({ onOpenChat }: { onOpenChat: (id: string) => void }) {
  const items = useStore((s) => s.automations) ?? [];
  const [adding, setAdding] = useState(false);
  const [running, setRunning] = useState<string>();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-4xl gap-6 px-4 py-6">
        <section aria-labelledby="auto-h" className="grid gap-2">
          <div className="flex items-center gap-2">
            <h2 id="auto-h" className="mr-auto text-lg font-semibold">
              Automations
            </h2>
            <Button onClick={() => setAdding(true)}>
              <Plus /> New automation
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Prompts that run on a schedule on this computer while MoonlightC is open or in the tray. You get a notification with each result.
          </p>
        </section>
        {adding && <Editor onDone={() => setAdding(false)} />}
        {items.length === 0 && !adding && <p className="text-sm text-muted-foreground">No automations yet.</p>}
        <ul className="grid gap-3">
          {items.map((a) => (
            <li key={a.id} className="grid gap-2 rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{a.name}</span>
                <span className="text-sm text-muted-foreground">{describe(a.schedule)}</span>
                <span className="flex-1" />
                <label className="flex items-center gap-2 text-sm">
                  On <Switch checked={a.enabled} onCheckedChange={(v) => patch(a.id, { enabled: v, nextRunAt: nextRun(a.schedule, new Date()).getTime() })} aria-label={`Turn ${a.name} on or off`} />
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={running === a.id}
                  onClick={async () => {
                    setRunning(a.id);
                    await runOnce(a);
                    setRunning(undefined);
                  }}
                >
                  {running === a.id ? <Loader2 className="animate-spin" /> : <Play />} Run now
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Delete ${a.name}`} onClick={() => update((s) => ({ ...s, automations: (s.automations ?? []).filter((x) => x.id !== a.id) }))}>
                  <Trash2 />
                </Button>
              </div>
              {a.enabled && <p className="text-xs text-muted-foreground">Next run: {new Date(a.nextRunAt).toLocaleString()}</p>}
              {a.runs.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm text-muted-foreground">Run history ({a.runs.length})</summary>
                  <ul className="mt-2 grid gap-2" aria-label={`${a.name} runs`}>
                    {a.runs.map((r) => (
                      <li key={r.at} className={`rounded-lg border p-3 text-sm ${r.ok ? "" : "border-destructive/40"}`}>
                        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                          {new Date(r.at).toLocaleString()} · {r.ok ? "finished" : "failed"}
                          {r.ok && (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                const id = crypto.randomUUID();
                                saveChat({
                                  id,
                                  title: `${a.name} (${new Date(r.at).toLocaleDateString()})`,
                                  model: a.model,
                                  updatedAt: Date.now(),
                                  messages: [
                                    { id: `${id}-u`, role: "user", parts: [{ type: "text", text: a.prompt }] },
                                    { id: `${id}-a`, role: "assistant", parts: [{ type: "text", text: r.text }] },
                                  ],
                                });
                                onOpenChat(id);
                              }}
                            >
                              <MessageSquare /> Continue in chat
                            </Button>
                          )}
                        </div>
                        <p className="line-clamp-6 whitespace-pre-wrap">{r.text}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
