"use client";

import { getProvider, PROVIDERS, type ModelInfo } from "@moonc/core";
import { ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { desktop } from "@/lib/desktop";
import { update, useStore, type SavedConnection } from "@/lib/store";

async function fetchModels(c: { providerId: string; apiKey: string; baseURL?: string }): Promise<ModelInfo[]> {
  const res = await fetch("/api/models", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(c) });
  const data = (await res.json().catch(() => ({}))) as { models?: ModelInfo[]; error?: string };
  if (!res.ok || !data.models) throw new Error(data.error ?? "Couldn't check that key. Try again.");
  if (data.models.length === 0 && !getProvider(c.providerId).media) throw new Error("That key works, but it doesn't unlock any chat models.");
  return data.models;
}

const SEARCH = [
  { id: "tavily", name: "Tavily", url: "https://app.tavily.com/home" },
  { id: "exa", name: "Exa", url: "https://dashboard.exa.ai/api-keys" },
  { id: "brave", name: "Brave Search", url: "https://api-dashboard.search.brave.com/app/keys" },
] as const;

function SearchKeySection() {
  const saved = useStore((s) => s.searchKey);
  const [provider, setProvider] = useState<(typeof SEARCH)[number]["id"]>("tavily");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const p = SEARCH.find((x) => x.id === provider)!;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/search-key", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider, key }) }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "Couldn't check that key. Try again.");
    update((s) => ({ ...s, searchKey: { provider, key: key.trim() }, webTools: true }));
    setKey("");
    toast.success(`${p.name} web search connected.`);
  }

  return (
    <section aria-label="Web search" className="grid gap-3 border-t pt-4">
      <div>
        <h3 className="font-medium">Web search</h3>
        <p className="text-sm text-muted-foreground">Optional. Lets the AI search the web when the Web button is on. Reading links works without a key.</p>
      </div>
      {saved ? (
        <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
          <span className="flex-1">
            {SEARCH.find((x) => x.id === saved.provider)?.name} · key ending {saved.key.slice(-4)}
          </span>
          <Button variant="ghost" size="icon" aria-label="Remove search key" onClick={() => update((s) => ({ ...s, searchKey: undefined }))}>
            <Trash2 />
          </Button>
        </div>
      ) : (
        <form onSubmit={save} className="grid gap-2">
          <div className="flex gap-2">
            <Select value={provider} onValueChange={(v) => setProvider(v as typeof provider)}>
              <SelectTrigger aria-label="Search provider" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEARCH.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="password" aria-label="Search API key" autoComplete="off" required placeholder="Paste key" value={key} onChange={(e) => setKey(e.target.value)} />
          </div>
          <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline">
            Get a key from {p.name} <ExternalLink className="size-3" />
          </a>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" variant="outline" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {busy ? "Checking…" : "Check and save search key"}
          </Button>
        </form>
      )}
    </section>
  );
}

export function KeysDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const connections = useStore((s) => s.connections);
  const [providerId, setProviderId] = useState("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState<string>();
  const provider = PROVIDERS.find((p) => p.id === providerId)!;
  const isCustom = providerId === "custom";
  const keyless = isCustom || !!provider.local;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const c = { providerId, apiKey: apiKey.trim(), baseURL: isCustom ? baseURL.trim() : undefined };
      const models = await fetchModels(c);
      const label = isCustom ? new URL(c.baseURL!).host : provider.name;
      const conn: SavedConnection = { ...c, id: crypto.randomUUID(), label, models, addedAt: Date.now() };
      update((s) => ({
        ...s,
        connections: [...s.connections, conn],
        lastModel: s.lastModel ?? (models[0] && { connectionId: conn.id, modelId: models[0].id }),
      }));
      setApiKey("");
      setBaseURL("");
      toast.success(provider.media ? `${label} connected. Use it in the Studio.` : `${label} connected: ${models.length} models unlocked.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function refresh(conn: SavedConnection) {
    setRefreshing(conn.id);
    try {
      const models = await fetchModels(conn);
      update((s) => ({ ...s, connections: s.connections.map((c) => (c.id === conn.id ? { ...c, models } : c)) }));
      toast.success(`${conn.label}: ${models.length} models.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(undefined);
    }
  }

  function remove(conn: SavedConnection) {
    update((s) => ({
      ...s,
      connections: s.connections.filter((c) => c.id !== conn.id),
      lastModel: s.lastModel?.connectionId === conn.id ? undefined : s.lastModel,
    }));
    toast(`${conn.label} key removed from this browser.`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Models and keys</DialogTitle>
          <DialogDescription>
            Bring your own key. MoonlightC checks it with the provider and shows every model it unlocks. Keys are saved in
            this browser only.
          </DialogDescription>
        </DialogHeader>

        {connections.length > 0 && (
          <ul className="divide-y rounded-lg border" aria-label="Connected providers">
            {connections.map((c) => (
              <li key={c.id} className="flex items-center gap-2 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.label}</div>
                  <div className="text-muted-foreground">
                    {getProvider(c.providerId).media ? "Studio" : `${c.models.length} models`} · key ending {c.apiKey.slice(-4) || "(none)"}
                  </div>
                </div>
                <Button variant="ghost" size="icon" aria-label={`Refresh ${c.label} models`} onClick={() => refresh(c)} disabled={refreshing === c.id}>
                  <RefreshCw className={refreshing === c.id ? "animate-spin" : ""} />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Remove ${c.label}`} onClick={() => remove(c)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={add} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="provider">Provider</Label>
            <Select value={providerId} onValueChange={(v) => { setProviderId(v); setError(""); }}>
              <SelectTrigger id="provider" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.filter((p) => !p.local || desktop()).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.id === "openrouter" ? " — one key, hundreds of models" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isCustom && (
            <div className="grid gap-1.5">
              <Label htmlFor="baseurl">Base URL</Label>
              <Input id="baseurl" required placeholder="https://your-server.com/v1" value={baseURL} onChange={(e) => setBaseURL(e.target.value)} />
            </div>
          )}
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="apikey">API key</Label>
              {provider.keyUrl && (
                <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline">
                  Get a key from {provider.name} <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            <Input
              id="apikey"
              type="password"
              autoComplete="off"
              required={!keyless}
              placeholder={keyless ? "Not needed for local servers" : "Paste your key"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {busy ? "Checking key…" : "Check key and connect"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Have Claude Pro or ChatGPT Plus? Those subscriptions can&apos;t be used by other apps (the providers don&apos;t
            allow it). Use an API key, or OpenRouter, here instead.
          </p>
        </form>
        <SearchKeySection />
      </DialogContent>
    </Dialog>
  );
}
