"use client";

import { ExternalLink, Loader2, Plug, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { desktop } from "@/lib/desktop";
import { update, useStore, type McpServer } from "@/lib/store";
import { GitHubDashboard } from "./github";
import { GoogleCard } from "./google";

const GITHUB_MCP = "https://api.githubcopilot.com/mcp/";

async function fetchTools(s: Partial<McpServer>) {
  const res = await fetch("/api/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(s) });
  const data = (await res.json().catch(() => ({}))) as { tools?: McpServer["tools"]; error?: string };
  if (!res.ok || !data.tools) throw new Error(data.error ?? "Couldn't connect. Try again.");
  return data.tools;
}

const save = (s: McpServer) => update((st) => ({ ...st, mcpServers: [...(st.mcpServers ?? []).filter((x) => x.id !== s.id), s] }));
const patch = (id: string, p: Partial<McpServer>) => update((st) => ({ ...st, mcpServers: (st.mcpServers ?? []).map((x) => (x.id === id ? { ...x, ...p } : x)) }));

function AddConnector({ preset, onDone }: { preset?: "github"; onDone: () => void }) {
  const isDesktop = !!desktop();
  const [kind, setKind] = useState<"http" | "stdio">("http");
  const [name, setName] = useState(preset === "github" ? "GitHub" : "");
  const [url, setUrl] = useState(preset === "github" ? GITHUB_MCP : "");
  const [token, setToken] = useState("");
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const parts = command.trim().split(/\s+/);
      const base: Partial<McpServer> =
        kind === "http" ? { id: crypto.randomUUID(), name: name.trim(), kind, url: url.trim(), token: token.trim() || undefined } : { id: crypto.randomUUID(), name: name.trim(), kind, command: parts[0], args: parts.slice(1) };
      if (kind === "stdio" && !(await desktop()!.mcp.approve(base.command!, base.args!))) {
        setBusy(false);
        return setError("Not allowed. The connector wasn't added.");
      }
      const tools = await fetchTools(base);
      save({ ...(base as McpServer), enabled: true, preset, tools, policy: {} });
      toast.success(`${base.name} connected with ${tools.length} tools. The AI will ask before using each one.`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border p-4">
      <h3 className="font-semibold">{preset === "github" ? "Connect GitHub" : "Add a connector"}</h3>
      {preset === "github" ? (
        <p className="text-sm text-muted-foreground">
          Paste a GitHub token. Make one at{" "}
          <a className="text-primary underline-offset-4 hover:underline" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
            github.com/settings/personal-access-tokens
          </a>{" "}
          (read access to repositories, issues and pull requests is enough to start).
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Any MCP server works: paste its URL{isDesktop ? ", or run one on this computer with a command" : ""}.</p>
          {isDesktop && (
            <Select value={kind} onValueChange={(v) => setKind(v as "http" | "stdio")}>
              <SelectTrigger aria-label="Connector type" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="http">Server URL</SelectItem>
                <SelectItem value="stdio">Command on this computer</SelectItem>
              </SelectContent>
            </Select>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="mcp-name">Name</Label>
            <Input id="mcp-name" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: My notes" />
          </div>
          {kind === "http" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="mcp-url">Server URL</Label>
              <Input id="mcp-url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/mcp" />
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="mcp-cmd">Command</Label>
              <Input id="mcp-cmd" required value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx -y @modelcontextprotocol/server-filesystem C:\Users\me\Documents" />
            </div>
          )}
        </>
      )}
      {kind === "http" && (
        <div className="grid gap-1.5">
          <Label htmlFor="mcp-token">{preset === "github" ? "GitHub token" : "Access token (optional)"}</Label>
          <Input id="mcp-token" type="password" autoComplete="off" required={preset === "github"} value={token} onChange={(e) => setToken(e.target.value)} placeholder={preset === "github" ? "github_pat_…" : "Sent as a Bearer token"} />
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} {busy ? "Connecting…" : "Connect"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ConnectorCard({ s }: { s: McpServer }) {
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    setBusy(true);
    try {
      patch(s.id, { tools: await fetchTools(s) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="grid gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Plug className="size-4" />
        <span className="font-medium">{s.name}</span>
        <Badge variant="secondary">{s.tools.length} tools</Badge>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{s.kind === "http" ? s.url : [s.command, ...(s.args ?? [])].join(" ")}</span>
        <label className="flex items-center gap-2 text-sm">
          On <Switch checked={s.enabled} onCheckedChange={(v) => patch(s.id, { enabled: v })} aria-label={`Use ${s.name} in chats`} />
        </label>
        <Button variant="ghost" size="icon-sm" aria-label={`Refresh ${s.name} tools`} onClick={refresh} disabled={busy}>
          <RefreshCw className={busy ? "animate-spin" : ""} />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${s.name}`} onClick={() => update((st) => ({ ...st, mcpServers: (st.mcpServers ?? []).filter((x) => x.id !== s.id) }))}>
          <Trash2 />
        </Button>
      </div>
      <details>
        <summary className="cursor-pointer text-sm text-muted-foreground">Tool permissions</summary>
        <ul className="mt-2 grid max-h-80 gap-1 overflow-y-auto">
          {s.tools.map((t) => (
            <li key={t.name} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate" title={t.description}>
                {t.name}
              </span>
              <Select value={s.policy[t.name] ?? "ask"} onValueChange={(v) => patch(s.id, { policy: { ...s.policy, [t.name]: v as McpServer["policy"][string] } })}>
                <SelectTrigger size="sm" aria-label={`Permission for ${t.name}`} className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ask">Ask every time</SelectItem>
                  <SelectItem value="always">Always allow</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

export function Connections() {
  const servers = useStore((s) => s.mcpServers) ?? [];
  const [adding, setAdding] = useState<"custom" | "github">();
  const github = servers.find((s) => s.preset === "github");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-4xl gap-6 px-4 py-6">
        <section aria-labelledby="conn-h" className="grid gap-2">
          <h2 id="conn-h" className="text-lg font-semibold">Connections</h2>
          <p className="text-sm text-muted-foreground">
            Connected services give the AI tools it can use in any chat. You decide per tool whether it must ask first. Connectors use MCP, the open standard, so any MCP
            server works.
          </p>
          <div className="flex flex-wrap gap-2">
            {!github && (
              <Button onClick={() => setAdding("github")}>
                <Plug /> Connect GitHub
              </Button>
            )}
            <Button variant="outline" onClick={() => setAdding("custom")}>
              <Plus /> Add a connector
            </Button>
            <Button variant="ghost" asChild>
              <a href="https://modelcontextprotocol.io/examples" target="_blank" rel="noreferrer">
                Find MCP servers <ExternalLink />
              </a>
            </Button>
          </div>
        </section>
        {adding && <AddConnector key={adding} preset={adding === "github" ? "github" : undefined} onDone={() => setAdding(undefined)} />}
        <GoogleCard />
        {github?.token && <GitHubDashboard token={github.token} />}
        {servers.length > 0 && (
          <ul className="grid gap-3" aria-label="Your connectors">
            {servers.map((s) => (
              <ConnectorCard key={s.id} s={s} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
