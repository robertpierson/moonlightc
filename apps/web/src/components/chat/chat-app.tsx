"use client";

import type { UIMessage } from "ai";
import { Columns2, KeyRound, Menu } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getState, patchChat, saveChat, update, useStore, type Chat, type ModelRef } from "@/lib/store";
import type { Artifact } from "@/lib/artifacts";
import { ArtifactPanel } from "./artifact-panel";
import { LocalModels } from "@/components/desktop/local-models";
import { AppNav, availableViews, type View } from "@/components/desktop/nav";
import { applyDistro, Customize, LookApplier, useLook } from "@/components/customize/customize";
import { decodeDistro, DISTROS, matchShortcut, type Distro } from "@/lib/customize";
import { Connections } from "@/components/connections/connections";
import { ModHost } from "@/components/mods/mod-host";
import { ModsView } from "@/components/mods/mods-view";
import { AutomationRunner, Automations } from "@/components/desktop/automations";
import { Library } from "@/components/library/library";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Studio } from "@/components/studio/studio";
import type { FileUIPart } from "ai";
import { Projects } from "@/components/desktop/projects";
import { Terminals, type LaunchRequest } from "@/components/desktop/terminals";
import { ChatView } from "./chat-view";
import { CompareView } from "./compare-view";
import { KeysDialog } from "./keys-dialog";
import { ModelPicker } from "./model-picker";
import { ModeSelect, ModesDialog, useModes } from "./modes";
import { CommandPalette } from "./command-palette";
import { Sidebar } from "./sidebar";

const VIEW_TITLES: Record<View, string> = { chat: "Chat", library: "Projects & memory", studio: "Studio", connections: "Connections", models: "Local models", terminal: "Terminal", projects: "My AI Projects", automations: "Automations", mods: "Mods", customize: "Customize" };

function distroDefaultMode() {
  const s = getState();
  return [...DISTROS, ...(s.customDistros ?? [])].find((d) => d.id === s.distroId)?.defaultModeId;
}

const newChat = (): Chat => ({ id: crypto.randomUUID(), title: "", messages: [], updatedAt: Date.now() });
const noop = () => () => {};

export function ChatApp() {
  // Local storage only exists in the browser; render after mount to avoid hydration mismatches.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? <Inner /> : <div className="flex-1" />;
}

