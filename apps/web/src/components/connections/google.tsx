"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { desktop } from "@/lib/desktop";
import { update, useStore } from "@/lib/store";

/** Google (Gmail, Calendar, Drive). Hidden until the server has Google sign-in credentials. */
export function GoogleCard() {
  const g = useStore((s) => s.oauth?.google);
  const [avail, setAvail] = useState<{ ok: boolean; startBase: string }>();
  useEffect(() => {
    fetch("/api/oauth/providers")
      .then((r) => r.json())
      .then((d: { providers: { id: string }[]; startBase: string }) => setAvail({ ok: d.providers.some((p) => p.id === "google"), startBase: d.startBase }))
      .catch(() => setAvail({ ok: false, startBase: "" }));
  }, []);
  if (!g && !avail?.ok) return null;

  const connect = () => {
    const b = desktop();
    if (b) b.openExternal(`${avail!.startBase}/api/oauth/google/start?return=desktop`);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- an API route that redirects to Google needs a full page load
    else location.href = `${location.origin}/api/oauth/google/start`;
  };

  return (
    <section aria-label="Google" className="grid gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Google</span>
        <span className="text-sm text-muted-foreground">Gmail (read), Calendar, Drive (read), YouTube (read)</span>
        <span className="flex-1" />
        {g ? (
          <>
            <span className="text-sm">{g.email ?? "Connected"}</span>
            <label className="flex items-center gap-2 text-sm">
              Use in chats <Switch checked={g.enabled} onCheckedChange={(v) => update((s) => ({ ...s, oauth: { ...s.oauth, google: { ...s.oauth!.google!, enabled: v } } }))} />
            </label>
            <Button size="sm" variant="ghost" onClick={() => update((s) => ({ ...s, oauth: { ...s.oauth, google: undefined } }))}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button onClick={connect}>Connect Google</Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        The AI can search and read your email, see and add calendar events (it asks before adding), and find files in Drive, and search YouTube or list your channels and playlists. Your Google sign-in stays on this device.
        {g && (
          <>
            {" "}
            To remove MoonlightC&apos;s access completely, also visit{" "}
            <a className="text-primary underline-offset-4 hover:underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
              your Google account permissions <ExternalLink className="inline size-3" />
            </a>
            .
          </>
        )}
      </p>
    </section>
  );
}
