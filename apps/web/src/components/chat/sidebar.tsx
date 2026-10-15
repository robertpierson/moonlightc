"use client";

import { ChevronRight, Copy, Download, FolderInput, FolderOpen, History, MessageSquarePlus, MoreHorizontal, Pencil, Pin, PinOff, Plus, Search, Trash2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import { deleteForever, patchChat, restoreChat, trashChat, useStore, type Chat } from "@/lib/store";
import { chatText } from "@/lib/summarize";
import { InstallApp } from "@/components/site/install-app";
import { textOf } from "./message";

/** How many recent chats the sidebar shows; the rest live on the All chats page. */
export const RECENT_LIMIT = 15;

function exportMarkdown(c: Chat) {
  const md = `# ${c.title}\n\n` + c.messages.map((m) => `## ${m.role === "user" ? "You" : "Assistant"}\n\n${textOf(m)}`).join("\n\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
  a.download = `${c.title.replace(/[^\w\- ]+/g, "").trim() || "chat"}.md`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const byRecent = (a: Chat, b: Chat) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt;

function matches(c: Chat, q: string) {
  const needle = q.trim().toLowerCase();
  return !needle || c.title.toLowerCase().includes(needle) || c.messages.some((m) => textOf(m).toLowerCase().includes(needle));
}

/** A list of chats with the per-chat menu (pin, rename, move to project, export, delete). */
export function ChatList({ chats, activeId, onSelect, onDeleted, showProject }: { chats: Chat[]; activeId?: string; onSelect: (id: string) => void; onDeleted: (id: string) => void; showProject?: boolean }) {
  const projects = useStore((s) => s.projects) ?? [];
  const [renaming, setRenaming] = useState<string>();
  return (
    <ul className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-0.5">
      {chats.map((c) => (
        <li key={c.id} className="group relative min-w-0">
          {renaming === c.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = new FormData(e.currentTarget).get("title")?.toString().trim();
                if (v) patchChat(c.id, { title: v, titled: true });
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
                <span className="min-w-0 truncate">{c.title || "New chat"}</span>
                {showProject && c.projectId && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{projects.find((p) => p.id === c.projectId)?.name}</span>}
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
                  {projects.length > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <FolderInput /> Move to project
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {projects.map((p) => (
                          <DropdownMenuItem key={p.id} onSelect={() => patchChat(c.id, { projectId: p.id })}>
                            {p.name}
                          </DropdownMenuItem>
                        ))}
                        {c.projectId && <DropdownMenuItem onSelect={() => patchChat(c.id, { projectId: undefined })}>No project</DropdownMenuItem>}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  <DropdownMenuItem
                    onSelect={() =>
                      navigator.clipboard.writeText(`${c.title}

${chatText(c)}`).then(
                        () => toast.success("Chat copied."),
                        () => toast.error("Couldn't copy. Allow clipboard access and try again."),
                      )
                    }
                  >
                    <Copy /> Copy chat
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => dispatchEvent(new CustomEvent("moonc:continue", { detail: c.id }))}>
                    <MessageSquarePlus /> Continue in a new chat
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => exportMarkdown(c)}>
                    <Download /> Export as Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      trashChat(c.id);
                      onDeleted(c.id);
                      toast("Moved to Trash.", { action: { label: "Undo", onClick: () => restoreChat(c.id) } });
                    }}
                  >
                    <Trash2 /> Move to Trash
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The Chat sidebar: new chat, search, project folders, and only the most recent chats. */
export function Sidebar({
  activeId,
  onSelect,
  onNew,
  onAllChats,
  onOpenProject,
  workspace = "chat",
  top,
}: {
  top?: React.ReactNode;
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onAllChats: () => void;
  onOpenProject: (id: string) => void;
  workspace?: "chat" | "cowork";
}) {
  const allChats = useStore((s) => s.chats);
  const projects = useStore((s) => s.projects) ?? [];
  const chats = useMemo(() => allChats.filter((c) => (workspace === "cowork" ? c.workspace === "cowork" : c.workspace !== "cowork")), [allChats, workspace]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string[]>([]);
  const deleted = (id: string) => id === activeId && onNew();

  const found = useMemo(() => (q.trim() ? chats.filter((c) => matches(c, q)).sort(byRecent) : []), [chats, q]);
  const recent = useMemo(() => [...chats].sort(byRecent).slice(0, RECENT_LIMIT), [chats]);
  const label = workspace === "cowork" ? "task" : "chat";

  return (
    <nav aria-label="Chats" className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <Button onClick={onNew} className="justify-start">
        <Plus /> New {label}
      </Button>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label={`Search ${label}s`} placeholder={`Search ${label}s`} value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
      </div>
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        {q.trim() ? (
          found.length ? (
            <ChatList chats={found.slice(0, 100)} activeId={activeId} onSelect={onSelect} onDeleted={deleted} showProject />
          ) : (
            <p className="p-3 text-sm text-muted-foreground">No {label}s match.</p>
          )
        ) : (
          <>
            {top}
            {workspace === "chat" && projects.length > 0 && (
              <section aria-label="Your projects" className="mb-2">
                <h3 className="px-2.5 py-1 text-xs font-medium text-muted-foreground">Projects</h3>
                <ul className="grid gap-0.5">
                  {projects.map((p) => {
                    const inside = chats.filter((c) => c.projectId === p.id).sort(byRecent);
                    const isOpen = open.includes(p.id);
                    return (
                      <li key={p.id}>
                        <div className="flex items-center">
                          <button
                            aria-label={`${isOpen ? "Collapse" : "Expand"} ${p.name}`}
                            aria-expanded={isOpen}
                            onClick={() => setOpen((o) => (isOpen ? o.filter((x) => x !== p.id) : [...o, p.id]))}
                            className="rounded p-1.5 hover:bg-accent"
                          >
                            <ChevronRight className={`size-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                          </button>
                          <button onClick={() => onOpenProject(p.id)} className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-accent">
                            <FolderOpen className="size-4 shrink-0" />
                            <span className="truncate">{p.name}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{inside.length || ""}</span>
                          </button>
                        </div>
                        {isOpen && (
                          <div className="ml-5 border-l pl-1">
                            {inside.length ? <ChatList chats={inside} activeId={activeId} onSelect={onSelect} onDeleted={deleted} /> : <p className="px-2.5 py-1.5 text-xs text-muted-foreground">No chats yet.</p>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            <section aria-label="Recent">
              <h3 className="px-2.5 py-1 text-xs font-medium text-muted-foreground">Recent</h3>
              {recent.length ? (
                <ChatList chats={recent} activeId={activeId} onSelect={onSelect} onDeleted={deleted} />
              ) : (
                <p className="p-3 text-sm text-muted-foreground">Your {label}s will appear here.</p>
              )}
              {chats.length > RECENT_LIMIT && (
                <Button variant="ghost" size="sm" className="mt-1 w-full justify-start text-muted-foreground" onClick={onAllChats}>
                  <History /> All {label}s ({chats.length})
                </Button>
              )}
            </section>
          </>
        )}
      </div>
      <InstallApp className="rounded-md border px-3 py-2 text-left text-sm hover:bg-accent" />
    </nav>
  );
}

/** Every chat, searchable: the place older chats live once they drop off the sidebar. */
export function AllChats({ activeId, onSelect, onNew, workspace = "chat" }: { activeId?: string; onSelect: (id: string) => void; onNew: () => void; workspace?: "chat" | "cowork" }) {
  const allChats = useStore((s) => s.chats);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(100);
  const list = useMemo(() => allChats.filter((c) => (workspace === "cowork" ? c.workspace === "cowork" : c.workspace !== "cowork") && matches(c, q)).sort(byRecent), [allChats, q, workspace]);
  return (
    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
      <div className="mx-auto grid max-w-3xl gap-4 px-4 py-6">
        <h2 className="text-lg font-semibold">All {workspace === "cowork" ? "tasks" : "chats"}</h2>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search all chats" placeholder="Search by title or message" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
        {list.length ? (
          <ChatList chats={list.slice(0, limit)} activeId={activeId} onSelect={onSelect} onDeleted={(id) => id === activeId && onNew()} showProject />
        ) : (
          <p className="text-sm text-muted-foreground">{q ? "No chats match." : "No chats yet."}</p>
        )}
        {list.length > limit && (
          <Button variant="ghost" onClick={() => setLimit((n) => n + 100)}>
            Show more ({list.length - limit} more)
          </Button>
        )}
        <Trash />
      </div>
    </div>
  );
}

/** Chats moved to the Trash: restore them, or delete them for good. Emptied after 30 days. */
function Trash() {
  const trash = useStore((s) => s.trash) ?? [];
  if (!trash.length) return null;
  return (
    <section aria-label="Trash" className="grid gap-2 border-t pt-4">
      <div className="flex items-center gap-2">
        <h3 className="flex-1 font-medium">Trash</h3>
        <Button size="sm" variant="ghost" onClick={() => deleteForever()}>
          Empty Trash
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Chats here are deleted for good after 30 days.</p>
      <ul className="grid gap-1">
        {trash.map((c) => (
          <li key={c.id} className="flex min-w-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent">
            <span className="min-w-0 flex-1 truncate">{c.title || "New chat"}</span>
            <Button size="icon-sm" variant="ghost" aria-label={`Restore ${c.title}`} onClick={() => restoreChat(c.id)}>
              <Undo2 />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={`Delete ${c.title} for good`} onClick={() => deleteForever(c.id)}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
