"use client";

import { FolderOpen, FolderPlus, Loader2, RefreshCw, SquareTerminal, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { desktop, type AiProject } from "@/lib/desktop";

const KIND: Record<AiProject["kind"], string> = { claude: "Claude Code", codex: "Codex", gemini: "Gemini CLI", cursor: "Cursor", git: "Git repo", ollama: "Ollama model" };

function ago(t: number) {
  if (!t) return "unknown";
  const s = (Date.now() - t) / 1000;
  const fmt = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (s < 3600) return fmt.format(-Math.round(s / 60), "minute");
  if (s < 86400) return fmt.format(-Math.round(s / 3600), "hour");
  return fmt.format(-Math.round(s / 86400), "day");
}

export function Projects({ onResume }: { onResume: (command: string, cwd: string, title: string) => void }) {
  const bridge = desktop()!;
  const [folders, setFolders] = useState<string[]>([]);
  const [items, setItems] = useState<AiProject[]>();
  const [scanning, setScanning] = useState(false);

  const scan = useCallback(async () => {
    setScanning(true);
    try {
      setItems(await bridge.projects.scan());
    } finally {
      setScanning(false);
    }
  }, [bridge]);

  useEffect(() => {
    bridge.projects.folders().then((f) => {
      setFolders(f);
      if (f.length) scan();
    });
  }, [bridge, scan]);

  const change = async (p: Promise<string[]>) => {
    setFolders(await p);
    scan();
  };

  const open = (p: AiProject, editor?: "vscode" | "cursor") => bridge.openPath(p.path, editor).catch((e: Error) => toast.error(e.message));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6">
        <section aria-labelledby="proj-h" className="rounded-xl border p-4">
          <h2 id="proj-h" className="text-lg font-semibold">Local projects</h2>
          <p className="text-sm text-muted-foreground">
            Your Claude Code, Codex, Gemini CLI and Cursor work, git repos and Ollama models in one place. MoonlightC only reads the folders you allow
            here and never changes anything unless you click a button.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => change(bridge.projects.addKnown())}>Allow AI tool folders</Button>
            <Button variant="outline" onClick={() => change(bridge.projects.addFolder())}>
              <FolderPlus /> Add a folder with code
            </Button>
            {folders.length > 0 && (
              <Button variant="ghost" onClick={scan} disabled={scanning}>
                {scanning ? <Loader2 className="animate-spin" /> : <RefreshCw />} Rescan
              </Button>
            )}
          </div>
          {folders.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Allowed folders">
              {folders.map((f) => (
                <li key={f} className="flex items-center gap-1 rounded-md bg-muted py-0.5 pr-0.5 pl-2 text-xs">
                  <span className="max-w-72 truncate">{f}</span>
                  <Button variant="ghost" size="icon-xs" aria-label={`Stop scanning ${f}`} onClick={() => change(bridge.projects.removeFolder(f))}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {folders.length === 0 ? null : !items ? (
          <p className="text-sm text-muted-foreground">Scanning…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing found in the allowed folders yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <li key={p.kind + p.path} className="flex flex-col gap-2 rounded-xl border p-4">
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium" title={p.path}>{p.name}</span>
                  <Badge variant="secondary">{KIND[p.kind]}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground" title={p.path}>{p.path}</p>
                <p className="text-xs text-muted-foreground">{p.detail} · active {ago(p.lastActivity)}</p>
                <div className="mt-auto flex flex-wrap gap-1">
                  {p.kind !== "ollama" && (
                    <>
                      <Button size="xs" variant="outline" onClick={() => open(p)}>
                        <FolderOpen /> Folder
                      </Button>
                      <Button size="xs" variant="outline" onClick={() => open(p, "vscode")}>VS Code</Button>
                      <Button size="xs" variant="outline" onClick={() => open(p, "cursor")}>Cursor</Button>
                    </>
                  )}
                  {p.resume && (
                    <Button size="xs" onClick={() => onResume(p.resume!, p.kind === "ollama" || p.kind === "gemini" ? "" : p.path, p.name)}>
                      <SquareTerminal /> Resume
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
