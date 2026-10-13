"use client";

import { ChevronRight, FileCode2, Folder, FolderInput, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { CodeProject } from "@/lib/code";
import { deleteProject, saveProject, useCodeProjects } from "@/lib/code-store";
import { update, useStore } from "@/lib/store";
import { NewProject } from "./new-project";

/** The Code sidebar: code projects grouped in folders, like Claude Code's project list. */
export function CodeSidebar({ activeId, onSelect }: { activeId?: string; onSelect: (id: string) => void }) {
  const projects = useCodeProjects();
  const saved = useStore((s) => s.codeFolders) ?? [];
  const folders = [...new Set([...saved, ...projects.flatMap((p) => (p.folder ? [p.folder] : []))])].sort((a, b) => a.localeCompare(b));
  const [creating, setCreating] = useState<{ folder?: string }>();
  const [naming, setNaming] = useState(false);
  const [renaming, setRenaming] = useState<string>();
  const [closed, setClosed] = useState<string[]>([]);

  const item = (p: CodeProject) => (
    <li key={p.id} className="group relative">
      {renaming === p.id ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget).get("name")?.toString().trim();
            if (v) saveProject({ ...p, name: v.slice(0, 60), updatedAt: Date.now() });
            setRenaming(undefined);
          }}
        >
          <Input name="name" aria-label="Project name" autoFocus defaultValue={p.name} onBlur={(e) => e.currentTarget.form?.requestSubmit()} />
        </form>
      ) : (
        <>
          <button
            onClick={() => onSelect(p.id)}
            aria-current={p.id === activeId ? "page" : undefined}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 pr-8 text-left font-mono text-[13px] hover:bg-accent aria-[current=page]:bg-accent"
          >
            <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{p.name}</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label={`Options for ${p.name}`} className="absolute top-1/2 right-1 -translate-y-1/2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setRenaming(p.id)}>
                <Pencil /> Rename
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderInput /> Move to folder
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {folders.map((f) => (
                    <DropdownMenuItem key={f} onSelect={() => saveProject({ ...p, folder: f })}>
                      {f}
                    </DropdownMenuItem>
                  ))}
                  {p.folder && <DropdownMenuItem onSelect={() => saveProject({ ...p, folder: undefined })}>No folder</DropdownMenuItem>}
                  {!folders.length && <DropdownMenuItem disabled>Make a folder first</DropdownMenuItem>}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem variant="destructive" onSelect={() => confirm(`Delete the project "${p.name}" from this device?`) && deleteProject(p.id)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </li>
  );

  return (
    <nav aria-label="Code projects" className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <div className="flex gap-1">
        <Button className="flex-1 justify-start" onClick={() => setCreating({})}>
          <Plus /> New project
        </Button>
        <Button variant="outline" size="icon" aria-label="New folder" onClick={() => setNaming(true)}>
          <FolderPlus />
        </Button>
      </div>
      {naming && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget).get("folder")?.toString().trim().slice(0, 40);
            if (v) update((s) => ({ ...s, codeFolders: [...new Set([...(s.codeFolders ?? []), v])] }));
            setNaming(false);
          }}
        >
          <Input name="folder" aria-label="Folder name" placeholder="Folder name" autoFocus onBlur={(e) => e.currentTarget.form?.requestSubmit()} />
        </form>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <h3 className="px-2 py-1 font-mono text-[11px] tracking-wide text-muted-foreground">~/projects</h3>
        {folders.map((f) => {
          const inside = projects.filter((p) => p.folder === f);
          const open = !closed.includes(f);
          return (
            <section key={f} aria-label={`Folder ${f}`} className="mb-1">
              <div className="group flex items-center">
                <button
                  aria-expanded={open}
                  onClick={() => setClosed((c) => (open ? [...c, f] : c.filter((x) => x !== f)))}
                  className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <ChevronRight className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
                  <Folder className="size-4 shrink-0" />
                  <span className="truncate">{f}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{inside.length || ""}</span>
                </button>
                <Button variant="ghost" size="icon-xs" aria-label={`New project in ${f}`} onClick={() => setCreating({ folder: f })}>
                  <Plus />
                </Button>
                {!inside.length && (
                  <Button variant="ghost" size="icon-xs" aria-label={`Delete folder ${f}`} onClick={() => update((s) => ({ ...s, codeFolders: (s.codeFolders ?? []).filter((x) => x !== f) }))}>
                    <Trash2 />
                  </Button>
                )}
              </div>
              {open && <ul className="ml-4 border-l pl-1">{inside.length ? inside.map(item) : <li className="px-2 py-1 text-xs text-muted-foreground">Empty</li>}</ul>}
            </section>
          );
        })}
        <ul>{projects.filter((p) => !p.folder).map(item)}</ul>
        {!projects.length && <p className="p-2 text-sm text-muted-foreground">Your code projects will appear here.</p>}
      </div>
      <NewProject open={!!creating} onOpenChange={(o) => !o && setCreating(undefined)} folder={creating?.folder} onCreate={(p) => onSelect(p.id)} />
    </nav>
  );
}
