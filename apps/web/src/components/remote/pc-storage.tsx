"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { ChevronRight, Download, File as FileIcon, Folder, FolderPlus, HardDrive, Loader2, Pencil, Trash2, Upload, X, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StorageListing } from "@/lib/desktop";
import { bytes, downloadFile, folderFor, StorageLink, uploadFile } from "@/lib/pc-storage";
import { joinChannel, leaveChannel, RemoteClient, subscribed, thisClient, whereAmI, type Device } from "@/lib/remote";

type Transfer = { id: string; name: string; up: boolean; done: number; total: number; stop: AbortController };

/** Your files in the "MoonlightC Storage" folder on one of your PCs: like a private cloud drive. */
export function PcStorage({ device }: { device: Device }) {
  const [link, setLink] = useState<StorageLink>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listing, setListing] = useState<StorageListing>();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [naming, setNaming] = useState<{ from?: string; value: string }>();
  const [drag, setDrag] = useState(false);
  const ch = useRef<RealtimeChannel | undefined>(undefined);
  const client = useRef<RemoteClient | undefined>(undefined);

  const close = useCallback(() => {
    link?.close();
    client.current?.call("disconnect").catch(() => {});
    if (ch.current) leaveChannel(ch.current);
    ch.current = undefined;
    client.current = undefined;
    setLink(undefined);
    setListing(undefined);
  }, [link]);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  useEffect(() => () => closeRef.current(), []);

  const open = async (l: StorageLink, path: string) => {
    try {
      setListing((await l.call<StorageListing>("list", { path })).r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      const c = await joinChannel(device.id, { key: `client:${crypto.randomUUID()}` });
      ch.current = c;
      const rc = new RemoteClient(c, "storage");
      client.current = rc;
      await subscribed(c);
      const r = await rc.call<{ allowed: boolean; reason?: string }>("connect", { tiers: ["storage"], where: await whereAmI() }, 30_000);
      if (!r.allowed) throw new Error(r.reason ?? "This PC didn't allow it.");
      const l = new StorageLink(rc);
      await l.open();
      setLink(l);
      // Your own folder for this device (made the first time), so each device keeps its things apart.
      const mine = folderFor(thisClient().name);
      const root = (await l.call<StorageListing>("list", { path: "" })).r;
      if (!root.entries.some((e) => e.dir && e.name === mine)) await l.call("mkdir", { path: "", name: mine });
      await open(l, mine);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      if (ch.current) leaveChannel(ch.current);
      ch.current = undefined;
    }
    setBusy(false);
  };

  const here = listing?.path ?? "";
  const join = (name: string) => (here ? `${here}/${name}` : name);
  const track = (t: Transfer) => setTransfers((x) => [...x, t]);
  const progress = (id: string) => (done: number, total: number) => setTransfers((x) => x.map((t) => (t.id === id ? { ...t, done, total } : t)));
  const untrack = (id: string) => setTransfers((x) => x.filter((t) => t.id !== id));

  const upload = async (files: FileList | File[]) => {
    if (!link) return;
    for (const f of [...files]) {
      const t: Transfer = { id: crypto.randomUUID(), name: f.name, up: true, done: 0, total: f.size, stop: new AbortController() };
      track(t);
      try {
        const saved = await uploadFile(link, here, f, progress(t.id), t.stop.signal);
        toast.success(`${saved} saved on ${device.name}.`);
      } catch (e) {
        if (!t.stop.signal.aborted) toast.error(e instanceof Error ? e.message : String(e));
      }
      untrack(t.id);
    }
    await open(link, here);
  };

  const download = async (name: string, size: number) => {
    if (!link) return;
    const t: Transfer = { id: crypto.randomUUID(), name, up: false, done: 0, total: size, stop: new AbortController() };
    track(t);
    try {
      await downloadFile(link, join(name), name, size, progress(t.id), t.stop.signal);
    } catch (e) {
      // Closing the save box isn't an error.
      if (!t.stop.signal.aborted && !(e instanceof DOMException && e.name === "AbortError")) toast.error(e instanceof Error ? e.message : String(e));
    }
    untrack(t.id);
  };

  const act = async (fn: () => Promise<unknown>, done: string) => {
    if (!link) return;
    try {
      await fn();
      toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
    await open(link, here);
  };

  if (!link)
    return (
      <section aria-labelledby="pc-storage-h" className="grid justify-items-start gap-3 rounded-xl border p-4">
        <h3 id="pc-storage-h" className="flex items-center gap-2 font-medium">
          <HardDrive className="size-4" /> Storage on {device.name}
        </h3>
        <p className="text-sm text-muted-foreground">Keep files in this PC&apos;s MoonlightC Storage folder and get them from anywhere. Nothing you store there ever runs on the PC.</p>
        <Button onClick={connect} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} {busy ? "Opening…" : "Open storage"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </section>
    );

  const crumbs = here ? here.split("/") : [];
  const pct = listing ? Math.min(100, (listing.used / listing.max) * 100) : 0;
  return (
    <section
      aria-labelledby="pc-storage-h"
      className={`grid gap-3 rounded-xl border p-4 ${drag ? "ring-2 ring-ring" : ""}`}
      onDragOver={(e) => (e.preventDefault(), setDrag(true))}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center gap-2">
        <h3 id="pc-storage-h" className="flex min-w-0 items-center gap-2 font-medium">
          <HardDrive className="size-4 shrink-0" /> <span className="truncate">Storage on {device.name}</span>
        </h3>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title={link.direct ? "Files go straight between your devices." : "Your networks don't allow a direct link, so files over 25 MB can't be sent right now."}>
          {link.direct ? (
            <>
              <Zap className="size-3" /> Direct link
            </>
          ) : (
            "Slow link: files up to 25 MB"
          )}
        </span>
        <span className="ml-auto" />
        <Button size="sm" variant="ghost" onClick={close}>
          Close
        </Button>
      </div>

      {listing && (
        <div className="grid gap-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {bytes(listing.used)} of {bytes(listing.max)} used. {bytes(listing.free)} free on the PC.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Folder" className="flex min-w-0 basis-full flex-wrap items-center gap-0.5 text-sm sm:basis-auto sm:flex-1">
          <button className="rounded px-1.5 py-0.5 hover:bg-accent" onClick={() => open(link, "")}>
            Storage
          </button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-0.5">
              <ChevronRight className="size-3.5 text-muted-foreground" />
              <button className="max-w-40 truncate rounded px-1.5 py-0.5 hover:bg-accent" aria-current={i === crumbs.length - 1 ? "page" : undefined} onClick={() => open(link, crumbs.slice(0, i + 1).join("/"))}>
                {c}
              </button>
            </span>
          ))}
        </nav>
        <Button size="sm" variant="outline" onClick={() => setNaming({ value: "" })}>
          <FolderPlus /> New folder
        </Button>
        <Button size="sm" asChild>
          <label>
            <Upload /> Upload
            <input
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const f = e.target.files;
                if (f?.length) upload([...f]);
                e.target.value = "";
              }}
            />
          </label>
        </Button>
      </div>

      {naming && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = naming.value.trim();
            if (!value) return;
            setNaming(undefined);
            if (naming.from) act(() => link.call("rename", { path: join(naming.from!), name: value }), `Renamed to ${value}.`);
            else act(() => link.call("mkdir", { path: here, name: value }), `Folder ${value} made.`);
          }}
        >
          <Input autoFocus aria-label={naming.from ? `New name for ${naming.from}` : "Folder name"} value={naming.value} maxLength={200} onChange={(e) => setNaming({ ...naming, value: e.target.value })} className="h-8 w-56" />
          <Button size="sm" type="submit">
            {naming.from ? "Rename" : "Make folder"}
          </Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setNaming(undefined)}>
            Cancel
          </Button>
        </form>
      )}

      {transfers.length > 0 && (
        <ul aria-label="Transfers" className="grid gap-2">
          {transfers.map((t) => (
            <li key={t.id} className="grid gap-1 text-sm">
              <div className="flex items-center gap-2">
                {t.up ? <Upload className="size-3.5" /> : <Download className="size-3.5" />}
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                <span className="text-xs text-muted-foreground">
                  {bytes(t.done)} of {bytes(t.total)}
                </span>
                <Button size="icon-xs" variant="ghost" aria-label={`Stop ${t.name}`} onClick={() => t.stop.abort()}>
                  <X />
                </Button>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${t.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={t.total ? Math.round((t.done / t.total) * 100) : 0}>
                <div className="h-full bg-primary transition-[width]" style={{ width: `${t.total ? (t.done / t.total) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <ul className="divide-y rounded-lg border">
        {listing?.entries
          .slice()
          .sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name))
          .map((e) => (
            <li key={e.name} className="flex items-center gap-1 pr-1">
              <button
                className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => (e.dir ? open(link, join(e.name)) : download(e.name, e.size ?? 0))}
                aria-label={e.dir ? `Open ${e.name}` : `Download ${e.name}`}
              >
                {e.dir ? <Folder className="size-4 shrink-0" /> : <FileIcon className="size-4 shrink-0" />}
                <span className="flex-1 truncate">{e.name}</span>
                {!e.dir && <span className="shrink-0 text-xs text-muted-foreground">{bytes(e.size ?? 0)}</span>}
                {!e.dir && <Download className="size-4 shrink-0 text-muted-foreground" />}
              </button>
              <Button size="icon-sm" variant="ghost" aria-label={`Rename ${e.name}`} onClick={() => setNaming({ from: e.name, value: e.name })}>
                <Pencil />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove ${e.name}`}
                onClick={() => confirm(`Move ${e.name} to the Recycle Bin on ${device.name}? You can get it back from there.`) && act(() => link.call("remove", { path: join(e.name) }), `${e.name} moved to the PC's Recycle Bin.`)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        {listing && !listing.entries.length && <li className="p-4 text-sm text-muted-foreground">Nothing here yet. Upload files, or drop them here.</li>}
      </ul>
    </section>
  );
}
