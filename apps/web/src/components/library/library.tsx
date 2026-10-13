"use client";

import {
  Brain,
  FileText,
  FolderOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { isSupported, readAttachment } from "@/lib/attachments";
import { addMemory, update, useStore, type Project } from "@/lib/store";
import { ProjectToolsPicker } from "./project-tools";

const MAX_PROJECT_FILES_BYTES = 400_000;

function ProjectEditor({
  project,
  onDone,
  onOpenConnectors,
}: {
  project: Project;
  onDone: () => void;
  onOpenConnectors: () => void;
}) {
  const [p, setP] = useState(project);
  const used = p.files.reduce((n, f) => n + f.text.length, 0);
  return (
    <form
      className="grid gap-3 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        update((s) => ({
          ...s,
          projects: [
            ...(s.projects ?? []).filter((x) => x.id !== p.id),
            { ...p, name: p.name.trim() },
          ],
        }));
        onDone();
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="project-name">Project name</Label>
        <Input
          id="project-name"
          required
          maxLength={60}
          value={p.name}
          onChange={(e) => setP({ ...p, name: e.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="project-instructions">
          Instructions for every chat in this project
        </Label>
        <Textarea
          id="project-instructions"
          className="min-h-24"
          value={p.instructions}
          onChange={(e) => setP({ ...p, instructions: e.target.value })}
          placeholder="For example: This is my bakery's website. Keep a friendly tone."
        />
      </div>
      <div className="grid gap-2">
        <span className="text-sm font-medium">Files the AI can read</span>
        {p.files.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Project files">
            {p.files.map((f) => (
              <li
                key={f.name}
                className="flex items-center gap-1 rounded-md bg-muted py-0.5 pr-0.5 pl-2 text-xs"
              >
                <FileText className="size-3.5" /> {f.name}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${f.name}`}
                  onClick={() =>
                    setP({
                      ...p,
                      files: p.files.filter((x) => x.name !== f.name),
                    })
                  }
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          asChild
        >
          <label>
            <Plus /> Add text or code files
            <input
              type="file"
              multiple
              hidden
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                const added: Project["files"] = [];
                let total = used;
                for (const f of files) {
                  if (
                    !isSupported(f) ||
                    f.type.startsWith("image/") ||
                    f.type === "application/pdf"
                  ) {
                    toast.error(
                      `${f.name}: projects hold text and code files.`,
                    );
                    continue;
                  }
                  const a = await readAttachment(f);
                  if (a.kind !== "text") continue;
                  if (total + a.text.length > MAX_PROJECT_FILES_BYTES) {
                    toast.error(
                      "Projects can hold about 400 KB of text. Remove a file first.",
                    );
                    break;
                  }
                  total += a.text.length;
                  added.push({ name: f.name, text: a.text });
                }
                setP((cur) => ({
                  ...cur,
                  files: [
                    ...cur.files.filter(
                      (x) => !added.some((n) => n.name === x.name),
                    ),
                    ...added,
                  ],
                }));
              }}
            />
          </label>
        </Button>
      </div>
      <ProjectToolsPicker
        value={{
          connectorIds: p.connectorIds ?? [],
          pluginIds: p.pluginIds ?? [],
        }}
        onChange={(v) => setP({ ...p, ...v })}
        onOpenConnectors={onOpenConnectors}
      />
      <div className="flex gap-2">
        <Button type="submit">Save project</Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Chat projects, like Claude's: folders that group chats and give them instructions, files, connectors and skills. */
export function Library({
  selectedId,
  onSelectProject,
  onOpenProject,
  onOpenChat,
  onOpenConnectors,
}: {
  selectedId?: string;
  onSelectProject: (id?: string) => void;
  onOpenProject: (id: string) => void;
  onOpenChat: (id: string) => void;
  onOpenConnectors: () => void;
}) {
  const projects = useStore((s) => s.projects) ?? [];
  const chats = useStore((s) => s.chats);
  const [editing, setEditing] = useState<Project>();
  const selected = projects.find((p) => p.id === selectedId);
  if (selected) {
    const inside = chats
      .filter((c) => c.projectId === selected.id)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-3xl gap-5 px-4 py-6">
          <button
            className="justify-self-start text-sm text-muted-foreground hover:underline"
            onClick={() => onSelectProject(undefined)}
          >
            ← All projects
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <FolderOpen className="size-5" />
            <h2 className="mr-auto text-xl font-semibold">{selected.name}</h2>
            <Button variant="outline" onClick={() => setEditing(selected)}>
              <Pencil /> Edit project
            </Button>
            <Button onClick={() => onOpenProject(selected.id)}>
              <Plus /> New chat in this project
            </Button>
          </div>
          {editing ? (
            <ProjectEditor
              key={editing.id}
              project={editing}
              onDone={() => setEditing(undefined)}
              onOpenConnectors={onOpenConnectors}
            />
          ) : (
            <div className="grid gap-1 text-sm">
              <p className="text-muted-foreground">
                {selected.instructions || "No instructions yet."}
              </p>
              <p className="text-xs text-muted-foreground">
                {selected.files.length} files ·{" "}
                {selected.connectorIds?.length ?? 0} connectors ·{" "}
                {selected.pluginIds?.length ?? 0} plugins
              </p>
            </div>
          )}
          <section aria-label="Chats in this project" className="grid gap-1">
            <h3 className="text-sm font-medium">Chats</h3>
            {inside.length ? (
              <ul className="divide-y rounded-xl border">
                {inside.map((c) => (
                  <li key={c.id}>
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent"
                      onClick={() => onOpenChat(c.id)}
                    >
                      <span className="flex-1 truncate">
                        {c.title || "New chat"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.updatedAt).toLocaleDateString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No chats yet. Start one, or move a chat here from its ⋯ menu.
              </p>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-4xl gap-8 px-4 py-6">
        <section aria-labelledby="projects-h" className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="projects-h" className="mr-auto text-lg font-semibold">
              Projects
            </h2>
            <Button
              onClick={() =>
                setEditing({
                  id: crypto.randomUUID(),
                  name: "",
                  instructions: "",
                  files: [],
                  createdAt: Date.now(),
                })
              }
            >
              <Plus /> New project
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            A project groups chats and gives them shared instructions, files,
            connectors and skills.
          </p>
          {editing && (
            <ProjectEditor
              key={editing.id}
              project={editing}
              onDone={() => setEditing(undefined)}
              onOpenConnectors={onOpenConnectors}
            />
          )}
          {projects.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {projects.map((p) => (
                <li key={p.id} className="grid gap-2 rounded-xl border p-4">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="size-4" />
                    <span className="flex-1 truncate font-medium">
                      {p.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${p.name}`}
                      onClick={() => setEditing(p)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${p.name}`}
                      onClick={() =>
                        confirm(
                          `Delete the project "${p.name}"? Its chats stay, outside any project.`,
                        ) &&
                        update((s) => ({
                          ...s,
                          projects: (s.projects ?? []).filter(
                            (x) => x.id !== p.id,
                          ),
                          chats: s.chats.map((c) =>
                            c.projectId === p.id
                              ? { ...c, projectId: undefined }
                              : c,
                          ),
                        }))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {p.instructions || "No instructions yet."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.files.length} files
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="justify-self-start"
                      onClick={() => onSelectProject(p.id)}
                    >
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="justify-self-start"
                      onClick={() => onOpenProject(p.id)}
                    >
                      New chat in this project
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** Settings > Memory: what the AI remembers about you. */
export function MemoryManager() {
  const projects = useStore((s) => s.projects) ?? [];
  const memory = useStore((s) => s.memory) ?? { enabled: false, items: [] };
  const [q, setQ] = useState("");
  const [editingMem, setEditingMem] = useState<string>();
  const shown = memory.items.filter(
    (m) => !q.trim() || m.text.toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <section aria-labelledby="memory-h" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2
          id="memory-h"
          className="mr-auto flex items-center gap-2 text-lg font-semibold"
        >
          <Brain className="size-5" /> Memory
        </h2>
        <label className="flex items-center gap-2 text-sm">
          Let the AI remember things
          <Switch
            checked={memory.enabled}
            onCheckedChange={(v) =>
              update((s) => ({
                ...s,
                memory: { items: s.memory?.items ?? [], enabled: v },
              }))
            }
          />
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        When this is on, any model can save facts you&apos;d want it to keep
        (like your name or preferences) and uses them in later chats. Private
        mode never reads or saves memories. Everything here stays on this
        device.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search memories"
            className="pl-8"
            placeholder="Search memories"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            const t = prompt("What should the AI remember?")?.trim();
            if (t) addMemory(t.slice(0, 500));
          }}
        >
          <Plus /> Add
        </Button>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {memory.items.length
            ? "No memories match."
            : "Nothing remembered yet."}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border" aria-label="Memories">
          {shown.map((m) => (
            <li key={m.id} className="flex items-center gap-2 p-3 text-sm">
              {editingMem === m.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = new FormData(e.currentTarget)
                      .get("text")
                      ?.toString()
                      .trim();
                    if (v)
                      update((s) => ({
                        ...s,
                        memory: {
                          ...s.memory!,
                          items: s.memory!.items.map((x) =>
                            x.id === m.id ? { ...x, text: v.slice(0, 500) } : x,
                          ),
                        },
                      }));
                    setEditingMem(undefined);
                  }}
                >
                  <Input
                    name="text"
                    aria-label="Memory"
                    defaultValue={m.text}
                    autoFocus
                  />
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex-1">{m.text}</span>
                  {m.projectId && (
                    <span className="text-xs text-muted-foreground">
                      {projects.find((p) => p.id === m.projectId)?.name}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit memory"
                    onClick={() => setEditingMem(m.id)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete memory"
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        memory: {
                          ...s.memory!,
                          items: s.memory!.items.filter((x) => x.id !== m.id),
                        },
                      }))
                    }
                  >
                    <Trash2 />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
