"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { BUILT_IN_MODES, update, useStore, type Mode } from "@/lib/store";

export function useModes() {
  const custom = useStore((s) => s.modes);
  return [...BUILT_IN_MODES, ...custom];
}

const MANAGE = "__manage";

export function ModeSelect({ value, onChange, lockPrivate }: { value: string; onChange: (id: string) => void; lockPrivate: boolean }) {
  const modes = useModes();
  const [manage, setManage] = useState(false);
  return (
    <>
      <Select value={value} onValueChange={(v) => (v === MANAGE ? setManage(true) : onChange(v))}>
        <SelectTrigger size="sm" aria-label="Mode" className="h-8 w-auto gap-1 border-0 bg-transparent shadow-none dark:bg-transparent">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {modes.map((m) => (
            <SelectItem key={m.id} value={m.id} disabled={lockPrivate && !!m.private !== !!modes.find((x) => x.id === value)?.private}>
              {m.name}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={MANAGE}>Create or edit modes…</SelectItem>
        </SelectContent>
      </Select>
      <ModesDialog open={manage} onOpenChange={setManage} />
    </>
  );
}

const blank = (): Mode => ({ id: crypto.randomUUID(), name: "", instructions: "" });

export function ModesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const custom = useStore((s) => s.modes);
  const [editing, setEditing] = useState<Mode>();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const m = { ...editing, name: editing.name.trim() };
    update((s) => ({ ...s, modes: s.modes.some((x) => x.id === m.id) ? s.modes.map((x) => (x.id === m.id ? m : x)) : [...s.modes, m] }));
    setEditing(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setEditing(undefined); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modes</DialogTitle>
          <DialogDescription>A mode sets the AI&apos;s instructions and creativity. Built-in modes can&apos;t be changed; make your own.</DialogDescription>
        </DialogHeader>
        {editing ? (
          <form onSubmit={save} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="mode-name">Name</Label>
              <Input id="mode-name" required maxLength={40} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mode-instructions">Instructions (system prompt)</Label>
              <Textarea
                id="mode-instructions"
                className="min-h-32"
                placeholder="You are a friendly Spanish teacher. Reply in simple Spanish, then English."
                value={editing.instructions}
                onChange={(e) => setEditing({ ...editing, instructions: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mode-temp">Creativity: {editing.temperature ?? "model default"}</Label>
              <input
                id="mode-temp"
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={editing.temperature ?? 1}
                onChange={(e) => setEditing({ ...editing, temperature: Number(e.target.value) })}
                className="accent-primary"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="mode-private">Private: never save chats in this mode</Label>
              <Switch id="mode-private" checked={!!editing.private} onCheckedChange={(v) => setEditing({ ...editing, private: v })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(undefined)}>
                Cancel
              </Button>
              <Button type="submit">Save mode</Button>
            </div>
          </form>
        ) : (
          <div className="grid gap-3">
            {custom.length === 0 ? (
              <p className="text-sm text-muted-foreground">You haven&apos;t made any modes yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {custom.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 p-2 pl-3 text-sm">
                    <span className="flex-1 truncate font-medium">{m.name}</span>
                    <Button variant="ghost" size="icon" aria-label={`Edit ${m.name}`} onClick={() => setEditing(m)}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${m.name}`} onClick={() => update((s) => ({ ...s, modes: s.modes.filter((x) => x.id !== m.id) }))}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={() => setEditing(blank())}>
              <Plus /> New mode
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
