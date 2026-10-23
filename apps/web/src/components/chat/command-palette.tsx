"use client";

import { KeyRound, MessageSquare, Moon, Plus, Sparkles, SunMoon , Settings } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState, useMemo } from "react";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { currentLook } from "@/components/customize/look";
import { matchShortcut } from "@/lib/customize";
import { visible } from "@/lib/chat-lock";
import { useStore, type ModelRef } from "@/lib/store";

export interface PaletteActions {
  newChat: () => void;
  openChat: (id: string) => void;
  pickModel: (r: ModelRef) => void;
  openKeys: () => void;
  openModes: () => void;
  openSettings: () => void;
}

export function CommandPalette({ actions }: { actions: PaletteActions }) {
  const [open, setOpen] = useState(false);
  const all = useStore((s) => s.chats);
  const chats = useMemo(() => visible(all), [all]);
  const connections = useStore((s) => s.connections);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (matchShortcut(e, currentLook().shortcuts.palette)) {
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
            <CommandItem onSelect={run(actions.openSettings)}>
              <Settings /> Settings
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
        {connections.filter((c) => c.models.length).map((conn) => (
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
