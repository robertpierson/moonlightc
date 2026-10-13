"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { desktop } from "@/lib/desktop";
import { update, useStore, type OAuthProviderId } from "@/lib/store";

const ACCOUNTS: { id: OAuthProviderId; name: string; what: string; description: string; revoke: string }[] = [
  {
    id: "google",
    name: "Google",
    what: "Gmail (read), Calendar, Drive (read), YouTube (read)",
    description: "The AI can search and read your email, see and add calendar events (it asks before adding), find files in Drive, and search YouTube or list your channels and playlists.",
    revoke: "https://myaccount.google.com/permissions",
  },
  {
    id: "spotify",
    name: "Spotify",
    what: "Now playing, search, play and pause, playlists",
    description: "The AI can see what's playing, find songs, start or pause music on your active Spotify device, and list your playlists.",
    revoke: "https://www.spotify.com/account/apps/",
  },
  {
    id: "slack",
    name: "Slack",
    what: "Channels, messages, search, send (asks first)",
    description: "The AI can list channels, read recent messages, search your Slack, and send messages as you (it always asks before sending).",
    revoke: "https://slack.com/apps/manage",
  },
  {
    id: "discord",
    name: "Discord",
    what: "Your servers",
    description: "The AI can list the Discord servers you're in. Discord doesn't let apps read your messages or DMs with this kind of sign-in.",
    revoke: "https://discord.com/channels/@me",
  },
];

function useAvailable() {
  const [avail, setAvail] = useState<{ ids: string[]; startBase: string }>({ ids: [], startBase: "" });
  useEffect(() => {
    fetch("/api/oauth/providers")
      .then((r) => r.json())
      .then((d: { providers: { id: string }[]; startBase: string }) => setAvail({ ids: d.providers.map((p) => p.id), startBase: d.startBase }))
      .catch(() => {});
  }, []);
  return avail;
}

/** Sign-in connections (Google, Spotify, Slack, Discord). Each is hidden until this server has that service's app set up. */
export function AccountCards() {
  const accounts = useStore((s) => s.oauth) ?? {};
  const avail = useAvailable();
  const shown = ACCOUNTS.filter((a) => accounts[a.id] || avail.ids.includes(a.id));
  if (!shown.length) return null;

  const connect = (id: OAuthProviderId) => {
    const b = desktop();
    if (b) b.openExternal(`${avail.startBase}/api/oauth/${id}/start?return=desktop`);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- an API route that redirects to the provider needs a full page load
    else window.location.assign(`${window.location.origin}/api/oauth/${id}/start`);
  };

  return (
    <>
      {shown.map((a) => {
        const acc = accounts[a.id];
        return (
          <section key={a.id} aria-label={a.name} className="grid gap-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{a.name}</span>
              <span className="text-sm text-muted-foreground">{a.what}</span>
              <span className="flex-1" />
              {acc ? (
                <>
                  <span className="text-sm">{acc.email ?? "Connected"}</span>
                  <label className="flex items-center gap-2 text-sm">
                    Use in chats <Switch checked={acc.enabled} onCheckedChange={(v) => update((s) => ({ ...s, oauth: { ...s.oauth, [a.id]: { ...s.oauth![a.id]!, enabled: v } } }))} />
                  </label>
                  <Button size="sm" variant="ghost" onClick={() => update((s) => ({ ...s, oauth: { ...s.oauth, [a.id]: undefined } }))}>
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button onClick={() => connect(a.id)}>Connect {a.name}</Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {a.description} Your sign-in stays on this device.
              {acc && (
                <>
                  {" "}
                  To remove access completely, also visit{" "}
                  <a className="text-link underline underline-offset-4" href={a.revoke} target="_blank" rel="noreferrer">
                    {a.name}&apos;s connected apps page <ExternalLink className="inline size-3" />
                  </a>
                  .
                </>
              )}
            </p>
          </section>
        );
      })}
    </>
  );
}
