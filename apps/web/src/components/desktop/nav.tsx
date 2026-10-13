"use client";

import { Cpu, FolderGit2, MessageSquare, Palette, Plug, SquareTerminal } from "lucide-react";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { desktop } from "@/lib/desktop";

export type View = "chat" | "studio" | "connections" | "models" | "terminal" | "projects";

const ITEMS: { id: View; label: string; icon: React.ReactNode; desktopOnly?: boolean }[] = [
  { id: "chat", label: "Chat", icon: <MessageSquare /> },
  { id: "studio", label: "Studio", icon: <Palette /> },
  { id: "connections", label: "Connections", icon: <Plug /> },
  { id: "models", label: "Local models", icon: <Cpu />, desktopOnly: true },
  { id: "terminal", label: "Terminal", icon: <SquareTerminal />, desktopOnly: true },
  { id: "projects", label: "My AI Projects", icon: <FolderGit2 />, desktopOnly: true },
];

/** App sections. Desktop-only ones appear only when the desktop bridge exists. */
export function AppNav({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const isDesktop = !!desktop();
  const [openAtLogin, setOpenAtLogin] = useState<boolean>();
  useEffect(() => {
    desktop()?.settings.get().then((s) => setOpenAtLogin(s.openAtLogin));
  }, []);
  return (
    <div className="border-b p-2">
      <nav aria-label="Sections" className="grid gap-0.5">
        {ITEMS.filter((i) => isDesktop || !i.desktopOnly).map((i) => (
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
