"use client";

import { Blocks, Flag, Loader2, MoreHorizontal, Plus, Search, Trash2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppPreview } from "@/components/customize/preview";
import { currentLook, setLook } from "@/components/customize/look";
import { Review } from "@/components/mods/mods-view";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { add, browse, countInstall, KINDS, mine, modFor, report, unshare, type Creation, type Kind } from "@/lib/community";
import type { InstalledMod } from "@/lib/mods";
import { getState } from "@/lib/store";
import { accountsEnabled, useUser } from "@/lib/supabase/client";
import { Maker } from "./maker";

const err = (e: unknown) => toast.error(e instanceof Error ? e.message : String(e));
const one = (k: Kind) => KINDS.find((x) => x.id === k)!.one;

/** Community: things people made for MoonlightC. Add one in a click, or make and share your own. */
export function Community({ onSignIn }: { onSignIn: () => void }) {
  const user = useUser();
  const [kind, setKind] = useState<Kind>();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"popular" | "new">("popular");
  const [tab, setTab] = useState<"browse" | "yours">("browse");
  const [items, setItems] = useState<Creation[]>();
  const [making, setMaking] = useState(false);
  const [review, setReview] = useState<{ mod: InstalledMod; c: Creation }>();

  const load = useCallback(async () => {
    setItems(undefined);
    try {
      setItems(tab === "yours" ? await mine() : await browse({ kind, q, sort }));
    } catch (e) {
      err(e);
      setItems([]);
    }
  }, [tab, kind, q, sort]);
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  if (!accountsEnabled) return <p className="p-6 text-sm text-muted-foreground">The community library needs accounts, which aren&apos;t set up on this server.</p>;

  const shown = (items ?? []).filter((c) => !kind || c.kind === kind);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Blocks className="size-5" /> Community
            </h2>
            <p className="text-sm text-muted-foreground">Themes, modes, commands, setups and mods made by people using MoonlightC. Add one in a click, or make your own.</p>
          </div>
          <Button onClick={() => setMaking(true)}>
            <Plus /> Make something
          </Button>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Library" className="flex gap-1 rounded-lg border p-1">
            {(["browse", "yours"] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="rounded-md px-3 py-1 text-sm aria-selected:bg-selected aria-selected:text-selected-foreground">
                {t === "browse" ? "Browse" : "Shared by you"}
              </button>
            ))}
          </div>
          {tab === "browse" && (
            <>
              <div className="relative min-w-48 flex-1">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Search the library" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
              </div>
              <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="popular">Most added</option>
                <option value="new">Newest</option>
              </select>
            </>
          )}
        </div>
        <div role="radiogroup" aria-label="Kind" className="flex flex-wrap gap-1.5">
          {[{ id: undefined, name: "Everything" }, ...KINDS].map((k) => (
            <button key={k.name} role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)} className="rounded-full border px-3 py-1 text-sm aria-checked:border-primary aria-checked:bg-selected aria-checked:text-selected-foreground">
              {k.name}
            </button>
          ))}
        </div>

        {items === undefined ? (
          <Loader2 className="size-5 animate-spin" aria-label="Loading" />
        ) : shown.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((c) => (
              <Card
                key={c.id}
                c={c}
                own={c.author === user?.id}
                onAdd={async () => {
                  try {
                    if (c.kind === "mod") return setReview({ mod: await modFor(c), c });
                    add(c);
                    toast.success(`Added ${c.name}. ${({ theme: "Find it in Appearance under My themes.", mode: "Pick it from the mode menu in any chat.", command: `Type /${c.payload.kind === "command" ? c.payload.command.name : ""} in a message.`, setup: "Find it in Appearance under Ready-made setups.", mod: "" } as const)[c.kind]}`);
                  } catch (e) {
                    err(e);
                  }
                }}
                onRemoved={load}
                onSignIn={onSignIn}
                signedIn={!!user}
              />
            ))}
          </ul>
        ) : (
          <div className="grid justify-items-start gap-2 rounded-xl border p-5 text-sm">
            <p>{tab === "yours" ? "You haven't shared anything yet." : q ? "Nothing matches that yet." : `No ${kind ? KINDS.find((k) => k.id === kind)!.name.toLowerCase() : "creations"} yet. Be the first.`}</p>
            <Button size="sm" variant="outline" onClick={() => setMaking(true)}>
              <Plus /> Make one
            </Button>
          </div>
        )}
      </div>
      {making && (
        <Maker
          initialKind={kind}
          onClose={() => setMaking(false)}
          onShared={() => {
            setMaking(false);
            setTab("yours");
            load();
          }}
          onSignIn={onSignIn}
        />
      )}
      {review && (
        <Review
          mod={review.mod}
          onClose={() => {
            // Counted only once it's really installed.
            if ((getState().mods ?? []).some((m) => m.source === review.mod.source)) countInstall(review.c.id);
            setReview(undefined);
          }}
        />
      )}
    </div>
  );
}

