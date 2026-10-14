"use client";

import { ExternalLink, Loader2, Plug, RefreshCw, Trash2 } from "lucide-react";
import { Review } from "@/components/mods/mods-view";
import { fetchMod, type InstalledMod } from "@/lib/mods";
import { Catalog } from "./catalog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { fetchTools, NeedsSignIn, save } from "@/components/connections/connections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { fetchMarketplace, fetchPlugin, parseGitHubInput, type ClaudePlugin, type MarketplaceEntry, type PluginMcp, type PluginSource } from "@/lib/claude-plugins";
import { desktop } from "@/lib/desktop";
import { beginMcpSignIn } from "@/lib/mcp-auth-client";
import { update, useStore } from "@/lib/store";

type Draft = Omit<ClaudePlugin, "id" | "enabled" | "installedAt">;
const serverId = (pluginId: string, server: string) => `plugin-${pluginId}-${server}`;
const ghLink = (s: PluginSource) => `https://github.com/${s.repo}${s.path ? `/tree/${s.ref}/${s.path}` : ""}`;
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Install Claude Code plugins from GitHub and use their skills, commands, agents and connectors here. */
export function ClaudePlugins() {
  const installed = useStore((s) => s.plugins) ?? [];
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState<string>();
  const [market, setMarket] = useState<{ name: string; entries: MarketplaceEntry[] }>();
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<Draft>();
  const [modReview, setModReview] = useState<InstalledMod>();
  const [error, setError] = useState("");

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(undefined);
  };

  const open = (source: PluginSource, name: string, entry?: Record<string, unknown>) =>
    run(`plugin:${name}`, async () => {
      setPreview(await fetchPlugin(source, name, entry));
    });

  const find = (e: React.FormEvent) => {
    e.preventDefault();
    const s = parseGitHubInput(link);
    if (!s) return setError("Paste a GitHub link (https://github.com/owner/repo) or owner/repo.");
    run("find", async () => {
      const entries = await fetchMarketplace(s);
      if (entries) {
        setMarket({ name: s.repo, entries });
        setPreview(undefined);
      } else setPreview(await fetchPlugin(s, s.path.split("/").pop() || s.repo.split("/")[1]));
    });
  };

  const install = (p: Draft) => {
    const existing = installed.find((x) => x.name === p.name);
    const plugin: ClaudePlugin = { ...p, id: existing?.id ?? crypto.randomUUID(), enabled: existing?.enabled ?? true, installedAt: Date.now() };
    update((s) => ({ ...s, plugins: [...(s.plugins ?? []).filter((x) => x.id !== plugin.id), plugin] }));
    setPreview(undefined);
    toast.success(`${p.displayName ?? p.name} ${existing ? "updated" : "installed"}.`);
  };

  const remove = (p: ClaudePlugin) => {
    update((s) => ({ ...s, plugins: (s.plugins ?? []).filter((x) => x.id !== p.id), mcpServers: (s.mcpServers ?? []).filter((m) => !m.id.startsWith(`plugin-${p.id}-`)) }));
    toast(`${p.displayName ?? p.name} removed.`);
  };

  const shown = market?.entries.filter((e) => `${e.name} ${e.description ?? ""} ${e.category ?? ""}`.toLowerCase().includes(query.toLowerCase())).slice(0, 60);

  return (
    <section aria-labelledby="plugins-h" className="mx-auto grid w-full max-w-5xl gap-6 px-4 pt-6">
      <div>
        <h2 id="plugins-h" className="text-lg font-semibold">
          Plugins &amp; mods
        </h2>
        <p className="text-sm text-muted-foreground">
          Add skills, slash commands, modes and connectors. Plugins made for Claude work here (hooks and command-line tools only work in Claude Code, so each one shows what it can and can&apos;t do before you install it).
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {busy?.startsWith("plugin:") && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Reading {busy.slice(7)}…
        </p>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(undefined)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{preview?.displayName ?? preview?.name}</DialogTitle>
            <DialogDescription>What this plugin adds to MoonlightC.</DialogDescription>
          </DialogHeader>
          {preview && <Preview plugin={preview} existing={installed.some((x) => x.name === preview.name)} onInstall={() => install(preview)} onCancel={() => setPreview(undefined)} />}
        </DialogContent>
      </Dialog>

      {installed.length > 0 && (
        <section aria-labelledby="installed-plugins-h" className="grid gap-2">
          <h3 id="installed-plugins-h" className="font-medium">
            Installed plugins
          </h3>
          <ul className="grid gap-3" aria-label="Installed plugins">
            {installed.map((p) => (
              <Installed key={p.id} plugin={p} busy={busy === `plugin:${p.name}`} onUpdate={() => open(p.source, p.name)} onRemove={() => remove(p)} />
            ))}
          </ul>
        </section>
      )}

      <Catalog onPlugin={(e) => open(e.source!, e.name, e.manifest)} onMod={(url) =>
          run(`plugin:${url.split("/").slice(-2, -1)[0] ?? "mod"}`, async () => {
            setModReview(await fetchMod(url));
          })
        }
      />
      {modReview && <Review mod={modReview} onClose={() => setModReview(undefined)} />}

      <section aria-labelledby="add-plugin-h" className="grid gap-2">
        <h3 id="add-plugin-h" className="font-medium">
          Add a plugin from GitHub
        </h3>
        <form onSubmit={find} className="flex gap-2">
          <Input aria-label="GitHub link or owner/repo" placeholder="https://github.com/owner/repo or owner/repo" value={link} onChange={(e) => setLink(e.target.value)} />
          <Button type="submit" variant="outline" disabled={!!busy}>
            {busy === "find" && <Loader2 className="animate-spin" />} Find plugin
          </Button>
        </form>
        {market && (
          <div className="grid gap-2 rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <span className="font-medium">{market.name}</span>
              <span className="text-sm text-muted-foreground">{count(market.entries.length, "plugin")}</span>
              <span className="flex-1" />
              <Button size="sm" variant="ghost" onClick={() => setMarket(undefined)}>
                Close
              </Button>
            </div>
            <Input aria-label="Search plugins" placeholder="Search plugins…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <ul className="grid max-h-96 gap-1 overflow-y-auto" aria-label="Plugins in this directory">
              {shown?.map((e) => (
                <li key={e.name} className="flex items-start gap-3 rounded-md p-2 hover:bg-accent/50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {e.name} {e.category && <Badge variant="secondary">{e.category}</Badge>}
                    </div>
                    {e.description && <p className="line-clamp-2 text-sm text-muted-foreground">{e.description}</p>}
                  </div>
                  {e.source ? (
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => open(e.source!, e.name, e.manifest)} aria-label={`View ${e.name}`}>
                      View
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not on GitHub</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </section>
  );
}

function Summary({ p }: { p: Draft }) {
  const parts = [p.skills.length && count(p.skills.length, "skill"), p.commands.length && count(p.commands.length, "command"), p.agents.length && count(p.agents.length, "mode"), p.mcp.length && count(p.mcp.length, "connector")].filter(Boolean);
  return <span className="text-sm text-muted-foreground">{parts.join(", ")}</span>;
}

function Preview({ plugin: p, existing, onInstall, onCancel }: { plugin: Draft; existing: boolean; onInstall: () => void; onCancel: () => void }) {
  return (
    <div role="region" aria-label={`Plugin ${p.name}`} className="grid gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{p.displayName ?? p.name}</span>
        {p.version && <Badge variant="secondary">v{p.version}</Badge>}
        <Summary p={p} />
        <a className="ml-auto text-sm text-link underline underline-offset-4" href={ghLink(p.source)} target="_blank" rel="noreferrer">
          Source <ExternalLink className="inline size-3" />
        </a>
      </div>
      {p.description && <p className="text-sm">{p.description}</p>}
      <dl className="grid gap-2 text-sm">
        {p.skills.length > 0 && <Item label="Skills (the AI loads them when a request matches)" items={p.skills.map((s) => `${s.name}: ${s.description}`)} />}
        {p.commands.length > 0 && <Item label="Slash commands (type them in the message box)" items={p.commands.map((c) => `/${c.name}${c.argumentHint ? ` ${c.argumentHint}` : ""}${c.description ? `: ${c.description}` : ""}`)} />}
        {p.agents.length > 0 && <Item label="Modes (from the plugin's agents)" items={p.agents.map((a) => `${a.name}${a.description ? `: ${a.description}` : ""}`)} />}
        {p.mcp.length > 0 && <Item label="Connectors (you connect each one after installing)" items={p.mcp.map((m) => (m.kind === "http" ? `${m.name}: ${m.url}` : `${m.name}: runs "${[m.command, ...(m.args ?? [])].join(" ")}" (desktop app only)`))} />}
        {p.unsupported.length > 0 && <Item label="Not supported in MoonlightC" items={p.unsupported} />}
      </dl>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onInstall}>{existing ? "Update plugin" : "Install plugin"}</Button>
      </div>
    </div>
  );
}

function Item({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <dt className="font-medium">{label}</dt>
      <dd>
        <ul className="list-disc pl-5 text-muted-foreground">
          {items.slice(0, 20).map((t) => (
            <li key={t} className="line-clamp-2">
              {t}
            </li>
          ))}
          {items.length > 20 && <li>and {items.length - 20} more</li>}
        </ul>
      </dd>
    </div>
  );
}

function Installed({ plugin: p, busy, onUpdate, onRemove }: { plugin: ClaudePlugin; busy: boolean; onUpdate: () => void; onRemove: () => void }) {
  const servers = useStore((s) => s.mcpServers) ?? [];
  const [connecting, setConnecting] = useState<string>();
  const connect = async (m: PluginMcp) => {
    const base = { id: serverId(p.id, m.name), name: `${p.name}: ${m.name}`, kind: m.kind, url: m.url, command: m.command, args: m.args };
    setConnecting(m.name);
    try {
      if (m.kind === "stdio" && !(await desktop()!.mcp.approve(m.command!, m.args ?? []))) return;
      const tools = await fetchTools(base);
      save({ ...base, enabled: true, tools, policy: {} });
      toast.success(`${base.name} connected with ${tools.length} tools. The AI will ask before using each one.`);
    } catch (e) {
      if (e instanceof NeedsSignIn) await beginMcpSignIn({ id: base.id, name: base.name, url: m.url! });
      else toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(undefined);
    }
  };
  return (
    <li className="grid gap-2 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{p.displayName ?? p.name}</span>
        <Summary p={p} />
        <span className="flex-1" />
        <label className="flex items-center gap-2 text-sm">
          On <Switch checked={p.enabled} aria-label={`Use ${p.name}`} onCheckedChange={(v) => update((s) => ({ ...s, plugins: (s.plugins ?? []).map((x) => (x.id === p.id ? { ...x, enabled: v } : x)) }))} />
        </label>
        <Button size="icon" variant="ghost" aria-label={`Update ${p.name}`} disabled={busy} onClick={onUpdate}>
          <RefreshCw className={busy ? "animate-spin" : ""} />
        </Button>
        <Button size="icon" variant="ghost" aria-label={`Remove ${p.name}`} onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>
      {p.commands.length > 0 && <p className="text-sm text-muted-foreground">Commands: {p.commands.map((c) => `/${c.name}`).join(", ")}</p>}
      {p.mcp.map((m) => {
        const on = servers.some((s) => s.id === serverId(p.id, m.name));
        const blocked = m.kind === "stdio" && !desktop();
        return (
          <div key={m.name} className="flex flex-wrap items-center gap-2 text-sm">
            <Plug className="size-4" /> {m.name}
            {on ? (
              <span className="text-muted-foreground">Connected (manage it in Connectors)</span>
            ) : blocked ? (
              <span className="text-muted-foreground">Needs the MoonlightC desktop app</span>
            ) : (
              <Button size="xs" variant="outline" disabled={connecting === m.name} onClick={() => connect(m)}>
                {connecting === m.name && <Loader2 className="animate-spin" />} Connect
              </Button>
            )}
          </div>
        );
      })}
    </li>
  );
}
