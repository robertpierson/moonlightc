"use client";

import { Plug, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";

export type ProjectTools = { connectorIds: string[]; pluginIds: string[] };

/** Pick which connectors (Vercel, Supabase, Canva, GitHub…) and Claude plugins/skills a project always has. */
export function ProjectToolsPicker({ value, onChange, onOpenConnectors }: { value: ProjectTools; onChange: (v: ProjectTools) => void; onOpenConnectors: () => void }) {
  const servers = useStore((s) => s.mcpServers) ?? [];
  const plugins = useStore((s) => s.plugins) ?? [];
  const toggle = (key: keyof ProjectTools, id: string) => onChange({ ...value, [key]: value[key].includes(id) ? value[key].filter((x) => x !== id) : [...value[key], id] });
  const row = (key: keyof ProjectTools, id: string, name: string, note: string) => (
    <label key={id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
      <input type="checkbox" className="size-4 accent-primary" checked={value[key].includes(id)} onChange={() => toggle(key, id)} />
      <span className="flex-1 truncate">{name}</span>
      <span className="text-xs text-muted-foreground">{note}</span>
    </label>
  );
  return (
    <div className="grid gap-4">
      <section aria-label="Connectors" className="grid gap-1">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Plug className="size-4" /> Connectors
        </h3>
        {servers.length ? (
          servers.map((s) => row("connectorIds", s.id, s.name, s.enabled ? "on everywhere" : `${s.tools.length} tools`))
        ) : (
          <p className="text-sm text-muted-foreground">No connectors yet.</p>
        )}
        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={onOpenConnectors}>
          Add a connector (Vercel, Supabase, Canva, GitHub…)
        </Button>
      </section>
      <section aria-label="Skills and plugins" className="grid gap-1">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Puzzle className="size-4" /> Skills and plugins
        </h3>
        {plugins.length ? (
          plugins.map((p) => row("pluginIds", p.id, p.displayName ?? p.name, `${p.skills.length} skills · ${p.commands.length} commands`))
        ) : (
          <p className="text-sm text-muted-foreground">No plugins installed. Add them in Settings &gt; Plugins &amp; mods.</p>
        )}
      </section>
    </div>
  );
}

export function ProjectToolsDialog({ open, onOpenChange, title, value, onChange, onOpenConnectors }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; value: ProjectTools; onChange: (v: ProjectTools) => void; onOpenConnectors: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Ticked connectors and skills are always available in this project, even if they&apos;re switched off elsewhere.</DialogDescription>
        </DialogHeader>
        <ProjectToolsPicker
          value={value}
          onChange={onChange}
          onOpenConnectors={() => {
            onOpenChange(false);
            onOpenConnectors();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
