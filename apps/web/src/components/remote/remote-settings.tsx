"use client";

import { Monitor, X } from "lucide-react";
import { useEffect, useState } from "react";
import { TwoStepGate } from "@/components/account/two-step-gate";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { desktop, type Places, type RemoteSession } from "@/lib/desktop";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { TIER_LABELS, whereAmI, type Tier } from "@/lib/remote";
import { update, useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";

/** Desktop app: Settings > Remote control. Off by default. */
export function RemoteSettings({ onSetup }: { onSetup: () => void }) {
  const b = desktop()!;
  const enabled = useStore((s) => !!s.remoteEnabled);
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [mac, setMac] = useState<string>();
  const [home, setHome] = useState(false);
  const [trust, setTrust] = useState(false);
  const [sessions, setSessions] = useState<RemoteSession[]>([]);
  const [grants, setGrants] = useState<{ clientId: string; name: string; tiers: string[] }[]>([]);
  const [log, setLog] = useState<{ at: string; action: string; name?: string }[]>([]);
  useEffect(() => {
    b.device.info().then(async (i) => {
      setName(i.name);
      setId(i.id);
      setMac(i.mac);
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

        {enabled && <Places />}

        <details className="rounded-xl border p-4 text-sm">
          <summary className="cursor-pointer font-medium">Turn this PC on when you&apos;re away</summary>
          <div className="mt-2 grid gap-1 text-muted-foreground">
            <p>A PC that&apos;s off can&apos;t hear the internet, so something at home has to wake it:</p>
            <ol className="list-decimal pl-5">
              <li>In this PC&apos;s BIOS, turn on &quot;Wake on LAN&quot; (and in Windows: Device Manager &gt; network adapter &gt; Power Management &gt; allow it to wake the computer).</li>
              <li>Use your router&apos;s app (many have &quot;Wake-on-LAN&quot; or &quot;Wake device&quot;) with this address: <code className="text-foreground">{mac ?? "unknown"}</code>.</li>
              <li>Or: set the BIOS to &quot;power on after power loss&quot; and plug the PC into a smart plug you can switch from your phone.</li>
              <li>Or: a Wi-Fi &quot;PC power switch&quot; module (plugs onto the motherboard&apos;s power-button pins, works with a phone app) presses the power button for you from anywhere.</li>
            </ol>
            <p>Then open MoonlightC on start (Settings &gt; General) so it&apos;s ready to connect.</p>
          </div>
        </details>

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

const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};

/** Only allow remote control (seeing or controlling the screen) from chosen networks or countries. Off by default. */
function Places() {
  const b = desktop()!;
  const [p, setP] = useState<Places>();
  const [value, setValue] = useState("");
  useEffect(() => {
    b.remote.places().then(setP);
  }, [b]);
  if (!p) return null;
  const save = (next: Places) => b.remote.setPlaces(next).then(setP);
  const add = (kind: "ip" | "country", v: string, label = "") => {
    const val = kind === "country" ? v.trim().toUpperCase() : v.trim();
    if (!val || p.list.some((x) => x.kind === kind && x.value === val)) return;
    save({ ...p, list: [...p.list, { kind, value: val, label }] });
  };
  const addTyped = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (/^[a-z]{2}$/i.test(v)) add("country", v);
    else if (/^[0-9a-f.:*]{3,64}$/i.test(v)) add("ip", v);
    else return toast.error("Type a network address (like 203.0.113.7, or 203.0.113.* for the whole network) or a 2-letter country code (like US).");
    setValue("");
  };
  return (
    <section aria-label="Allowed places" className="grid gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <span className="font-medium">Only allow remote control from certain places</span>
          <span className="text-sm text-muted-foreground">Seeing or controlling this PC&apos;s screen works only from the networks or countries you add. AI models and files aren&apos;t affected.</span>
        </div>
        <Switch aria-label="Only allow remote control from certain places" checked={p.on} onCheckedChange={(on) => save({ ...p, on })} />
      </div>
      {p.on && (
        <>
          {!p.list.length && <p className="text-sm text-destructive">Nothing is allowed yet, so remote control is blocked everywhere. Add a place below.</p>}
          <ul className="grid gap-1 text-sm">
            {p.list.map((x) => (
              <li key={x.kind + x.value} className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
                <span className="flex-1">
                  {x.kind === "country" ? `${countryName(x.value)} (country)` : `Network ${x.value}`}
                  {x.label && <span className="text-muted-foreground"> · {x.label}</span>}
                </span>
                <Button size="icon-sm" variant="ghost" aria-label={`Remove ${x.value}`} onClick={() => save({ ...p, list: p.list.filter((y) => y !== x) })}>
                  <X />
                </Button>
              </li>
            ))}
          </ul>
          <form onSubmit={addTyped} className="flex flex-wrap gap-2">
            <Input aria-label="Network address or country code" placeholder="Network (203.0.113.7) or country (US)" value={value} onChange={(e) => setValue(e.target.value)} className="w-72" />
            <Button type="submit" variant="outline">
              Add
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                const w = (await whereAmI()) as { ip?: string } | undefined;
                if (w?.ip) add("ip", w.ip, "This PC's network");
                else toast.error("Couldn't find this PC's network address.");
              }}
            >
              Add this PC&apos;s network
            </Button>
          </form>
          {p.blocked.length > 0 && (
            <div className="grid gap-1">
              <span className="text-sm font-medium">Recently blocked</span>
              <ul className="grid gap-1 text-sm">
                {p.blocked.map((x) => (
                  <li key={x.ip + x.at} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5">
                    <span className="flex-1">
                      {x.ip}
                      {x.country && ` · ${x.city ? `${x.city}, ` : ""}${countryName(x.country)}`}
                      <span className="text-muted-foreground"> · {new Date(x.at).toLocaleString()}</span>
                    </span>
                    {x.verified && (
                      <>
                        <Button size="xs" variant="outline" onClick={() => add("ip", x.ip, x.city)}>
                          Allow this network
                        </Button>
                        {x.country && (
                          <Button size="xs" variant="ghost" onClick={() => add("country", x.country)}>
                            Allow {countryName(x.country)}
                          </Button>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
