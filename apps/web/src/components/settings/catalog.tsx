"use client";

import { Loader2, Puzzle, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DIRECTORIES, fetchMarketplace, type MarketplaceEntry } from "@/lib/claude-plugins";
import { REGISTRY } from "@/lib/mods";
import { useStore } from "@/lib/store";

// Hand-picked to work well inside MoonlightC (skills, commands and connectors rather than Claude Code-only hooks).
const FEATURED = ["frontend-design", "document-skills", "example-skills", "feature-dev", "code-review", "pr-review-toolkit", "notion", "linear", "vercel", "context7", "canva", "figma"];

export type CatalogItem =
  | { kind: "plugin"; key: string; name: string; description?: string; category: string; entry: MarketplaceEntry }
  | { kind: "mod"; key: string; name: string; description?: string; category: string; manifest: string; id: string };

type ModListing = { id: string; name: string; description: string; manifest: string };

/** One place to find plugins (Anthropic's plugin directory and skills) and MoonlightC mods. */
export function Catalog({ onPlugin, onMod }: { onPlugin: (e: MarketplaceEntry) => void; onMod: (manifestUrl: string) => void }) {
  const [items, setItems] = useState<CatalogItem[]>();
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [limit, setLimit] = useState(48);
  const installedPlugins = useStore((s) => s.plugins) ?? [];
  const installedMods = useStore((s) => s.mods) ?? [];

  useEffect(() => {
    Promise.allSettled([
      fetchMarketplace(DIRECTORIES[0].source),
      fetchMarketplace(DIRECTORIES[1].source),
      fetch(REGISTRY).then((r) => (r.ok ? (r.json() as Promise<{ mods: ModListing[] }>) : Promise.reject())),
    ]).then(([plugins, skills, mods]) => {
      const out: CatalogItem[] = [];
      if (plugins.status === "fulfilled") for (const e of plugins.value ?? []) if (e.source) out.push({ kind: "plugin", key: `p:${e.name}`, name: e.name, description: e.description, category: cap(e.category ?? "other"), entry: e });
      if (skills.status === "fulfilled") for (const e of skills.value ?? []) if (e.source) out.push({ kind: "plugin", key: `s:${e.name}`, name: e.name, description: e.description, category: "Skills", entry: e });
      if (mods.status === "fulfilled") for (const m of mods.value.mods) out.push({ kind: "mod", key: `m:${m.id}`, name: m.name, description: m.description, category: "Mods", manifest: m.manifest, id: m.id });
      if (!out.length) setError("Couldn't load the catalog. Check your internet connection.");
      setItems(out);
    });
  }, []);

  const installed = (i: CatalogItem) => (i.kind === "plugin" ? installedPlugins.some((p) => p.name === i.entry.name) : installedMods.some((m) => m.manifest.id === i.id));
  const categories = useMemo(() => ["All", ...[...new Set((items ?? []).map((i) => i.category))].sort((a, b) => (counts(items, b) - counts(items, a)))], [items]);
  const featured = useMemo(() => (items ?? []).filter((i) => i.kind === "mod" || FEATURED.includes(i.name)).sort((a, b) => rank(a) - rank(b)), [items]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter((i) => (cat === "All" || i.category === cat) && (!needle || `${i.name} ${i.description ?? ""}`.toLowerCase().includes(needle)));
  }, [items, q, cat]);

  const card = (i: CatalogItem, big = false) => (
    <li key={i.key} className={`flex flex-col gap-2 rounded-xl border p-4 ${big ? "w-64 shrink-0 bg-card" : ""}`}>
      <div className="flex items-center gap-2">
        {i.kind === "mod" ? <Puzzle className="size-4 shrink-0" /> : <Sparkles className="size-4 shrink-0" />}
        <span className="min-w-0 flex-1 truncate font-medium">{i.name}</span>
        <Badge variant="secondary">{i.kind === "mod" ? "Mod" : i.category === "Skills" ? "Skills" : "Plugin"}</Badge>
      </div>
      <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">{i.description || "No description."}</p>
      {installed(i) ? (
        <span className="text-sm text-muted-foreground">Installed</span>
      ) : (
        <Button size="sm" variant="outline" className="justify-self-start self-start" aria-label={`View ${i.name}`} onClick={() => (i.kind === "plugin" ? onPlugin(i.entry) : onMod(i.manifest))}>
          View
        </Button>
      )}
    </li>
  );

  return (
    <section aria-labelledby="catalog-h" className="grid gap-4">
      <div>
        <h2 id="catalog-h" className="text-lg font-semibold">
          Catalog
        </h2>
        <p className="text-sm text-muted-foreground">Plugins and skills made for Claude, and MoonlightC mods. Each one shows exactly what it adds before you install it.</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!items ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading the catalog" />
      ) : (
        <>
          {featured.length > 0 && (
            <div className="grid gap-2">
              <h3 className="text-sm font-medium">Featured</h3>
              <ul aria-label="Featured" className="flex gap-3 overflow-x-auto pb-2">
                {featured.map((i) => card(i, true))}
              </ul>
            </div>
          )}
          <div className="grid gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search the catalog" placeholder={`Search ${items.length} plugins, skills and mods`} value={q} onChange={(e) => (setQ(e.target.value), setLimit(48))} className="pl-8" />
            </div>
            <div role="group" aria-label="Categories" className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <Button key={c} size="sm" variant="ghost" aria-pressed={cat === c} className="rounded-full border" onClick={() => (setCat(c), setLimit(48))}>
                  {c}
                </Button>
              ))}
            </div>
            <ul aria-label="All plugins and mods" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.slice(0, limit).map((i) => card(i))}
            </ul>
            {!shown.length && <p className="text-sm text-muted-foreground">Nothing matches.</p>}
            {shown.length > limit && (
              <Button variant="ghost" onClick={() => setLimit((n) => n + 48)}>
                Show more ({shown.length - limit} more)
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const counts = (items: CatalogItem[] | undefined, c: string) => (items ?? []).filter((i) => i.category === c).length;
const rank = (i: CatalogItem) => (i.kind === "mod" ? 100 : FEATURED.indexOf(i.name));
