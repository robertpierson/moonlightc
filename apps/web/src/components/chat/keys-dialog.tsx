"use client";

import { getProvider, PROVIDERS, type ModelInfo } from "@moonc/core";
import { track } from "@/lib/analytics";
import { ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { desktop } from "@/lib/desktop";
import { startOpenRouterSignIn } from "@/lib/openrouter-auth";
import { update, updateNow, useStore, type SavedConnection } from "@/lib/store";

async function fetchModels(c: {
  providerId: string;
  apiKey: string;
  baseURL?: string;
}): Promise<ModelInfo[]> {
  const res = await fetch("/api/models", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(c),
  });
  const data = (await res.json().catch(() => ({}))) as {
    models?: ModelInfo[];
    error?: string;
  };
  if (!res.ok || !data.models)
    throw new Error(data.error ?? "Couldn't check that key. Try again.");
  if (data.models.length === 0 && !getProvider(c.providerId).media)
    throw new Error("That key works, but it doesn't unlock any chat models.");
  return data.models;
}

const SEARCH = [
  { id: "tavily", name: "Tavily", url: "https://app.tavily.com/home" },
  { id: "exa", name: "Exa", url: "https://dashboard.exa.ai/api-keys" },
  {
    id: "brave",
    name: "Brave Search",
    url: "https://api-dashboard.search.brave.com/app/keys",
  },
] as const;

function SearchKeySection() {
  const saved = useStore((s) => s.searchKey);
  const [provider, setProvider] =
    useState<(typeof SEARCH)[number]["id"]>("tavily");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const p = SEARCH.find((x) => x.id === provider)!;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/search-key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, key }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as
      { error?: string } | undefined;
    setBusy(false);
    if (!res?.ok)
      return setError(data?.error ?? "Couldn't check that key. Try again.");
    update((s) => ({
      ...s,
      searchKey: { provider, key: key.trim() },
      webTools: true,
    }));
    setKey("");
    toast.success(`${p.name} web search connected.`);
  }

  return (
    <section aria-label="Web search" className="grid gap-3 border-t pt-4">
      <div>
        <h3 className="font-medium">Web search</h3>
        <p className="text-sm text-muted-foreground">
          Optional. Lets the AI search the web when the Web button is on.
          Reading links works without a key.
        </p>
      </div>
      {saved ? (
        <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
          <span className="flex-1">
            {SEARCH.find((x) => x.id === saved.provider)?.name} · key ending{" "}
            {saved.key.slice(-4)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove search key"
            onClick={() => update((s) => ({ ...s, searchKey: undefined }))}
          >
            <Trash2 />
          </Button>
        </div>
      ) : (
        <form onSubmit={save} className="grid gap-2">
          <div className="flex gap-2">
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as typeof provider)}
            >
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
            <Input
              type="password"
              aria-label="Search API key"
              autoComplete="off"
              required
              placeholder="Paste key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-link underline underline-offset-4"
          >
            Get a key from {p.name} <ExternalLink className="size-3" />
          </a>
          {error && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 p-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <Button type="submit" variant="outline" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}{" "}
            {busy ? "Checking…" : "Check and save search key"}
          </Button>
        </form>
      )}
    </section>
  );
}

/** One-click alternative to pasting a key: OpenRouter's sign-in returns a key for hundreds of models. */
export function OpenRouterSignIn({ compact }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const go = () => {
    setBusy(true);
    startOpenRouterSignIn().catch((e: Error) => toast.error(e.message)).finally(() => setBusy(false));
  };
  if (compact)
    return (
      <Button variant="outline" onClick={go} disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} Sign in with OpenRouter
      </Button>
    );
  return (
    <div className="grid gap-2 rounded-lg border p-3 text-sm">
      <p>Or sign in with OpenRouter for one key that reaches many companies&apos; models (you pay OpenRouter per use).</p>
      <Button variant="outline" onClick={go} disabled={busy} className="justify-self-start">
        {busy && <Loader2 className="animate-spin" />} Sign in with OpenRouter
      </Button>
    </div>
  );
}

