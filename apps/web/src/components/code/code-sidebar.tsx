"use client";

import { ChevronRight, FolderCode, MessageSquare, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { CodeProject } from "@/lib/code";
import { deleteProject, saveProject, useCodeProjects } from "@/lib/code-store";
import { NewProject } from "./new-project";

/** The Code sidebar: projects (each a group of chats, with its own files), like Chat's projects. */
export function CodeSidebar({ projectId, chatId, onSelect }: { projectId?: string; chatId?: string; onSelect: (projectId: string, chatId?: string) => void }) {
  const projects = useCodeProjects();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<string>();
  const [closed, setClosed] = useState<string[]>([]);

  const project = (p: CodeProject) => {
    const open = !closed.includes(p.id);
    const chats = [...(p.chats ?? [])].sort((a, b) => b.updatedAt - a.updatedAt);
    return (
      <li key={p.id} className="grid">
        <div className="group relative flex items-center">
          <button
            aria-label={`${open ? "Collapse" : "Expand"} ${p.name}`}
            aria-expanded={open}
            onClick={() => setClosed((c) => (open ? [...c, p.id] : c.filter((x) => x !== p.id)))}
            className="rounded p-1.5 hover:bg-accent"
          >
            <ChevronRight className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
          </button>
          {renaming === p.id ? (
            <form
              className="flex-1"
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
            <button
              onClick={() => onSelect(p.id)}
              aria-current={p.id === projectId && !chatId ? "page" : undefined}
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 pr-14 text-left text-sm hover:bg-accent aria-[current=page]:bg-accent"
            >
              <FolderCode className="size-4 shrink-0" />
              <span className="truncate font-mono text-[13px]">{p.name}</span>
            </button>
          )}
          <div className="absolute right-1 flex items-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:has-[[data-state=open]]:opacity-100">
            <Button variant="ghost" size="icon-xs" aria-label={`New chat in ${p.name}`} onClick={() => onSelect(p.id, crypto.randomUUID())}>
              <Plus />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label={`Options for ${p.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setRenaming(p.id)}>
                  <Pencil /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => confirm(`Delete the project "${p.name}" and its chats from this device?`) && deleteProject(p.id)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {open && (
          <ul className="ml-5 border-l pl-1" aria-label={`Chats in ${p.name}`}>
            {chats.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onSelect(p.id, c.id)}
                  aria-current={c.id === chatId ? "page" : undefined}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent aria-[current=page]:bg-accent"
                >
                  <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{c.title || "New chat"}</span>
                </button>
              </li>
            ))}
            {!chats.length && <li className="px-2 py-1 text-xs text-muted-foreground">No chats yet</li>}
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav aria-label="Code projects" className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <Button className="justify-start" onClick={() => setCreating(true)}>
        <Plus /> New project
      </Button>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <h3 className="px-2 py-1 font-mono text-[11px] tracking-wide text-muted-foreground">~/projects</h3>
        <ul className="grid gap-0.5">{projects.map(project)}</ul>
        {!projects.length && <p className="p-2 text-sm text-muted-foreground">Your code projects will appear here. Each project holds its files and its chats.</p>}
      </div>
      <NewProject open={creating} onOpenChange={setCreating} onCreate={(p) => onSelect(p.id)} />
    </nav>
  );
}
