"use client";

import {
  Brain,
  Clock,
  Code2,
  FolderGit2,
  MessageSquare,
  Palette,
  Receipt,
  Settings as SettingsIcon,
  SquareTerminal,
} from "lucide-react";
import type { ViewId } from "@/lib/customize";
import { desktop } from "@/lib/desktop";

export type View =
  | "chat"
  | "code"
  | "library"
  | "subscriptions"
  | "studio"
  | "terminal"
  | "projects"
  | "automations"
  | "settings";

const ITEMS: {
  id: View;
  label: string;
  icon: React.ReactNode;
  desktopOnly?: boolean;
}[] = [
  { id: "library", label: "Projects & memory", icon: <Brain /> },
  { id: "studio", label: "Studio", icon: <Palette /> },
  { id: "subscriptions", label: "Subscriptions", icon: <Receipt /> },
  {
    id: "terminal",
    label: "Terminal",
    icon: <SquareTerminal />,
    desktopOnly: true,
  },
  {
    id: "projects",
    label: "My AI Projects",
    icon: <FolderGit2 />,
    desktopOnly: true,
  },
  {
    id: "automations",
    label: "Automations",
    icon: <Clock />,
    desktopOnly: true,
  },
];

/** Sections this device can show (desktop-only ones need the desktop app). Chat is always on. */
export const availableViews = (): ViewId[] => [
  "chat",
  "code",
  ...ITEMS.filter((i) => !!desktop() || !i.desktopOnly).map(
    (i) => i.id as ViewId,
  ),
];

/** Chat / Code switch on top, then the other sections. Desktop-only ones appear only in the desktop app. */
export function AppNav({
  view,
  onChange,
  hidden = [],
}: {
  view: View;
  onChange: (v: View) => void;
  hidden?: string[];
}) {
  const isDesktop = !!desktop();
  const tabs = [
    { id: "chat" as const, label: "Chat", icon: <MessageSquare /> },
    { id: "code" as const, label: "Code", icon: <Code2 /> },
  ].filter((t) => t.id === "chat" || !hidden.includes(t.id));
  return (
    <div className="grid gap-2 border-b p-2">
      <div
        aria-label="Workspace"
        role="group"
        className={`grid gap-1 rounded-lg bg-muted p-1 ${tabs.length > 1 ? "grid-cols-2" : ""}`}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            aria-current={view === t.id ? "page" : undefined}
            onClick={() => onChange(t.id)}
            className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium aria-[current=page]:bg-background aria-[current=page]:text-foreground aria-[current=page]:shadow-sm aria-[current=page]:ring-1 aria-[current=page]:ring-border [&_svg]:size-4"
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <nav aria-label="Sections" className="grid gap-0.5">
        {ITEMS.filter(
          (i) => (isDesktop || !i.desktopOnly) && !hidden.includes(i.id),
        ).map((i) => (
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
    </div>
  );
}

/** Bottom-of-sidebar button that opens Settings. */
export function SettingsButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div className="border-t p-2">
      <button
        aria-current={active ? "page" : undefined}
        onClick={onClick}
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-accent aria-[current=page]:bg-accent [&_svg]:size-4"
      >
        <SettingsIcon /> Settings
      </button>
    </div>
  );
}