function Card({ c, own, onAdd, onRemoved, onSignIn, signedIn }: { c: Creation; own: boolean; onAdd: () => void; onRemoved: () => void; onSignIn: () => void; signedIn: boolean }) {
  const p = c.payload;
  const look = p.kind === "theme" ? { ...currentLook(), ...p.look, wallpaper: undefined } : p.kind === "setup" ? p.distro.look : undefined;
  const tryIt = () => {
    const before = currentLook();
    setLook(p.kind === "theme" ? { theme: p.look.theme, overrides: p.look.overrides, radius: p.look.radius } : { ...p.kind === "setup" ? p.distro.look : {}, wallpaper: before.wallpaper });
    toast(`Trying ${c.name}.`, { action: { label: "Undo", onClick: () => setLook(before) }, duration: 10_000, icon: <Undo2 className="size-4" /> });
  };
  return (
    <li className="flex flex-col gap-2 rounded-xl border p-3">
      {look ? (
        <AppPreview look={look} />
      ) : (
        <div className="grid aspect-[16/10] content-start gap-1 overflow-hidden rounded-lg border bg-muted/40 p-3 text-xs">
          {p.kind === "command" && <span className="font-mono text-sm font-medium">/{p.command.name}</span>}
          {p.kind === "mod" && <span className="font-medium">Adds: {[p.manifest.themes.length && `${p.manifest.themes.length} theme${p.manifest.themes.length > 1 ? "s" : ""}`, p.manifest.personas.length && `${p.manifest.personas.length} mode${p.manifest.personas.length > 1 ? "s" : ""}`, p.manifest.commands.length && `${p.manifest.commands.length} command${p.manifest.commands.length > 1 ? "s" : ""}`, p.manifest.tools.length && `${p.manifest.tools.length} AI tool${p.manifest.tools.length > 1 ? "s" : ""}`].filter(Boolean).join(", ") || "nothing yet"}</span>}
          <span className="line-clamp-5 text-muted-foreground">{p.kind === "mode" ? p.mode.instructions : p.kind === "command" ? p.command.prompt : c.description}</span>
        </div>
      )}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{c.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {one(c.kind)} by {c.author_name}
            {c.installs ? `, added ${c.installs} time${c.installs === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={`More for ${c.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {own ? (
              <DropdownMenuItem onSelect={() => confirm(`Stop sharing ${c.name}? People who added it keep their copy.`) && unshare(c.id).then(() => (toast.success("No longer shared."), onRemoved()), err)}>
                <Trash2 /> Stop sharing
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={() => {
                  if (!signedIn) return onSignIn();
                  const why = prompt(`What's wrong with ${c.name}? (Three reports hide it until it's reviewed.)`);
                  if (why !== null) report(c.id, why).then(() => toast.success("Thanks. Reported."), err);
                }}
              >
                <Flag /> Report
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {c.description && p.kind !== "mode" && p.kind !== "command" && <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
      <div className="mt-auto flex gap-2">
        <Button size="sm" className="flex-1" onClick={onAdd} aria-label={`Add ${c.name}`}>
          <Plus /> Add
        </Button>
        {look && (
          <Button size="sm" variant="outline" onClick={tryIt} aria-label={`Try ${c.name}`}>
            Try it
          </Button>
        )}
      </div>
    </li>
  );
}
