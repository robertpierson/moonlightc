"use client";

import { Check, ChevronsUpDown, Sparkles, Star } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getProvider } from "@moonc/core";
import { DISTROS } from "@/lib/customize";
import { AUTO, isAuto } from "@/lib/auto-model";
import { findModel, update, useStore, type ModelRef } from "@/lib/store";

const refKey = (r: ModelRef) => `${r.connectionId}:${r.modelId}`;

function price(p?: { input: number; output: number }) {
  if (!p) return null;
  if (p.input === 0 && p.output === 0) return "free";
  return `$${p.input.toFixed(2)} / $${p.output.toFixed(2)} per 1M`;
}

/** `plain`: no Auto entry and doesn't change the default model (for choosing models inside Settings). */
export function ModelPicker({ value, onChange, plain, label = "Choose model" }: { value?: ModelRef; onChange: (r: ModelRef) => void; plain?: boolean; label?: string }) {
  const allConnections = useStore((s) => s.connections);
  const onlyLocal = useStore((s) => [...DISTROS, ...(s.customDistros ?? [])].find((d) => d.id === s.distroId)?.onlyLocal ?? false);
  const connections = onlyLocal ? allConnections.filter((c) => getProvider(c.providerId).local) : allConnections;
  const favorites = useStore((s) => s.favorites);
  const [open, setOpen] = useState(false);
  const autoReady = useStore((s) => !!findModel(s.autoPicks?.everyday));
  const current = isAuto(value) ? { name: "Auto" } : value && connections.find((c) => c.id === value.connectionId)?.models.find((m) => m.id === value.modelId);

  const toggleFav = (r: ModelRef) =>
    update((s) => {
      const k = refKey(r);
      return { ...s, favorites: s.favorites.includes(k) ? s.favorites.filter((f) => f !== k) : [...s.favorites, k] };
    });

  const pick = (r: ModelRef) => {
    onChange(r);
    if (!plain) update((s) => ({ ...s, lastModel: r }));
    setOpen(false);
  };

  const row = (connId: string, connLabel: string, m: { id: string; name: string; pricing?: { input: number; output: number } }, showConn: boolean) => {
    const r = { connectionId: connId, modelId: m.id };
    const fav = favorites.includes(refKey(r));
    const selected = value && refKey(value) === refKey(r);
    return (
      <CommandItem key={refKey(r) + (showConn ? ":f" : "")} value={`${connLabel} ${m.name} ${m.id} ${showConn ? "fav" : ""}`} onSelect={() => pick(r)} className="gap-2">
        <Check className={selected ? "opacity-100" : "opacity-0"} />
        <div className="min-w-0 flex-1">
          <div className="truncate">{m.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {showConn ? `${connLabel} · ` : ""}
            {price(m.pricing) ?? m.id}
          </div>
        </div>
        <button
          type="button"
          aria-label={fav ? `Remove ${m.name} from favorites` : `Add ${m.name} to favorites`}
          aria-pressed={fav}
          className="rounded p-1 hover:bg-accent"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            toggleFav(r);
          }}
        >
          <Star className={fav ? "fill-current text-amber-500" : "text-muted-foreground"} />
        </button>
      </CommandItem>
    );
  };

  const favRows = connections.flatMap((c) =>
    c.models.filter((m) => favorites.includes(refKey({ connectionId: c.id, modelId: m.id }))).map((m) => row(c.id, c.label, m, true)),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" role="combobox" aria-expanded={open} aria-label={label} className="max-w-[60vw] justify-between gap-1 font-medium sm:max-w-sm">
          <span className="truncate">{current?.name ?? "Choose a model"}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,26rem)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search models…" />
          <CommandList className="max-h-[60dvh]">
            <CommandEmpty>No model matches.</CommandEmpty>
            {autoReady && !plain && (
              <CommandGroup>
                <CommandItem value="auto best model for each message" onSelect={() => pick(AUTO)} className="gap-2">
                  <Check className={isAuto(value) ? "opacity-100" : "opacity-0"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      Auto <Sparkles className="size-3.5 text-primary" />
                    </div>
                    <div className="truncate text-xs text-muted-foreground">Picks the best of your models for each message</div>
                  </div>
                </CommandItem>
              </CommandGroup>
            )}
            {favRows.length > 0 && <CommandGroup heading="Favorites">{favRows}</CommandGroup>}
            {connections.filter((c) => c.models.length).map((c) => (
              <CommandGroup key={c.id} heading={c.label}>
                {c.models.map((m) => row(c.id, c.label, m, false))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
