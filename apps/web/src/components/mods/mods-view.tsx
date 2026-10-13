"use client";

import { ModIndexSchema } from "@moonc/mods-sdk";
import { Loader2, Puzzle, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { fetchMod, installMod, REGISTRY, removeMod, sandboxDocument, setModEnabled, type InstalledMod } from "@/lib/mods";
import { useStore } from "@/lib/store";

type Listing = { id: string; name: string; description: string; manifest: string };

const PERMISSION_TEXT: Record<string, string> = {
  tools: "Give the AI new tools. You'll see when the AI uses them.",
  panel: "Show its own panel inside MoonlightC.",
  network: "Connect to the internet from its sandbox.",
};

function Review({ mod, onClose }: { mod: InstalledMod; onClose: () => void }) {
  const m = mod.manifest;
  const adds = [
    m.tools.length && `${m.tools.length} AI tool${m.tools.length > 1 ? "s" : ""}: ${m.tools.map((t) => t.name).join(", ")}`,
    m.commands.length && `Slash commands: ${m.commands.map((c) => c.name).join(", ")}`,
    m.personas.length && `Modes: ${m.personas.map((p) => p.name).join(", ")}`,
    m.themes.length && `Themes: ${m.themes.map((t) => t.name).join(", ")}`,
    m.panel && `A panel: ${m.panel.title}`,
  ].filter(Boolean) as string[];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install {m.name}?</DialogTitle>
          <DialogDescription>
            Version {m.version} by {m.author}. {m.description}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <div>
            <div className="font-medium">It adds</div>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">{adds.length ? adds.map((a) => <li key={a}>{a}</li>) : <li>Nothing visible</li>}</ul>
          </div>
          <div>
            <div className="font-medium">It asks permission to</div>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {m.permissions.length ? m.permissions.map((p) => <li key={p}>{PERMISSION_TEXT[p]}</li>) : <li>Nothing beyond what it adds</li>}
            </ul>
          </div>
          <p className="flex gap-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0" />
            Mod code runs in a sealed sandbox. It can&apos;t see your keys, chats or settings, and it only gets the inputs the AI sends to its tools.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              installMod(mod);
              toast.success(`${m.name} installed.`);
              onClose();
            }}
          >
            Install
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ModsView() {
  const installed = useStore((s) => s.mods) ?? [];
  const [listings, setListings] = useState<Listing[]>();
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<string>();
  const [review, setReview] = useState<InstalledMod>();
  const [url, setUrl] = useState("");

  useEffect(() => {
    fetch(REGISTRY)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((j) => setListings(ModIndexSchema.parse(j).mods))
      .catch(() => setLoadError("Couldn't load the Mod Store. Check your internet connection."));
  }, []);

  const open = async (manifestUrl: string) => {
    setBusy(manifestUrl);
    try {
      setReview(await fetchMod(manifestUrl));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {review && <Review mod={review} onClose={() => setReview(undefined)} />}
      <div className="mx-auto grid max-w-4xl gap-8 px-4 py-6">
        <section aria-labelledby="store-h" className="grid gap-3">
          <div>
            <h2 id="store-h" className="text-lg font-semibold">Mod Store</h2>
            <p className="text-sm text-muted-foreground">Mods add tools, commands, modes and themes. Anyone can publish one; every mod shows what it can do before you install it.</p>
          </div>
          {loadError && <p className="text-sm text-destructive">{loadError}</p>}
          {!listings && !loadError && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
          {listings && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {listings.map((l) => {
                const have = installed.find((i) => i.manifest.id === l.id);
                return (
                  <li key={l.id} className="flex flex-col gap-2 rounded-xl border p-4">
                    <div className="flex items-center gap-2 font-medium">
                      <Puzzle className="size-4" /> {l.name}
                    </div>
                    <p className="flex-1 text-sm text-muted-foreground">{l.description}</p>
                    {have ? (
                      <span className="text-sm text-muted-foreground">Installed (v{have.manifest.version})</span>
                    ) : (
                      <Button size="sm" className="justify-self-start" disabled={!!busy} onClick={() => open(l.manifest)}>
                        {busy === l.manifest && <Loader2 className="animate-spin" />} Install
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) open(url.trim());
            }}
          >
            <Input aria-label="Mod manifest URL" placeholder="Install from a link: https://…/moonlightc-mod.json" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button type="submit" variant="outline" disabled={!!busy}>
              Check
            </Button>
          </form>
        </section>

        {installed.length > 0 && (
          <section aria-labelledby="installed-mods-h" className="grid gap-3">
            <h2 id="installed-mods-h" className="text-lg font-semibold">
              Installed mods
            </h2>
            <ul className="grid gap-3">
              {installed.map((m) => (
                <li key={m.manifest.id} className="grid gap-3 rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{m.manifest.name}</span>
                    <Badge variant="secondary">v{m.manifest.version}</Badge>
                    {m.manifest.tools.length > 0 && <Badge variant="outline">{m.manifest.tools.length} tools</Badge>}
                    <span className="flex-1" />
                    <label className="flex items-center gap-2 text-sm">
                      On <Switch checked={m.enabled} onCheckedChange={(v) => setModEnabled(m.manifest.id, v)} aria-label={`Turn ${m.manifest.name} on or off`} />
                    </label>
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.manifest.name}`} onClick={() => removeMod(m.manifest.id)}>
                      <Trash2 />
                    </Button>
                  </div>
                  {m.enabled && m.manifest.panel && m.code && (
                    <iframe title={m.manifest.panel.title} sandbox="allow-scripts" srcDoc={sandboxDocument(m.code, true)} className="h-72 w-full rounded-lg border bg-white" />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
