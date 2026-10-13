"use client";

import { ChevronDown, Pencil, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  BUILT_IN_MODES,
  DEFAULT_PINNED_MODES,
  update,
  useStore,
  type Mode,
} from "@/lib/store";

export function useModes() {
  const custom = useStore((s) => s.modes);
  const mods = useStore((s) => s.mods);
  const fromMods: Mode[] = (mods ?? [])
    .filter((m) => m.enabled)
    .flatMap((m) =>
      m.manifest.personas.map((p, i) => ({
        id: `mod:${m.manifest.id}:${i}`,
        name: p.name,
        instructions: p.instructions,
        temperature: p.temperature,
        builtIn: true,
      })),
    );
  // Agents from Claude plugins become modes: their instructions are the agent's prompt.
  const plugins = useStore((s) => s.plugins);
  const fromPlugins: Mode[] = (plugins ?? [])
    .filter((p) => p.enabled)
    .flatMap((p) => p.agents.map((a) => ({ id: `plugin:${p.id}:${a.name}`, name: a.name, instructions: a.body, builtIn: true })));
  return [...BUILT_IN_MODES, ...custom, ...fromMods, ...fromPlugins];
}

/** The mode menu: the main modes first, everything else under "More options". */
export function ModeSelect({
  value,
  onChange,
  lockPrivate,
}: {
  value: string;
  onChange: (id: string) => void;
  lockPrivate: boolean;
}) {
  const modes = useModes();
  const pinned = useStore((s) => s.pinnedModes) ?? DEFAULT_PINNED_MODES;
  const [manage, setManage] = useState(false);
  const current = modes.find((m) => m.id === value) ?? modes[0];
  const main = modes.filter(
    (m) => pinned.includes(m.id) || m.id === current.id,
  );
  const more = modes.filter((m) => !main.includes(m));
  const item = (m: Mode) => (
    <DropdownMenuRadioItem
      key={m.id}
      value={m.id}
      disabled={lockPrivate && !!m.private !== !!current.private}
    >
      {m.name}
    </DropdownMenuRadioItem>
  );
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Mode"
            className="h-8 gap-1 px-2 font-normal"
          >
            {current.name} <ChevronDown className="opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuRadioGroup value={current.id} onValueChange={onChange}>
            {main.map(item)}
            {more.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>More options</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {more.map(item)}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setManage(true)}>
            Create or edit modes…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ModesDialog open={manage} onOpenChange={setManage} />
    </>
  );
}

const blank = (): Mode => ({
  id: crypto.randomUUID(),
  name: "",
  instructions: "",
});

export function ModesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modes</DialogTitle>
          <DialogDescription>
            A mode sets the AI&apos;s instructions and creativity. Built-in
            modes can&apos;t be changed; make your own.
          </DialogDescription>
        </DialogHeader>
        <ModesManager />
      </DialogContent>
    </Dialog>
  );
}

/** Pin modes to the main menu, and create, edit or delete your own. Used in the dialog and in Settings. */
export function ModesManager() {
  const custom = useStore((s) => s.modes);
  const modes = useModes();
  const pinned = useStore((s) => s.pinnedModes) ?? DEFAULT_PINNED_MODES;
  const [editing, setEditing] = useState<Mode>();
  const togglePin = (id: string) =>
    update((s) => {
      const cur = s.pinnedModes ?? DEFAULT_PINNED_MODES;
      return {
        ...s,
        pinnedModes: cur.includes(id)
          ? cur.filter((x) => x !== id)
          : [...cur, id],
      };
    });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const m = { ...editing, name: editing.name.trim() };
    update((s) => ({
      ...s,
      modes: s.modes.some((x) => x.id === m.id)
        ? s.modes.map((x) => (x.id === m.id ? m : x))
        : [...s.modes, m],
    }));
    setEditing(undefined);
  };

  return editing ? (
    <form onSubmit={save} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="mode-name">Name</Label>
        <Input
          id="mode-name"
          required
          maxLength={40}
          value={editing.name}
          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="mode-instructions">Instructions (system prompt)</Label>
        <Textarea
          id="mode-instructions"
          className="min-h-32"
          placeholder="You are a friendly Spanish teacher. Reply in simple Spanish, then English."
          value={editing.instructions}
          onChange={(e) =>
            setEditing({ ...editing, instructions: e.target.value })
          }
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="mode-temp">
          Creativity: {editing.temperature ?? "model default"}
        </Label>
        <input
          id="mode-temp"
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={editing.temperature ?? 1}
          onChange={(e) =>
            setEditing({ ...editing, temperature: Number(e.target.value) })
          }
          className="accent-primary"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="mode-private">
          Private: never save chats in this mode
        </Label>
        <Switch
          id="mode-private"
          checked={!!editing.private}
          onCheckedChange={(v) => setEditing({ ...editing, private: v })}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setEditing(undefined)}
        >
          Cancel
        </Button>
        <Button type="submit">Save mode</Button>
      </div>
    </form>
  ) : (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Pinned modes show first in the mode menu. The rest are under “More
        options”.
      </p>
      <ul className="divide-y rounded-lg border">
        {modes.map((m) => {
          const isPinned = pinned.includes(m.id);
          const own = custom.some((c) => c.id === m.id);
          return (
            <li key={m.id} className="flex items-center gap-2 p-2 pl-3 text-sm">
              <span className="flex-1 truncate font-medium">{m.name}</span>
              {isPinned && (
                <span className="text-xs text-muted-foreground">
                  In main menu
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${isPinned ? "Unpin" : "Pin"} ${m.name}`}
                aria-pressed={isPinned}
                onClick={() => togglePin(m.id)}
              >
                {isPinned ? <PinOff /> : <Pin />}
              </Button>
              {own && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${m.name}`}
                    onClick={() => setEditing(m)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${m.name}`}
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        modes: s.modes.filter((x) => x.id !== m.id),
                      }))
                    }
                  >
                    <Trash2 />
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <Button onClick={() => setEditing(blank())}>
        <Plus /> New mode
      </Button>
    </div>
  );
}
