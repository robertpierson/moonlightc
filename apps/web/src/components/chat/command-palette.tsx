"use client";

import { Columns2, KeyRound, MessageSquare, Moon, Plus, Sparkles, SunMoon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { useStore, type ModelRef } from "@/lib/store";

export interface PaletteActions {
  newChat: () => void;
  openChat: (id: string) => void;
  pickModel: (r: ModelRef) => void;
  openKeys: () => void;
  openModes: () => void;
  toggleCompare: () => void;
}

export function CommandPalette({ actions }: { actions: PaletteActions }) {
  const [open, setOpen] = useState(false);
  const chats = useStore((s) => s.chats);
  const connections = useStore((s) => s.connections);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Search chats, models and actions">
      <Command>
      <CommandInput placeholder="Type a command, chat or model…" />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={run(actions.newChat)}>
            <Plus /> New chat
          </CommandItem>
          {connections.length > 0 && (
            <CommandItem onSelect={run(actions.toggleCompare)}>
              <Columns2 /> Compare models
            </CommandItem>
          )}
          <CommandItem onSelect={run(actions.openKeys)}>
            <KeyRound /> Models and keys
          </CommandItem>
          <CommandItem onSelect={run(actions.openModes)}>
            <Sparkles /> Create or edit modes
          </CommandItem>
          <CommandItem onSelect={run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
            {resolvedTheme === "dark" ? <SunMoon /> : <Moon />} Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
          </CommandItem>
        </CommandGroup>
        {chats.length > 0 && (
          <CommandGroup heading="Chats">
            {chats.slice(0, 50).map((c) => (
              <CommandItem key={c.id} value={`chat ${c.title} ${c.id}`} onSelect={run(() => actions.openChat(c.id))}>
                <MessageSquare /> <span className="truncate">{c.title || "New chat"}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {connections.map((conn) => (
          <CommandGroup key={conn.id} heading={`Models · ${conn.label}`}>
            {conn.models.map((m) => (
              <CommandItem key={m.id} value={`model ${conn.label} ${m.name} ${m.id}`} onSelect={run(() => actions.pickModel({ connectionId: conn.id, modelId: m.id }))}>
                {m.name}
                <CommandShortcut>{conn.label}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
