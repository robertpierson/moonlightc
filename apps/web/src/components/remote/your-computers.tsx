"use client";

import { Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { isOnline, type Device } from "@/lib/remote";
import { accountsEnabled, supabase, useUser } from "@/lib/supabase/client";

export function useDevices() {
  const user = useUser();
  const [devices, setDevices] = useState<Device[]>([]);
  useEffect(() => {
    if (!accountsEnabled || !user) return;
    const load = () =>
      supabase()
        .from("devices")
        .select("id, name, os, remote_enabled, local_models, app_version, last_seen")
        .order("last_seen", { ascending: false })
        .then(({ data }) => setDevices((data as Device[]) ?? []));
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [user]);
  return devices;
}

/** Cowork sidebar: the computers signed in to your account, to open with remote control. */
export function YourComputers({ activeId, onOpen }: { activeId?: string; onOpen: (id: string) => void }) {
  const devices = useDevices();
  if (!devices.length) return null;
  return (
    <section aria-label="Your computers" className="mb-2">
      <h3 className="px-2.5 py-1 text-xs font-medium text-muted-foreground">Your computers</h3>
      <ul className="grid gap-0.5">
        {devices.map((d) => {
          const on = isOnline(d);
          return (
            <li key={d.id}>
              <button
                onClick={() => onOpen(d.id)}
                aria-current={d.id === activeId ? "page" : undefined}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent aria-[current=page]:bg-accent"
              >
                <Monitor className="size-4 shrink-0" />
                <span className="truncate">{d.name}</span>
                <span className={`ml-auto size-2 shrink-0 rounded-full ${on ? "bg-emerald-500" : "bg-muted-foreground/40"}`} aria-label={on ? "Online" : "Offline"} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
