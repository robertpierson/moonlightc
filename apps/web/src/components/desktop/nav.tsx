"use client";

import { Brain, Cpu, FolderGit2, MessageSquare, Palette, Plug, Puzzle, SlidersHorizontal, SquareTerminal } from "lucide-react";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { desktop } from "@/lib/desktop";

export type View = "chat" | "library" | "studio" | "connections" | "models" | "terminal" | "projects" | "mods" | "customize";

const ITEMS: { id: View; label: string; icon: React.ReactNode; desktopOnly?: boolean }[] = [
  { id: "chat", label: "Chat", icon: <MessageSquare /> },
  { id: "library", label: "Projects & memory", icon: <Brain /> },
  { id: "studio", label: "Studio", icon: <Palette /> },
  { id: "connections", label: "Connections", icon: <Plug /> },
  { id: "models", label: "Local models", icon: <Cpu />, desktopOnly: true },
  { id: "terminal", label: "Terminal", icon: <SquareTerminal />, desktopOnly: true },
  { id: "projects", label: "My AI Projects", icon: <FolderGit2 />, desktopOnly: true },
  { id: "mods", label: "Mods", icon: <Puzzle /> },
  { id: "customize", label: "Customize", icon: <SlidersHorizontal /> },
];

/** Sections this device can show (desktop-only ones need the desktop app). */
export const availableViews = (): View[] => ITEMS.filter((i) => !!desktop() || !i.desktopOnly).map((i) => i.id);

/** App sections. Desktop-only ones appear only when the desktop bridge exists. */
export function AppNav({ view, onChange, hidden = [] }: { view: View; onChange: (v: View) => void; hidden?: string[] }) {
  const isDesktop = !!desktop();
  const [openAtLogin, setOpenAtLogin] = useState<boolean>();
  useEffect(() => {
    desktop()?.settings.get().then((s) => setOpenAtLogin(s.openAtLogin));
  }, []);
  return (
    <div className="border-b p-2">
      <nav aria-label="Sections" className="grid gap-0.5">
        {ITEMS.filter((i) => (isDesktop || !i.desktopOnly) && !hidden.includes(i.id)).map((i) => (
          <button
            key={i.id}
            aria-current={view === i.id ? "page" : undefined}
            onClick={() => onChange(i.id)}
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-accent aria-[current=page]:bg-accent [&_svg]:size-4"
          >
            {i.icon} {i.label}
          </button>
        ))}
      </nav>
      {openAtLogin !== undefined && (
        <label className="mt-2 flex items-center justify-between gap-2 px-2.5 text-xs text-muted-foreground">
          Start when I sign in to this computer
          <Switch
            checked={openAtLogin}
            onCheckedChange={(v) => {
              setOpenAtLogin(v);
              desktop()?.settings.setOpenAtLogin(v);
            }}
          />
        </label>
      )}
    </div>
  );
}