/** Desktop app: find keys already set up on this PC (standard environment variables) and add the ones you pick. */
function ScanKeys() {
  const connections = useStore((s) => s.connections);
  const [found, setFound] = useState<{ provider: string; source: string; value: string; masked: string }[]>();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const have = (v: string) => connections.some((c) => c.apiKey === v);
  const scan = async () => {
    const list = await desktop()!.keys.scan();
    setFound(list);
    setPicked(list.filter((k) => !have(k.value)).map((k) => k.source));
  };
  // Opened from the "keys found on this PC" notice: show them straight away.
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("scan")) return;
    desktop()!
      .keys.scan()
      .then((list) => {
        setFound(list);
        setPicked(list.filter((k) => !have(k.value)).map((k) => k.source));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the dialog opens
  }, []);
  const addPicked = async () => {
    setBusy(true);
    let added = 0;
    for (const k of found ?? []) {
      if (!picked.includes(k.source) || have(k.value)) continue;
      try {
        const models = await fetchModels({ providerId: k.provider, apiKey: k.value });
        const conn: SavedConnection = { id: crypto.randomUUID(), providerId: k.provider, apiKey: k.value, label: getProvider(k.provider).name, models, addedAt: Date.now() };
        updateNow((s) => ({ ...s, connections: [...s.connections, conn], lastModel: s.lastModel ?? (models[0] && { connectionId: conn.id, modelId: models[0].id }) }));
        track("provider.connected", { provider: k.provider, via: "scan" });
        added++;
      } catch (e) {
        toast.error(`${getProvider(k.provider).name} (${k.source}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setBusy(false);
    if (added) toast.success(`Added ${added} key${added > 1 ? "s" : ""} from this PC.`);
  };
  return (
    <div className="grid gap-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1">Already have keys set up on this PC (for example for Claude Code or the OpenAI tools)?</span>
        <Button size="sm" variant="outline" onClick={scan}>
          Scan this PC for API keys
        </Button>
      </div>
      {found && !found.length && <p className="text-muted-foreground">No keys found in this PC&apos;s settings.</p>}
      {found && found.length > 0 && (
        <>
          <ul aria-label="Keys found on this PC" className="grid gap-1">
            {found.map((k) => (
              <li key={k.source}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 accent-primary" disabled={have(k.value)} checked={picked.includes(k.source)} onChange={() => setPicked((p) => (p.includes(k.source) ? p.filter((x) => x !== k.source) : [...p, k.source]))} />
                  <span className="flex-1">
                    {getProvider(k.provider).name} <span className="text-muted-foreground">· {k.source} · {k.masked}</span>
                  </span>
                  {have(k.value) && <span className="text-xs text-muted-foreground">Already added</span>}
                </label>
              </li>
            ))}
          </ul>
          <Button size="sm" className="justify-self-start" disabled={busy || !picked.some((p) => found.some((k) => k.source === p && !have(k.value)))} onClick={addPicked}>
            {busy && <Loader2 className="animate-spin" />} Check and add selected
          </Button>
        </>
      )}
    </div>
  );
}

export function KeysDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Models and keys</DialogTitle>
          <DialogDescription>
            Bring your own key. MoonlightC checks it with the provider and shows
            every model it unlocks. Keys are saved on this device only.
          </DialogDescription>
        </DialogHeader>
        <KeysPanel />
      </DialogContent>
    </Dialog>
  );
}

const QUICK = [
  ["anthropic", "Claude"],
  ["openai", "ChatGPT"],
  ["google", "Gemini"],
  ["xai", "Grok"],
  ["mistral", "Mistral"],
  ["deepseek", "DeepSeek"],
  ["groq", "Groq"],
  ["perplexity", "Perplexity"],
] as const;
const KEY_SHAPES: Record<string, RegExp> = { anthropic: /^sk-ant-/, openai: /^sk-(?!ant-|or-)/, google: /^AIza/, xai: /^xai-/, groq: /^gsk_/, perplexity: /^pplx-/ };
/** Copied text that plausibly is this company's key (one long token; known prefixes must match). */
export const looksLikeKey = (providerId: string, text: string) => /^[\w.-]{20,300}$/.test(text) && (KEY_SHAPES[providerId]?.test(text) ?? true);

/** Connected providers (keys masked) plus the add-a-key form. Used in the dialog and in Settings. */
export function KeysPanel() {
  const connections = useStore((s) => s.connections);
  const [providerId, setProviderId] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState<string>();
  // Quick connect: open the company's key page, then pick up the key you copy there when you come back.
  const [waiting, setWaiting] = useState<string>();
  const [picked, setPicked] = useState<string>();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!waiting) return;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const b = desktop();
      const text = (b ? await b.clipboard.readKey() : await navigator.clipboard?.readText().catch(() => null))?.trim();
      if (!text || !looksLikeKey(waiting, text) || connections.some((c) => c.apiKey === text)) return;
      setWaiting(undefined);
      setApiKey(text);
      setTimeout(() => form.current?.requestSubmit(), 50); // after the key is in the form
    };
    addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [waiting, connections]);
  const provider = PROVIDERS.find((p) => p.id === providerId)!;
  const isCustom = providerId === "custom";
  const keyless = isCustom || !!provider.local;
  const extra = isCustom
    ? { label: "Base URL", placeholder: "https://your-server.com/v1" }
    : providerId === "azure"
      ? {
          label: "Azure endpoint",
          placeholder: "https://my-resource.openai.azure.com",
        }
      : providerId === "bedrock"
        ? { label: "AWS region", placeholder: "us-east-1" }
        : undefined;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const c = {
        providerId,
        apiKey: apiKey.trim(),
        baseURL: extra ? baseURL.trim() : undefined,
      };
      const models = await fetchModels(c);
      const label = isCustom
        ? new URL(c.baseURL!).host
        : providerId === "azure"
          ? `Azure ${new URL(c.baseURL!).host.split(".")[0]}`
          : providerId === "bedrock"
            ? `Bedrock ${c.baseURL}`
            : provider.name;
      const conn: SavedConnection = {
        ...c,
        id: crypto.randomUUID(),
        label,
        models,
        addedAt: Date.now(),
      };
      updateNow((s) => ({
        ...s,
        connections: [...s.connections, conn],
        lastModel:
          s.lastModel ??
          (models[0] && { connectionId: conn.id, modelId: models[0].id }),
      }));
      setApiKey("");
      setBaseURL("");
      track("provider.connected", { provider: providerId });
      toast.success(
        provider.media
          ? `${label} connected. Use it in the Studio.`
          : `${label} connected: ${models.length} models unlocked.`,
      );
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
      update((s) => ({
        ...s,
        connections: s.connections.map((c) =>
          c.id === conn.id ? { ...c, models } : c,
        ),
      }));
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
      lastModel:
        s.lastModel?.connectionId === conn.id ? undefined : s.lastModel,
    }));
    toast(`${conn.label} key removed from this browser.`);
  }

  return (
    <div className="grid gap-4">
      {!connections.some((c) => c.providerId === "openrouter") && <OpenRouterSignIn />}
      {desktop() && <ScanKeys />}
      {connections.length > 0 && (
        <ul
          className="divide-y rounded-lg border"
          aria-label="Connected providers"
        >
          {connections.map((c) => (
            <li key={c.id} className="flex items-center gap-2 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.label}</div>
                <div className="text-muted-foreground">
                  {getProvider(c.providerId).media
                    ? "Studio"
                    : `${c.models.length} models`}{" "}
                  · key ending {c.apiKey.slice(-4) || "(none)"}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Refresh ${c.label} models`}
                onClick={() => refresh(c)}
                disabled={refreshing === c.id}
              >
                <RefreshCw
                  className={refreshing === c.id ? "animate-spin" : ""}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${c.label}`}
                onClick={() => remove(c)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <section aria-label="Quick connect" className="grid gap-2">
        <h3 className="text-sm font-medium">Quick connect</h3>
        <p className="text-xs text-muted-foreground">Pick a company, open its key page, create a key and copy it, then come back here. MoonlightC picks up the copied key, checks it and connects.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUICK.map(([id, name]) => (
            <Button
              key={id}
              type="button"
              variant="outline"
              aria-pressed={picked === id}
              onClick={() => {
                setProviderId(id);
                setError("");
                setWaiting(undefined);
                setPicked(id);
              }}
            >
              {name}
            </Button>
          ))}
        </div>
        {picked && !waiting && (
          <div className="grid gap-2 rounded-lg border p-3 text-sm">
            <p>
              Next: open <strong>{new URL(PROVIDERS.find((x) => x.id === picked)!.keyUrl).host}</strong> in a new tab, sign in there, and create an API key. MoonlightC never sees your password.
            </p>
            <a
              className="inline-flex items-center gap-1.5 justify-self-start rounded-lg border px-3 py-1.5 font-medium hover:bg-muted"
              href={PROVIDERS.find((x) => x.id === picked)!.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setWaiting(picked)}
            >
              Open {new URL(PROVIDERS.find((x) => x.id === picked)!.keyUrl).host} <ExternalLink className="size-3.5" />
            </a>
          </div>
        )}
        {waiting && (
          <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Waiting for your {QUICK.find(([id]) => id === waiting)?.[1]} key: copy it on the page that opened, then come back.
            <button type="button" className="underline" onClick={() => setWaiting(undefined)}>
              Cancel
            </button>
          </p>
        )}
      </section>

      <form ref={form} onSubmit={add} className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="provider">Provider</Label>
          <Select
            value={providerId}
            onValueChange={(v) => {
              setProviderId(v);
              setError("");
            }}
          >
            <SelectTrigger id="provider" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.filter((p) => !p.hidden && (!p.local || desktop())).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.id === "openrouter"
                    ? " — one key, hundreds of models"
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {extra && (
          <div className="grid gap-1.5">
            <Label htmlFor="baseurl">{extra.label}</Label>
            <Input
              id="baseurl"
              required
              placeholder={extra.placeholder}
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
            />
          </div>
        )}
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="apikey">API key</Label>
            {provider.keyUrl && (
              <a
                href={provider.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-link underline underline-offset-4"
              >
                Get a key from {provider.name}{" "}
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          <Input
            id="apikey"
            type="password"
            autoComplete="off"
            required={!keyless}
            placeholder={
              keyless ? "Not needed for local servers" : "Paste your key"
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 p-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {busy ? "Checking key…" : "Check key and connect"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Have Claude Pro or ChatGPT Plus? Those subscriptions can&apos;t be
          used by other apps (the providers don&apos;t allow it), and API keys
          are billed separately.
        </p>
        <p className="text-xs text-muted-foreground">
          Free ways to start: a Gemini key (Google&apos;s free tier covers the Flash models), a Groq key, free models on
          OpenRouter, or models running on your own PC (desktop app &gt; Model library).
        </p>
      </form>
      <SearchKeySection />
    </div>
  );
}
