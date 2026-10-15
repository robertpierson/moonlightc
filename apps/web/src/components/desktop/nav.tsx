"use client";

import { Clock, Code2, Cpu, Sparkles, Files, FolderGit2, FolderOpen, MessageSquare, Palette, Receipt, Settings as SettingsIcon, SquareTerminal } from "lucide-react";
import type { ViewId } from "@/lib/customize";
import { desktop } from "@/lib/desktop";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { accountsEnabled, useUser } from "@/lib/supabase/client";
import { Avatar } from "@/components/settings/avatar";

export type View = "chat" | "remote" | "chats" | "library" | "studio" | "subscriptions" | "automations" | "cowork" | "code" | "terminal" | "projects" | "models" | "claude" | "settings";
export type Workspace = "chat" | "cowork" | "code";

/** Which of the three modes a screen belongs to (Settings keeps whichever mode you came from). */
export function workspaceOf(v: View, previous: Workspace): Workspace {
  if (v === "code" || v === "terminal" || v === "projects" || v === "claude") return "code";
  if (v === "cowork" || v === "remote") return "cowork";
  if (v === "settings") return previous;
  return "chat";
}

type Item = { id: View; label: string; icon: React.ReactNode; desktopOnly?: boolean };
const CHAT_ITEMS: Item[] = [
  { id: "library", label: "Projects", icon: <FolderOpen /> },
  { id: "models", label: "Model library", icon: <Cpu />, desktopOnly: true },
  { id: "studio", label: "Studio", icon: <Palette /> },
  { id: "subscriptions", label: "Subscriptions", icon: <Receipt /> },
  { id: "automations", label: "Automations", icon: <Clock />, desktopOnly: true },
];
const CODE_ITEMS: Item[] = [
  { id: "claude", label: "Claude Code", icon: <Sparkles />, desktopOnly: true },
  { id: "terminal", label: "Terminal", icon: <SquareTerminal />, desktopOnly: true },
  { id: "projects", label: "Local projects", icon: <FolderGit2 />, desktopOnly: true },
];

/** Sections this device can show (desktop-only ones need the desktop app), for Settings > Appearance. */
export const availableViews = (): ViewId[] => ["chat", "code", ...[...CHAT_ITEMS, ...CODE_ITEMS].filter((i) => !!desktop() || !i.desktopOnly).map((i) => i.id as ViewId)];

/** Chat / Cowork / Code, like Claude. */
export function WorkspaceSwitch({ workspace, onChange, hidden = [] }: { workspace: Workspace; onChange: (w: Workspace) => void; hidden?: string[] }) {
  const tabs = [
    { id: "chat" as const, label: "Chat", icon: <MessageSquare /> },
    { id: "cowork" as const, label: "Cowork", icon: <Files /> },
    { id: "code" as const, label: "Code", icon: <Code2 /> },
  ].filter((t) => t.id === "chat" || !hidden.includes(t.id));
  return (
    <div aria-label="Mode" role="group" className="grid gap-1 rounded-lg bg-muted p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          aria-current={workspace === t.id ? "page" : undefined}
          onClick={() => onChange(t.id)}
          className="flex items-center justify-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm font-medium aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-sm aria-[current=page]:ring-1 aria-[current=page]:ring-border [&_svg]:size-4"
        >
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );
}

/** The extra sections for the current mode (chat things in Chat, code things in Code). */
export function SectionNav({ workspace, view, onChange, hidden = [] }: { workspace: Workspace; view: View; onChange: (v: View) => void; hidden?: string[] }) {
  const isDesktop = !!desktop();
  const items = (workspace === "code" ? CODE_ITEMS : workspace === "chat" ? CHAT_ITEMS : []).filter((i) => (isDesktop || !i.desktopOnly) && !hidden.includes(i.id));
  if (!items.length) return null;
  return (
    <nav aria-label="Sections" className="grid gap-0.5">
      {items.map((i) => (
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
  );
}

/** Bottom of the sidebar: your profile (opens Profile) and Settings. */
export function SettingsButton({ active, onClick, onProfile }: { active: boolean; onClick: () => void; onProfile: () => void }) {
  const name = useStore((s) => s.profile?.name?.trim());
  const user = useUser();
  return (
    <div className="flex items-center gap-1 border-t p-2">
      {accountsEnabled && user === null ? (
        <Link href="/signin?next=/app" title="Sign in to sync your chats" className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent">
          <Avatar />
          <span className="truncate">{name || "Sign in to sync"}</span>
        </Link>
      ) : (
        <button onClick={onProfile} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent">
          <Avatar />
          <span className="truncate">{name || user?.email || "Add your name"}</span>
        </button>
      )}
      <button
        aria-current={active ? "page" : undefined}
        onClick={onClick}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent aria-[current=page]:bg-accent [&_svg]:size-4"
      >
        <SettingsIcon /> Settings
      </button>
    </div>
  );
}
