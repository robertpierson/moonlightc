"use client";

import { Cpu, Download, FolderOpen, Globe, KeyRound, Laptop, Moon, Palette, Plug, Puzzle, Shield, SlidersHorizontal, Sparkles, Sun, Trash2, Wand2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ModelPicker } from "@/components/chat/model-picker";
import { KeysPanel } from "@/components/chat/keys-dialog";
import { ModesManager } from "@/components/chat/modes";
import { ClaudePlugins } from "./claude-plugins";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { TASKS } from "@/lib/auto-model";
import { desktop } from "@/lib/desktop";
import { findModel, getState, resetState, update, useStore } from "@/lib/store";
import type { ViewId } from "@/lib/customize";

const Connections = dynamic(() => import("@/components/connections/connections").then((m) => m.Connections), { loading: () => <div className="flex-1" /> });
const Customize = dynamic(() => import("@/components/customize/customize").then((m) => m.Customize), { loading: () => <div className="flex-1" /> });
const ModsView = dynamic(() => import("@/components/mods/mods-view").then((m) => m.ModsView), { loading: () => <div className="flex-1" /> });
const LocalModels = dynamic(() => import("@/components/desktop/local-models").then((m) => m.LocalModels), { loading: () => <div className="flex-1" /> });

export type SettingsSection = "general" | "models" | "auto" | "modes" | "connectors" | "plugins" | "files" | "browser" | "local" | "appearance" | "privacy";

const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode; desktopOnly?: boolean; webOnly?: boolean }[] = [
  { id: "general", label: "General", icon: <SlidersHorizontal /> },
  { id: "models", label: "Models & API keys", icon: <KeyRound /> },
  { id: "auto", label: "Auto model", icon: <Sparkles /> },
  { id: "modes", label: "Modes", icon: <Wand2 /> },
  { id: "connectors", label: "Connectors", icon: <Plug /> },
  { id: "plugins", label: "Plugins & mods", icon: <Puzzle /> },
  { id: "files", label: "Files", icon: <FolderOpen />, desktopOnly: true },
  { id: "browser", label: "Chrome extension", icon: <Globe />, webOnly: true },
  { id: "local", label: "Local models", icon: <Cpu />, desktopOnly: true },
  { id: "appearance", label: "Appearance", icon: <Palette /> },
  { id: "privacy", label: "Privacy & data", icon: <Shield /> },
];

export function Settings({ section, onSection, availableViews, onClose, onChat }: { section: SettingsSection; onSection: (s: SettingsSection) => void; availableViews: ViewId[]; onClose: () => void; onChat: () => void }) {
  const isDesktop = !!desktop();
  const sections = SECTIONS.filter((s) => (isDesktop ? !s.webOnly : !s.desktopOnly));
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <nav aria-label="Settings" className="flex shrink-0 gap-1 overflow-x-auto border-b p-2 md:w-56 md:flex-col md:overflow-visible md:border-r md:border-b-0">
        <div className="hidden items-center justify-between px-2 pb-2 md:flex">
          <h1 className="text-lg font-semibold">Settings</h1>
          <Button variant="ghost" size="icon" aria-label="Close settings" onClick={onClose}>
            <X />
          </Button>
        </div>
        {sections.map((s) => (
          <button
            key={s.id}
            aria-current={section === s.id ? "page" : undefined}
            onClick={() => onSection(s.id)}
            className="flex shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-sm whitespace-nowrap hover:bg-accent aria-[current=page]:bg-accent [&_svg]:size-4"
          >
            {s.icon} {s.label}
          </button>
        ))}
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {section === "general" && <General />}
        {section === "models" && (
          <Page title="Models & API keys" description="Every provider you've connected, with its key (only the last 4 characters are shown). Keys stay on this device.">
            <KeysPanel />
          </Page>
        )}
        {section === "auto" && <AutoModel onAddKey={() => onSection("models")} />}
        {section === "modes" && (
          <Page title="Modes" description="A mode sets the AI's instructions and creativity. Pin the ones you use most to the top of the mode menu.">
            <ModesManager />
          </Page>
        )}
        {section === "connectors" && <Connections />}
        {section === "plugins" && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ClaudePlugins />
            <ModsView />
          </div>
        )}
        {section === "files" && <Files />}
        {section === "browser" && <BrowserExtension />}
        {section === "local" && <LocalModels onChat={onChat} />}
        {section === "appearance" && <Customize availableViews={availableViews} />}
        {section === "privacy" && <Privacy />}
      </div>
    </div>
  );
}

