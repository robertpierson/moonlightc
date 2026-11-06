"use client";

import { Code2, Files, FolderOpen, MessageSquare, Palette, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LookApplier } from "@/components/customize/look";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { desktop } from "@/lib/desktop";
import { SECURITY_LEVELS } from "@/lib/remote";
import { updateNow, useStore } from "@/lib/store";
import { supabase, useUser } from "@/lib/supabase/client";

const VIEWS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "cowork", label: "Cowork", icon: Files },
  { id: "code", label: "Code", icon: Code2 },
  { id: "projects", label: "Projects", icon: FolderOpen },
  { id: "studio", label: "Studio", icon: Palette },
  { id: "settings", label: "Settings", icon: Settings },
];

const ACCESS: Record<string, string> = { view: "Screen", control: "Mouse and keyboard", files: "Files", terminal: "Terminal", chat: "AI models" };

type Session = { clientId: string; name: string; tiers: string[] };

/** One row per device: a device can hold more than one session (its link to the PC, and its screen). */
export function devicesFrom(sessions: Session[]) {
  const byDevice = new Map<string, { id: string; name: string; tiers: Set<string>; clientIds: string[] }>();
  for (const s of sessions) {
    const id = s.clientId.split(":")[0];
    const d = byDevice.get(id) ?? { id, name: s.name, tiers: new Set<string>(), clientIds: [] };
    s.tiers.forEach((t) => d.tiers.add(t));
    d.clientIds.push(s.clientId);
    byDevice.set(id, d);
  }
  return [...byDevice.values()];
}

/** The small panel from the desktop app's tray icon: how MoonlightC is doing, and quick ways in. */
export function MiniPanel() {
  const b = desktop();
  const user = useUser();
  const remoteOn = useStore((s) => !!s.remoteEnabled);
  const [pc, setPc] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [keep, setKeep] = useState<boolean>();
  const [level, setLevel] = useState<number>();
  const [relayMinutes, setRelayMinutes] = useState<number>();

  useEffect(() => {
    if (!b) return;
    b.device.info().then((i) => setPc(i.name));
    b.settings.get().then((s) => setKeep(s.keepRunning));
    b.remote.state().then(setSessions);
    const off = b.remote.onState(setSessions);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && b.mini.hide();
    addEventListener("keydown", esc);
    return () => {
      off();
      removeEventListener("keydown", esc);
    };
  }, [b]);

  useEffect(() => {
    if (!user) return;
    const sb = supabase();
    sb.rpc("security_level").then(({ data }) => typeof data === "number" && setLevel(data));
    sb.rpc("relay_minutes_this_month").then(({ data }) => typeof data === "number" && setRelayMinutes(data));
  }, [user]);

  if (!b)
    return (
      <main className="grid min-h-dvh place-content-center gap-3 p-6 text-center text-sm">
        <p>This panel is part of the MoonlightC desktop app.</p>
        <Button asChild>
          <Link href="/app">Open MoonlightC</Link>
        </Button>
      </main>
    );

  const devices = devicesFrom(sessions);
  return (
    <main className="flex h-dvh flex-col gap-3 overflow-x-hidden overflow-y-auto bg-background p-3 text-sm text-foreground select-none">
      <LookApplier />
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="font-semibold">MoonlightC</h1>
        <span className="truncate text-xs text-muted-foreground">
          {pc} · {b.version}
        </span>
      </header>

      <section aria-label="Remote control" className="grid grid-cols-[minmax(0,1fr)] gap-2 rounded-lg border p-3">
        <label className="flex items-center justify-between gap-2">
          <span className="font-medium">Remote control</span>
          <Switch aria-label="Remote control" checked={remoteOn} onCheckedChange={(v) => updateNow((s) => ({ ...s, remoteEnabled: v }))} />
        </label>
        {devices.length === 0 ? (
          <p className="text-xs text-muted-foreground">{remoteOn ? "Nobody is connected." : "Your other devices can't reach this PC."}</p>
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{d.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[...d.tiers].map((t) => ACCESS[t] ?? t).join(", ")}</span>
                </span>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => d.clientIds.forEach((id) => b.remote.end(id, "disconnected at this PC"))}>
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        )}
        {user && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {level !== undefined && (
              <>
                <dt>Security</dt>
                <dd className="text-right">{SECURITY_LEVELS[level]?.name}</dd>
              </>
            )}
            {relayMinutes !== undefined && (
              <>
                <dt>Relay this month</dt>
                <dd className="text-right">{Math.round(relayMinutes / 60)} of 200 hours</dd>
              </>
            )}
          </dl>
        )}
        {user === null && <p className="text-xs text-muted-foreground">Sign in on this PC to use remote control (Settings).</p>}
      </section>

      {keep !== undefined && (
        <label className="flex items-center justify-between gap-2 rounded-lg border p-3">
          <span>
            <span className="block font-medium">Always on</span>
            <span className="block text-xs text-muted-foreground">Keeps the window open. The X won&apos;t close it.</span>
          </span>
          <Switch
            aria-label="Always on"
            checked={keep}
            onCheckedChange={(v) => {
              setKeep(v);
              b.settings.setKeepRunning(v);
            }}
          />
        </label>
      )}

      <nav aria-label="Open in MoonlightC" className="grid grid-cols-3 gap-1.5">
        {VIEWS.map((v) => (
          <button key={v.id} onClick={() => b.mini.open(v.id)} className="grid justify-items-center gap-1 rounded-lg border p-2 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <v.icon className="size-4" />
            {v.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto grid grid-cols-2 gap-1.5">
        <Button variant="outline" onClick={() => b.mini.quickAsk()}>
          <Sparkles /> Quick ask
        </Button>
        <Button variant="outline" onClick={() => b.mini.quit()}>
          {keep ? "Restart" : "Quit"}
        </Button>
      </div>
    </main>
  );
}
