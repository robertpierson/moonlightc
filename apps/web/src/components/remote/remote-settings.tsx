"use client";

import { Monitor, X } from "lucide-react";
import { useEffect, useState } from "react";
import { TwoStepGate } from "@/components/account/two-step-gate";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { desktop, type RemoteSession } from "@/lib/desktop";
import { TIER_LABELS, type Tier } from "@/lib/remote";
import { update, useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";

/** Desktop app: Settings > Remote control. Off by default. */
export function RemoteSettings({ onSetup }: { onSetup: () => void }) {
  const b = desktop()!;
  const enabled = useStore((s) => !!s.remoteEnabled);
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [home, setHome] = useState(false);
  const [trust, setTrust] = useState(false);
  const [sessions, setSessions] = useState<RemoteSession[]>([]);
  const [grants, setGrants] = useState<{ clientId: string; name: string; tiers: string[] }[]>([]);
  const [log, setLog] = useState<{ at: string; action: string; name?: string }[]>([]);
  useEffect(() => {
    b.device.info().then(async (i) => {
      setName(i.name);
      setId(i.id);
      const { data } = await supabase().from("devices").select("is_home").eq("id", i.id).maybeSingle();
      setHome(!!data?.is_home);
    });
    b.remote.state().then(setSessions);
    b.remote.grants().then(setGrants);
    b.remote.trusted().then(setTrust);
    b.remote.audit().then(setLog);
    return b.remote.onState((s) => {
      setSessions(s);
      b.remote.audit().then(setLog);
    });
  }, [b]);
  const tiers = (t: string[]) => t.map((x) => TIER_LABELS[x as Tier] ?? x).join(", ");

  return (
    <TwoStepGate onSetup={onSetup}>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div className="grid gap-0.5">
            <span className="font-medium">Let my other devices control this PC</span>
            <span className="text-sm text-muted-foreground">
              This PC shows up as <strong>{name || "…"}</strong> under Cowork &gt; Your computers on your phone or other computers. Each new device has to be allowed here first.
            </span>
          </div>
          <Switch aria-label="Let my other devices control this PC" checked={enabled} onCheckedChange={(v) => update((s) => ({ ...s, remoteEnabled: v }))} />
        </div>

        {enabled && id && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
            <div className="grid gap-0.5">
              <span className="font-medium">Make this my home PC</span>
              <span className="text-sm text-muted-foreground">On your phone or laptop, Cowork can then work in this PC&apos;s folders and run commands here (you approve each change). Leave this PC on and signed in.</span>
            </div>
            <Switch
              aria-label="Make this my home PC"
              checked={home}
              onCheckedChange={async (v) => {
                if (v) await supabase().from("devices").update({ is_home: false }).neq("id", id);
                const { error } = await supabase().from("devices").update({ is_home: v }).eq("id", id);
                if (!error) setHome(v);
              }}
            />
          </div>
        )}

        {enabled && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
            <div className="grid gap-0.5">
              <span className="font-medium">Allow my devices without asking</span>
              <span className="text-sm text-muted-foreground">
                For when you&apos;re away from this PC: your own devices (signed in with two-step sign-in) connect without clicking Allow here. The orange frame, notification, activity log and Ctrl+Alt+Shift+M still work. Only turn this on if your account and authenticator are safe.
              </span>
            </div>
            <Switch aria-label="Allow my devices without asking" checked={trust} onCheckedChange={(v) => b.remote.setTrusted(v).then(setTrust)} />
          </div>
        )}

        <section aria-label="Connected now" className="grid gap-2">
          <h3 className="font-medium">Connected now</h3>
          {sessions.length ? (
            <ul className="divide-y rounded-lg border">
              {sessions.map((s) => (
                <li key={s.clientId} className="flex items-center gap-2 p-2 pl-3 text-sm">
                  <Monitor className="size-4" />
                  <span className="flex-1">
                    {s.name} <span className="text-muted-foreground">· {tiers(s.tiers)}</span>
                  </span>
                  <Button size="sm" variant="destructive" onClick={() => b.remote.end(s.clientId, "disconnected on this PC")}>
                    Disconnect
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nobody is connected. Ctrl+Alt+Shift+M always disconnects everyone.</p>
          )}
        </section>

        <section aria-label="Remembered devices" className="grid gap-2">
          <h3 className="font-medium">Remembered devices</h3>
          {grants.length ? (
            <ul className="divide-y rounded-lg border">
              {grants.map((g) => (
                <li key={g.clientId} className="flex items-center gap-2 p-2 pl-3 text-sm">
                  <span className="flex-1">
                    {g.name} <span className="text-muted-foreground">· {tiers(g.tiers)}</span>
                  </span>
                  <Button size="icon-sm" variant="ghost" aria-label={`Forget ${g.name}`} onClick={() => b.remote.revoke(g.clientId).then(setGrants)}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No devices remembered. Each connection asks you on this PC.</p>
          )}
        </section>

        {log.length > 0 && (
          <section aria-label="Remote control activity" className="grid gap-2">
            <h3 className="font-medium">Activity</h3>
            <ul className="grid max-h-64 gap-1 overflow-y-auto text-xs text-muted-foreground">
              {log.slice(0, 50).map((e, i) => (
                <li key={i}>
                  {new Date(e.at).toLocaleString()}: {e.action}
                  {e.name ? ` · ${e.name}` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </TwoStepGate>
  );
}