function Inner() {
  const chats = useStore((s) => s.chats);
  const connections = useStore((s) => s.connections);
  const lastModel = useStore((s) => s.lastModel);
  const [draft, setDraft] = useState<Chat>(newChat);
  const [activeId, setActiveId] = useState<string>();
  const [navOpen, setNavOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [draftModel, setDraftModel] = useState<ModelRef>();
  const [draftMode, setDraftMode] = useState(() => distroDefaultMode() ?? "general");
  const look = useLook();
  const [offer, setOffer] = useState<Distro | undefined>(() => {
    const raw = new URLSearchParams(location.search).get("distro");
    if (!raw) return undefined;
    history.replaceState(null, "", location.pathname);
    try {
      return decodeDistro(raw);
    } catch {
      return undefined;
    }
  });
  const [artifact, setArtifact] = useState<Artifact>();
  const [comparing, setComparing] = useState(false);
  const [modesOpen, setModesOpen] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [termOpened, setTermOpened] = useState(false);
  const [launch, setLaunch] = useState<LaunchRequest>();
  const [pendingFiles, setPendingFiles] = useState<FileUIPart[]>();
  const [draftProject, setDraftProject] = useState<string>();
  const [projectFilter, setProjectFilter] = useState<string>();
  const projects = useStore((s) => s.projects) ?? [];
  const [quick] = useState(() => new URLSearchParams(location.search).has("quick"));
  const go = (v: View) => {
    setView(v);
    if (v === "terminal") setTermOpened(true);
    setNavOpen(false);
  };
  const modes = useModes();

  const chat = chats.find((c) => c.id === activeId) ?? draft;
  const saved = chats.some((c) => c.id === chat.id);
  const valid = (r?: ModelRef) => !!r && connections.some((c) => c.id === r.connectionId && c.models.some((m) => m.id === r.modelId));
  const chatConns = connections.filter((c) => c.models.length > 0);
  const fallback = chatConns[0] && { connectionId: chatConns[0].id, modelId: chatConns[0].models[0].id };
  const mode = modes.find((m) => m.id === (saved ? chat.modeId : draftMode)) ?? modes[0];
  const model = [chat.model, saved ? undefined : draftModel, mode.model, lastModel, fallback].find(valid);

  const start = (c: Chat = newChat()) => {
    setDraft(c);
    setActiveId(undefined);
    setDraftModel(undefined);
    setDraftMode(distroDefaultMode() ?? "general");
    setDraftProject(undefined);
    setArtifact(undefined);
    setComparing(false);
    setView("chat");
    setNavOpen(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (matchShortcut(e, look.shortcuts.newChat)) {
        e.preventDefault();
        start();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  const branch = (messages: UIMessage[]) => {
    const src = getState().chats.find((c) => c.id === chat.id) ?? chat;
    const c: Chat = { ...newChat(), title: `${src.title || "Chat"} (branch)`, model, modeId: mode.id, messages };
    saveChat(c);
    setActiveId(c.id);
  };

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <AppNav view={view} onChange={go} hidden={look.hidden} />
    <Sidebar
      projectFilter={projectFilter}
      onProjectFilter={setProjectFilter}
      activeId={saved ? chat.id : undefined}
      onSelect={(id) => {
        setActiveId(id);
        setArtifact(undefined);
        setComparing(false);
        setView("chat");
        setNavOpen(false);
      }}
      onNew={() => start()}
    />
    </div>
  );

  return (
    <TooltipProvider>
      <LookApplier />
      <ModHost />
      <AutomationRunner />
      {offer && (
        <div role="dialog" aria-label="Apply shared distro" className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center gap-3 border-b bg-popover p-3 text-sm shadow">
          <span className="flex-1">
            Someone shared a setup with you: <strong>{offer.name}</strong>. It only changes how MoonlightC looks and which sections you see.
          </span>
          <Button size="sm" onClick={() => (applyDistro(offer), setOffer(undefined))}>
            Apply {offer.name}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOffer(undefined)}>
            Not now
          </Button>
        </div>
      )}
      <div className={`flex h-dvh min-h-0 ${look.sidebarSide === "right" ? "flex-row-reverse" : ""}`}>
        {!quick && <aside className={`hidden w-72 shrink-0 bg-sidebar md:block ${look.sidebarSide === "right" ? "border-l" : "border-r"}`}>{sidebar}</aside>}
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent side="left" className="w-72 bg-sidebar p-0">
            <SheetTitle className="sr-only">Chats</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>

        <main className="flex min-w-0 flex-1 flex-col">
          {view !== "chat" && !quick && (
            <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2 md:hidden">
              <Button variant="ghost" size="icon" aria-label="Open chats" onClick={() => setNavOpen(true)}>
                <Menu />
              </Button>
              <span className="font-semibold">{VIEW_TITLES[view]}</span>
            </header>
          )}
          {view === "models" && <LocalModels onChat={() => go("chat")} />}
          {view === "connections" && <Connections />}
          {view === "customize" && <Customize availableViews={availableViews()} />}
          {view === "mods" && <ModsView />}
          {view === "automations" && (
            <Automations
              onOpenChat={(id) => {
                setActiveId(id);
                go("chat");
              }}
            />
          )}
          {view === "library" && (
            <Library
              onOpenProject={(id) => {
                start();
                setDraftProject(id);
                setProjectFilter(id);
              }}
            />
          )}
          {view === "studio" && (
            <Studio
              onOpenKeys={() => setKeysOpen(true)}
              onSendToChat={async (item) => {
                const url = await new Promise<string>((r) => {
                  const fr = new FileReader();
                  fr.onload = () => r(fr.result as string);
                  fr.readAsDataURL(item.blob);
                });
                start();
                setPendingFiles([{ type: "file", mediaType: item.mediaType, filename: `studio-${item.id.slice(0, 8)}.png`, url }]);
              }}
            />
          )}
          {view === "projects" && (
            <Projects
              onResume={(command, cwd, title) => {
                setLaunch((l) => ({ id: (l?.id ?? 0) + 1, command, cwd, title }));
                go("terminal");
              }}
            />
          )}
          {termOpened && (
            <div className={view === "terminal" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
              <Terminals request={launch} />
            </div>
          )}
          {view === "chat" && (<>
          <header className="flex h-14 shrink-0 items-center gap-1 border-b px-2">
            <Button variant="ghost" size="icon" className={quick ? "hidden" : "md:hidden"} aria-label="Open chats" onClick={() => setNavOpen(true)}>
              <Menu />
            </Button>
            {comparing ? (
              <span className="px-2 font-semibold">Compare models</span>
            ) : chatConns.length > 0 ? (
              <ModelPicker
                value={model}
                onChange={(r) => (saved ? patchChat(chat.id, { model: r }) : setDraftModel(r))}
              />
            ) : (
              <span className="px-2 font-semibold">MoonlightC</span>
            )}
            <div className="ml-auto flex items-center">
              {chatConns.length > 0 && (
                <Button variant={comparing ? "secondary" : "ghost"} size="sm" aria-pressed={comparing} aria-label="Compare" onClick={() => setComparing((c) => !c)}>
                  <Columns2 /> <span className="hidden sm:inline">Compare</span>
                </Button>
              )}
              <Button variant="ghost" size="icon" aria-label="Models and keys" onClick={() => setKeysOpen(true)}>
                <KeyRound />
              </Button>
              <ThemeToggle />
            </div>
          </header>
          {comparing ? (
            <CompareView initial={model} />
          ) : (
          <ChatView
            key={chat.id}
            chat={chat}
            model={model}
            mode={mode}
            modeSlot={(started) => (
              <>
              {projects.length > 0 && (
                <Select
                  value={(saved ? chat.projectId : (draftProject ?? projectFilter)) ?? "none"}
                  onValueChange={(v) => {
                    const id = v === "none" ? undefined : v;
                    if (saved) patchChat(chat.id, { projectId: id });
                    else setDraftProject(id);
                  }}
                >
                  <SelectTrigger size="sm" aria-label="Project" className="h-8 w-auto max-w-40 gap-1 border-0 bg-transparent shadow-none dark:bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <ModeSelect
                value={mode.id}
                lockPrivate={saved || started}
                onChange={(id) => (saved ? patchChat(chat.id, { modeId: id }) : setDraftMode(id))}
              />
              </>
            )}
            onBranch={branch}
            onOpenKeys={() => setKeysOpen(true)}
            onOpenArtifact={setArtifact}
            initialFiles={pendingFiles}
            bigInput={look.bigInput}
            projectId={saved ? chat.projectId : (draftProject ?? projectFilter)}
          />
          )}
          </>)}
        </main>
        {artifact && (
          <aside className="fixed inset-0 z-40 md:static md:z-auto md:w-[45%] md:shrink-0 md:border-l">
            <ArtifactPanel key={artifact.code} artifact={artifact} onClose={() => setArtifact(undefined)} />
          </aside>
        )}
      </div>
      <KeysDialog open={keysOpen} onOpenChange={setKeysOpen} />
      <ModesDialog open={modesOpen} onOpenChange={setModesOpen} />
      <CommandPalette
        actions={{
          newChat: () => start(),
          openChat: (id) => {
            setActiveId(id);
            setArtifact(undefined);
            setComparing(false);
          },
          pickModel: (r) => {
            update((s) => ({ ...s, lastModel: r }));
            if (saved) patchChat(chat.id, { model: r });
            else setDraftModel(r);
          },
          openKeys: () => setKeysOpen(true),
          openModes: () => setModesOpen(true),
          toggleCompare: () => setComparing((c) => !c),
        }}
      />
    </TooltipProvider>
  );
}
