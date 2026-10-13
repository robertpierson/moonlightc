"use client";

import { Download, MoreHorizontal, Pencil, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteChat, patchChat, useStore, type Chat } from "@/lib/store";
import { InstallApp } from "@/components/site/install-app";
import { textOf } from "./message";

function exportMarkdown(c: Chat) {
  const md = `# ${c.title}\n\n` + c.messages.map((m) => `## ${m.role === "user" ? "You" : "Assistant"}\n\n${textOf(m)}`).join("\n\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
  a.download = `${c.title.replace(/[^\w\- ]+/g, "").trim() || "chat"}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function Sidebar({
  activeId,
  onSelect,
  onNew,
  projectFilter,
  onProjectFilter,
}: {
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  projectFilter?: string;
  onProjectFilter: (id?: string) => void;
}) {
  const allChats = useStore((s) => s.chats);
  const projects = useStore((s) => s.projects) ?? [];
  const chats = useMemo(() => (projectFilter ? allChats.filter((c) => c.projectId === projectFilter) : allChats), [allChats, projectFilter]);
  const [q, setQ] = useState("");
  const [renaming, setRenaming] = useState<string>();

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = (c: Chat) => !needle || c.title.toLowerCase().includes(needle) || c.messages.some((m) => textOf(m).toLowerCase().includes(needle));
    // ponytail: renders every chat; virtualize when users have thousands.
    return chats.filter(hit).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
  }, [chats, q]);

  return (
    <nav aria-label="Chats" className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <Button onClick={onNew} className="justify-start">
        <Plus /> New chat
      </Button>
      {projects.length > 0 && (
        <Select value={projectFilter ?? "all"} onValueChange={(v) => onProjectFilter(v === "all" ? undefined : v)}>
          <SelectTrigger aria-label="Show chats from" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All chats</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Search chats" placeholder="Search chats" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 && <li className="p-3 text-sm text-muted-foreground">{q ? "No chats match." : "Your chats will appear here."}</li>}
        {list.map((c) => (
          <li key={c.id} className="group relative">
            {renaming === c.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = new FormData(e.currentTarget).get("title")?.toString().trim();
                  if (v) patchChat(c.id, { title: v });
                  setRenaming(undefined);
                }}
              >
                <Input name="title" aria-label="Chat name" autoFocus defaultValue={c.title} onBlur={(e) => e.currentTarget.form?.requestSubmit()} />
              </form>
            ) : (
              <>
                <button
                  onClick={() => onSelect(c.id)}
                  aria-current={c.id === activeId ? "page" : undefined}
                  className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-2 pr-9 text-left text-sm hover:bg-accent aria-[current=page]:bg-accent"
                >
                  {c.pinned && <Pin className="size-3 shrink-0 text-muted-foreground" />}
                  <span className="truncate">{c.title || "New chat"}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Options for ${c.title}`}
                      className="absolute top-1/2 right-1 -translate-y-1/2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 data-[state=open]:opacity-100"
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => patchChat(c.id, { pinned: !c.pinned })}>
                      {c.pinned ? <PinOff /> : <Pin />} {c.pinned ? "Unpin" : "Pin"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setRenaming(c.id)}>
                      <Pencil /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => exportMarkdown(c)}>
                      <Download /> Export as Markdown
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        deleteChat(c.id);
                        if (c.id === activeId) onNew();
                        toast("Chat deleted.");
                      }}
                    >
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </li>
        ))}
      </ul>
      <InstallApp className="rounded-md border px-3 py-2 text-left text-sm hover:bg-accent" />
    </nav>
  );
}