function Page({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-2xl gap-6 px-4 py-6">
        <header className="grid gap-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </header>
        {children}
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 last:border-b-0">
      <div className="grid min-w-0 gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function General() {
  const { theme, setTheme } = useTheme();
  const lastModel = useStore((s) => s.lastModel);
  const hasModels = useStore((s) => s.connections.some((c) => c.models.length > 0));
  const webTools = useStore((s) => !!s.webTools);
  const memory = useStore((s) => !!s.memory?.enabled);
  const [openAtLogin, setOpenAtLogin] = useState<boolean>();
  useEffect(() => {
    desktop()?.settings.get().then((s) => setOpenAtLogin(s.openAtLogin));
  }, []);
  const themes = [
    { id: "light", label: "Light", icon: <Sun /> },
    { id: "dark", label: "Dark", icon: <Moon /> },
    { id: "system", label: "Match device", icon: <Laptop /> },
  ];
  return (
    <Page title="General">
      <div className="grid gap-4">
        <Row label="Color mode">
          <div role="radiogroup" aria-label="Color mode" className="flex gap-1 rounded-lg border p-1">
            {themes.map((t) => (
              <button
                key={t.id}
                role="radio"
                aria-checked={theme === t.id}
                onClick={() => setTheme(t.id)}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm aria-checked:bg-accent [&_svg]:size-4"
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </Row>
        {hasModels && (
          <Row label="Default model" hint="Used for new chats unless a mode picks its own.">
            <ModelPicker value={lastModel} onChange={(r) => update((s) => ({ ...s, lastModel: r }))} label="Default model" />
          </Row>
        )}
        <Row label="Web tools" hint="Let the AI search the web and read pages (needs a search key in Models & API keys).">
          <Switch aria-label="Web tools" checked={webTools} onCheckedChange={(v) => update((s) => ({ ...s, webTools: v }))} />
        </Row>
        <Row label="Memory" hint="Let the AI remember facts you tell it, across chats. Manage them in Projects & memory.">
          <Switch aria-label="Memory" checked={memory} onCheckedChange={(v) => update((s) => ({ ...s, memory: { enabled: v, items: s.memory?.items ?? [] } }))} />
        </Row>
        {openAtLogin !== undefined && (
          <Row label="Start when I sign in to this computer">
            <Switch
              aria-label="Start when I sign in to this computer"
              checked={openAtLogin}
              onCheckedChange={(v) => {
                setOpenAtLogin(v);
                desktop()?.settings.setOpenAtLogin(v);
              }}
            />
          </Row>
        )}
      </div>
    </Page>
  );
}

function AutoModel({ onAddKey }: { onAddKey: () => void }) {
  const picks = useStore((s) => s.autoPicks) ?? {};
  const hasModels = useStore((s) => s.connections.some((c) => c.models.length > 0));
  return (
    <Page
      title="Auto model"
      description="Choose a model for each kind of task. Then pick “Auto” in the model menu and MoonlightC sends each message to the right one."
    >
      {!hasModels ? (
        <div className="grid justify-items-start gap-3 rounded-xl border p-4 text-sm">
          Connect a provider first, then come back to assign models.
          <Button onClick={onAddKey}>Add an API key</Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {TASKS.map((t) => {
            const pick = picks[t.id];
            return (
              <Row key={t.id} label={t.name} hint={t.hint}>
                <div className="flex items-center gap-1">
                  <ModelPicker plain label={`Model for ${t.name}`} value={findModel(pick) ? pick : undefined} onChange={(r) => update((s) => ({ ...s, autoPicks: { ...s.autoPicks, [t.id]: r } }))} />
                  {pick && (
                    <Button variant="ghost" size="icon" aria-label={`Clear ${t.name} model`} onClick={() => update((s) => ({ ...s, autoPicks: { ...s.autoPicks, [t.id]: undefined } }))}>
                      <X />
                    </Button>
                  )}
                </div>
              </Row>
            );
          })}
          <p className="text-sm text-muted-foreground">{picks.everyday ? "Auto is ready: choose “Auto” at the top of the model menu." : "Set an Everyday model to turn on Auto."}</p>
        </div>
      )}
    </Page>
  );
}

function BrowserExtension() {
  const [version] = useState(() => document.documentElement.dataset.mooncExtension);
  return (
    <Page title="Chrome extension" description="Let the AI read and use browser tabs you choose: it can read a page, click, type and open links for you. Nothing is shared until you click the extension's icon on a tab and choose Share this tab.">
      {version ? (
        <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm">
          The extension is installed (version {version}). On any tab, click the MoonlightC icon in the toolbar and choose <strong>Share this tab</strong>, then ask the AI about it here.
        </p>
      ) : (
        <ol className="grid list-decimal gap-2 pl-5 text-sm">
          <li>
            <a className="text-primary underline underline-offset-4" href="/downloads/moonlightc-chrome-extension.zip" download>
              Download the extension
            </a>{" "}
            and unzip it (right-click the file, then <strong>Extract all</strong>).
          </li>
          <li>
            In Chrome or Edge, type <code className="rounded bg-muted px-1">chrome://extensions</code> in the address bar and press Enter.
          </li>
          <li>
            Turn on <strong>Developer mode</strong> (top right).
          </li>
          <li>
            Click <strong>Load unpacked</strong> and pick the <strong>moonlightc-extension</strong> folder you unzipped.
          </li>
          <li>Come back here and reload this page.</li>
        </ol>
      )}
      <div className="grid gap-1 text-sm text-muted-foreground">
        <p>How it keeps you safe:</p>
        <ul className="list-disc pl-5">
          <li>Only tabs you share are visible to the AI, and a banner on each shared tab has a Stop button.</li>
          <li>Buying, sending, deleting or submitting waits for your own click on the page.</li>
          <li>Sharing ends after 15 idle minutes. Alt+Shift+M stops every tab at once.</li>
          <li>Every action is listed in the extension&apos;s popup.</li>
        </ul>
      </div>
    </Page>
  );
}

function Files() {
  const [grants, setGrants] = useState<string[]>([]);
  const [log, setLog] = useState<{ at: string; action: string; path: string }[]>([]);
  useEffect(() => {
    const b = desktop()!;
    b.files.grants().then(setGrants);
    b.files.audit().then(setLog);
  }, []);
  return (
    <Page title="Files" description="Folders the AI can use in chats on this computer. It can list, search and read files in them, and it always asks before creating or changing a file.">
      <div className="grid gap-3">
        {grants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No folders shared yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border" aria-label="Shared folders">
            {grants.map((g) => (
              <li key={g} className="flex items-center gap-2 p-2 pl-3 text-sm">
                <FolderOpen className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{g}</span>
                <Button variant="ghost" size="sm" onClick={() => desktop()!.files.revoke(g).then(setGrants)}>
                  Stop sharing
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button className="justify-self-start" onClick={() => desktop()!.files.grant().then(setGrants)}>
          <FolderOpen /> Share a folder
        </Button>
      </div>
      {log.length > 0 && (
        <section aria-label="Recent file activity" className="grid gap-2">
          <h3 className="text-sm font-medium">Recent activity</h3>
          <ul className="grid gap-1 text-xs text-muted-foreground">
            {log.slice(0, 30).map((e, i) => (
              <li key={i} className="truncate">
                {new Date(e.at).toLocaleString()}: {e.action} {e.path}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}

const SECRET_FIELDS = new Set(["apiKey", "key", "token", "accessToken", "access_token", "refresh_token", "tokens", "xToken"]);

function Privacy() {
  const [confirm, setConfirm] = useState(false);
  const exportData = () => {
    const json = JSON.stringify(getState(), (k, v) => (SECRET_FIELDS.has(k) ? undefined : v), 2);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = `moonlightc-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Exported your chats and settings.");
  };
  const wipe = async () => {
    resetState();
    for (const db of ["moonc-gallery", "moonc-code"]) indexedDB.deleteDatabase(db);
    location.reload();
  };
  return (
    <Page title="Privacy & data" description="Your chats, keys and settings are stored on this device. MoonlightC's server only passes requests through to the providers you choose and doesn't keep them.">
      <div className="grid gap-4">
        <Row label="Export your data" hint="Chats, modes, projects, memory and settings as a JSON file. Keys and sign-in tokens are left out.">
          <Button variant="outline" onClick={exportData}>
            <Download /> Export
          </Button>
        </Row>
        <Row label="Delete everything on this device" hint="Removes all chats, keys, connections, pictures and code projects stored here. This can't be undone.">
          <Button variant="destructive" onClick={() => setConfirm(true)}>
            <Trash2 /> Delete all data
          </Button>
        </Row>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete everything on this device?</DialogTitle>
            <DialogDescription>All chats, API keys, connections, Studio pictures and Code projects stored here will be gone for good. Export first if you want a copy.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={wipe}>
              Delete everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
