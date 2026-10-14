"use client";

import { FolderOpen, Globe, Loader2, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { hasExtension } from "@/lib/browser-ext";
import { desktop } from "@/lib/desktop";
import { connectHomePc, disconnectHomePc, findHomePc, useHomePc } from "@/lib/home-pc";
import type { Device } from "@/lib/remote";
import { accountsEnabled, useUser } from "@/lib/supabase/client";

/** Top of Cowork: what the AI can reach right now, and how to give it more. Nothing is shared by default. */
export function CoworkAccess({ onOpenSettings }: { onOpenSettings: (section: "files" | "browser") => void }) {
  const b = desktop();
  const [folders, setFolders] = useState<string[]>([]);
  const [ext] = useState(hasExtension);
  useEffect(() => {
    b?.files.grants().then(setFolders);
  }, [b]);

  const chip = "flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm [&>svg]:size-4 [&>svg]:shrink-0";
  return (
    <section aria-label="What Cowork can use" className="grid gap-2 border-b p-3 sm:grid-cols-3">
      <div className={chip}>
        <FolderOpen />
        {b ? (
          <>
            <span className="min-w-0 flex-1 truncate">{folders.length ? `${folders.length} shared folder${folders.length > 1 ? "s" : ""}` : "No folders shared"}</span>
            <Button size="xs" variant="outline" onClick={() => b.files.grant().then(setFolders)}>
              Share a folder
            </Button>
          </>
        ) : accountsEnabled ? (
          <HomePcChip />
        ) : (
          <span className="text-muted-foreground">Your files: needs the desktop app</span>
        )}
      </div>
      <div className={chip}>
        <Monitor />
        <span className="min-w-0 flex-1 text-muted-foreground">{b ? "Screen: turn on Use this PC below (you approve each session)" : "Your screen: needs the desktop app"}</span>
      </div>
      <div className={chip}>
        <Globe />
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{ext ? "Browser: share a tab from the extension icon" : b ? "Browser tabs: use the Chrome extension in Chrome" : "Browser tabs: needs the Chrome extension"}</span>
        {!ext && !b && (
          <Button size="xs" variant="outline" onClick={() => onOpenSettings("browser")}>
            Set up
          </Button>
        )}
      </div>
    </section>
  );
}

/** On a phone or another computer: connect to your home PC so the AI can work in its folders. */
function HomePcChip() {
  const pc = useHomePc();
  const user = useUser();
  const [found, setFound] = useState<Device | null>();
  useEffect(() => {
    if (user)
      findHomePc()
        .then((d) => setFound(d ?? null))
        .catch(() => setFound(null));
  }, [user]);
  if (user === null)
    return (
      <span className="text-muted-foreground">
        Your files:{" "}
        <a className="text-link underline underline-offset-4" href="/signin?next=/app">
          sign in
        </a>{" "}
        to work on your home PC
      </span>
    );
  if (pc.client)
    return (
      <>
        <span className="min-w-0 flex-1 truncate">Working on {pc.device?.name}</span>
        <Button size="xs" variant="outline" onClick={() => disconnectHomePc()}>
          Disconnect
        </Button>
      </>
    );
  if (found === undefined) return <Loader2 className="animate-spin" aria-label="Looking for your home PC" />;
  if (!found) return <span className="text-muted-foreground">Your files: pick a home PC in the desktop app (Settings &gt; Remote control)</span>;
  return (
    <>
      <span className="min-w-0 flex-1 truncate" title={pc.error}>
        {pc.connecting ? `Approve on ${found.name}…` : pc.error ? "Couldn't connect" : `Home PC: ${found.name}`}
      </span>
      <Button size="xs" variant="outline" disabled={pc.connecting} onClick={() => connectHomePc(found)}>
        Connect
      </Button>
    </>
  );
}
