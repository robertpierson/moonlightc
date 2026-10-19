"use client";

import type { UIMessage } from "ai";
import { hasUnsavedChanges, nudgeUnsaved } from "@/lib/store";
import { YourComputers } from "@/components/remote/your-computers";
import { RemoteHost } from "@/components/remote/remote-host";
import { SyncRunner } from "@/components/account/sync-runner";
import { accountsEnabled } from "@/lib/supabase/client";
import { track, trackSessionStart, watchErrors } from "@/lib/analytics";
import { ConsentPrompt } from "@/components/account/consent";
import dynamic from "next/dynamic";

// Screens other than chat load on demand, so opening the app only downloads what chat needs.
const ArtifactPanel = dynamic(() => import("./artifact-panel").then((m) => m.ArtifactPanel), { loading: () => <div className="flex-1" /> });
const RemoteView = dynamic(() => import("@/components/remote/remote-view").then((m) => m.RemoteView), { ssr: false, loading: () => <div className="flex-1" /> });
const Settings = dynamic(() => import("@/components/settings/settings").then((m) => m.Settings), { loading: () => <div className="flex-1" /> });
const LocalModels = dynamic(() => import("@/components/desktop/local-models").then((m) => m.LocalModels), { loading: () => <div className="flex-1" /> });
const Automations = dynamic(() => import("@/components/desktop/automations").then((m) => m.Automations), { loading: () => <div className="flex-1" /> });
const CodeWorkspace = dynamic(() => import("@/components/code/code-workspace").then((m) => m.CodeWorkspace), { ssr: false, loading: () => <div className="flex-1" /> });
const Subscriptions = dynamic(() => import("@/components/subscriptions/subscriptions").then((m) => m.Subscriptions), { loading: () => <div className="flex-1" /> });
const Library = dynamic(() => import("@/components/library/library").then((m) => m.Library), { loading: () => <div className="flex-1" /> });
const Studio = dynamic(() => import("@/components/studio/studio").then((m) => m.Studio), { loading: () => <div className="flex-1" /> });
const Projects = dynamic(() => import("@/components/desktop/projects").then((m) => m.Projects), { loading: () => <div className="flex-1" /> });
const Terminals = dynamic(() => import("@/components/desktop/terminals").then((m) => m.Terminals), { ssr: false, loading: () => <div className="flex-1" /> });

import { Columns2, KeyRound, Menu, MessageSquare, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { findModel, getState, patchChat, saveChat, update, useStore, type Chat, type ModelRef } from "@/lib/store";
import { isAuto } from "@/lib/auto-model";
import type { Artifact } from "@/lib/artifacts";
import { availableViews, SectionNav, SettingsButton, WorkspaceSwitch, workspaceOf, type View, type Workspace } from "@/components/desktop/nav";
import { CodeSidebar } from "@/components/code/code-sidebar";
import { CoworkAccess } from "@/components/cowork/cowork-access";
import type { SettingsSection } from "@/components/settings/settings";
import { applyDistro, LookApplier, useLook } from "@/components/customize/look";
import { decodeDistro, DISTROS, matchShortcut, type Distro } from "@/lib/customize";
import { desktop } from "@/lib/desktop";
import { consumeMcpAuth } from "@/lib/mcp-auth-client";
import { consumeOAuthResult } from "@/lib/oauth-client";
import { finishOpenRouterSignIn, isOpenRouterReturn } from "@/lib/openrouter-auth";
import { toast } from "sonner";
import { ModHost } from "@/components/mods/mod-host";
import { AutomationRunner } from "@/components/desktop/automation-runner";
import { RenewalReminders } from "@/components/subscriptions/reminders";
import { ComputerBanner } from "@/components/desktop/computer-banner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FileUIPart } from "ai";
import type { LaunchRequest } from "@/components/desktop/terminals";
import { ChatView } from "./chat-view";
import { KeysDialog } from "./keys-dialog";
import { ThinkingSelect } from "@/components/chat/thinking-select";
import { useDevices } from "@/components/remote/your-computers";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { isOnline } from "@/lib/remote";
import { summarize } from "@/lib/summarize";
import { syncClaudeCode } from "@/lib/claude-code";
import { linkHomePcModels } from "@/lib/home-pc";
import { ModelPicker } from "./model-picker";
import { ModeSelect, ModesDialog, useModes } from "./modes";
import { CommandPalette } from "./command-palette";
import { AllChats, Sidebar } from "./sidebar";

const VIEW_TITLES: Record<View, string> = { chat: "Chat", remote: "Your computer", chats: "All chats", cowork: "Cowork", code: "Code", subscriptions: "Subscriptions", library: "Projects", studio: "Studio", terminal: "Terminal", projects: "Local projects", models: "Model library", automations: "Automations", settings: "Settings" };

function distroDefaultMode() {
  const s = getState();
  return [...DISTROS, ...(s.customDistros ?? [])].find((d) => d.id === s.distroId)?.defaultModeId;
}

const newChat = (): Chat => ({ id: crypto.randomUUID(), title: "", messages: [], updatedAt: Date.now() });
const noop = () => () => {};

export function ChatApp() {
  // Local storage only exists in the browser; render after mount to avoid hydration mismatches.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? <Inner /> : <Shell />;
}

/** Server-rendered frame with the same layout as the app, so the first paint isn't blank and nothing jumps. */
function Shell() {
  return (
    <div className="flex h-dvh min-h-0" aria-busy="true">
      <aside className="hidden w-72 shrink-0 border-r bg-sidebar md:block" />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="h-14 shrink-0 border-b" />
        <div className="flex flex-1 flex-col items-center pt-[18vh]">
          <h2 className="text-2xl font-semibold tracking-tight">What can I help with?</h2>
        </div>
        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          <div className="h-[6.25rem] rounded-2xl border bg-card" />
        </div>
      </main>
    </div>
  );
}

function Inner() {
  const chats = useStore((s) => s.chats);
  const connections = useStore((s) => s.connections);
  const lastModel = useStore((s) => s.lastModel);
  const [draft, setDraft] = useState<Chat>(newChat);
  const [activeId, setActiveId] = useState<string>();
  const [navOpen, setNavOpen] = useState(false);
  // ?keys=1 (from onboarding) opens the key form straight away.
  const [keysOpen, setKeysOpen] = useState(() => new URLSearchParams(location.search).has("keys"));
  // Desktop: Claude Code on this PC shows up as models (Chat, Cowork and Code).
  // Other devices: your home PC's models (Claude Code, local ones) show up too, without a remote session.
  useEffect(() => {
    if (desktop()) syncClaudeCode().catch(() => {});
    else if (accountsEnabled) {
      // Home PC models show only while it's actually connected.
      if (getState().connections.some((c) => c.id === "home-pc")) update((s) => ({ ...s, connections: s.connections.filter((c) => c.id !== "home-pc") }));
      linkHomePcModels().catch(() => {});
    }
  }, []);
  // Desktop: offer AI keys already set up on this PC (shown masked; nothing is added until you pick them).
  useEffect(() => {
    const b = desktop();
    if (!b) return;
    b.keys.scan().then((list) => {
      const fresh = list.filter((k) => !getState().connections.some((c) => c.apiKey === k.value));
      const sig = fresh.map((k) => k.masked).join(",");
      if (!fresh.length || localStorage.getItem("moonc:keys-offered") === sig) return;
      localStorage.setItem("moonc:keys-offered", sig);
      toast(`Found ${fresh.length} AI key${fresh.length > 1 ? "s" : ""} on this PC`, {
        description: "Review them and add the ones you want.",
        duration: 15_000,
        action: {
          label: "Review",
          onClick: () => {
            history.replaceState(null, "", `${location.pathname}?scan=1`);
            setKeysOpen(true);
          },
        },
      });
    });
  }, []);
  const [draftModel, setDraftModel] = useState<ModelRef>();
  const [draftMode, setDraftMode] = useState(() => distroDefaultMode() ?? "general");
  const look = useLook();
  const [offer, setOffer] = useState<Distro | undefined>(() => {
    const raw = new URLSearchParams(location.search).get("distro");
    if (!raw) return undefined;
    try {
      return decodeDistro(raw);
    } catch {
      return undefined;
    }
  });
  const [artifact, setArtifact] = useState<Artifact>();
  const [modesOpen, setModesOpen] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [workspace, setWorkspace] = useState<Workspace>("chat");
  const [codeProjectId, setCodeProjectId] = useState<string>();
  const [codeChatId, setCodeChatId] = useState<string>();
  const [libraryProject, setLibraryProject] = useState<string>();
  const [remoteDevice, setRemoteDevice] = useState<string>();
  const [section, setSection] = useState<SettingsSection>("general");
  const [termOpened, setTermOpened] = useState(false);
  const [launch, setLaunch] = useState<LaunchRequest>();
  const [pendingFiles, setPendingFiles] = useState<FileUIPart[]>();
  const [pendingText, setPendingText] = useState<string>();
  const [sideChat, setSideChat] = useState(false);
  const [remoteLive, setRemoteLive] = useState(false);
  const [remoteDevice2, setRemoteDevice2] = useState<string>();
  const [pip, setPip] = useState({ x: 16, y: 16 });
  const [draftProject, setDraftProject] = useState<string>();
  const projects = useStore((s) => s.projects) ?? [];
  const [quick] = useState(() => new URLSearchParams(location.search).has("quick"));
  // Like Discord: you can't leave Settings with unsaved changes; the Save / Reset bar shakes instead.
  const blocked = () => {
    if (view !== "settings" || !hasUnsavedChanges()) return false;
    nudgeUnsaved();
    return true;
  };
  const go = (v: View) => {
    if (v !== "settings" && blocked()) return;
    setView(v);
    setWorkspace((w) => workspaceOf(v, w));
    track(`feature.${v}`);
    if (v === "terminal") setTermOpened(true);
    setNavOpen(false);
  };
  const openSettings = (sec: SettingsSection) => {
    setSection(sec);
    go("settings");
  };
  const modes = useModes();

  // A new chat is saved after its first message; read the saved copy from then on so mode and model changes stick.
  const chat = chats.find((c) => c.id === (activeId ?? draft.id)) ?? draft;
  const saved = chats.some((c) => c.id === chat.id);
  const autoReady = useStore((s) => !!findModel(s.autoPicks?.everyday));
  const valid = (r?: ModelRef) => (isAuto(r) ? autoReady : !!r && connections.some((c) => c.id === r.connectionId && c.models.some((m) => m.id === r.modelId)));
  const chatConns = connections.filter((c) => c.models.length > 0);
  const fallback = chatConns[0] && { connectionId: chatConns[0].id, modelId: chatConns[0].models[0].id };
  const mode = modes.find((m) => m.id === (saved ? chat.modeId : draftMode)) ?? modes[0];
  const model = [chat.model, saved ? undefined : draftModel, mode.model, lastModel, fallback].find(valid);

  const start = (c: Chat = newChat(), ws: "chat" | "cowork" = workspace === "cowork" ? "cowork" : "chat") => {
    if (blocked()) return;
    setPendingText(undefined);
    setDraft(ws === "cowork" ? { ...c, workspace: "cowork" } : c);
    setActiveId(undefined);
    setDraftModel(undefined);
    setDraftMode(distroDefaultMode() ?? "general");
    setDraftProject(undefined);
    setArtifact(undefined);
    setView(ws);
    setWorkspace(ws);
    setNavOpen(false);
  };
  // "Continue in a new chat": the AI summarizes the old chat and the summary waits in a new chat's message box.
  const startRef = useRef(start);
  useEffect(() => {
    startRef.current = start;
  });
  useEffect(() => {
    const go = async (e: Event) => {
      const old = getState().chats.find((c) => c.id === (e as CustomEvent<string>).detail);
      if (!old) return;
      const id = toast.loading("Summarizing the chat…");
      try {
        const summary = await summarize(old, "summary");
        startRef.current(newChat(), old.workspace === "cowork" ? "cowork" : "chat");
        setPendingText(`Continuing from my chat "${old.title}". Summary:

${summary}

`);
        toast.success("Summary added to a new chat. Add your next question and send.", { id });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err), { id });
      }
    };
    addEventListener("moonc:continue", go);
    return () => removeEventListener("moonc:continue", go);
  }, []);
  const switchWorkspace = (w: Workspace) => {
    if (w === "code") return go("code");
    const isCowork = chat.workspace === "cowork";
    if (w === "cowork") return isCowork ? go("cowork") : start(newChat(), "cowork");
    return isCowork ? start(newChat(), "chat") : go("chat");
  };

  // Sign-in results for connectors arrive in the address fragment (web) or a moonlightc:// link (desktop).
  useEffect(() => {
    const finishOpenRouter = (params: URLSearchParams) =>
      finishOpenRouterSignIn(params).then(
        (n) => toast.success(`Signed in to OpenRouter: ${n} models unlocked.`),
        (e: Error) => toast.error(e.message),
      );
    trackSessionStart();
    watchErrors();
    const query = new URLSearchParams(location.search);
    if (query.has("keys")) history.replaceState(null, "", location.pathname);
    if (isOpenRouterReturn(query)) {
      history.replaceState(null, "", location.pathname);
      finishOpenRouter(query);
    }
    const hash = location.hash;
    if (consumeOAuthResult(hash)) history.replaceState(null, "", location.pathname + location.search);
    if (hash.includes("mcpauth=") || hash.includes("mcperror=")) {
      history.replaceState(null, "", location.pathname + location.search);
      consumeMcpAuth(hash).then(() => openSettings("connectors"));
    }
    return desktop()?.onDeepLink((url) => {
      if (url.startsWith("moonlightc://openrouter")) {
        finishOpenRouter(new URL(url).searchParams);
        return;
      }
      if (url.startsWith("moonlightc://mcpauth")) {
        consumeMcpAuth(new URL(url).hash).then(() => openSettings("connectors"));
        return;
      }
      if (url.startsWith("moonlightc://oauth")) {
        consumeOAuthResult(new URL(url).hash);
        openSettings("connectors");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on open; openSettings only sets state
  }, []);
  // Drop ?distro= from the address once read, so reloading doesn't offer it again.
  useEffect(() => {
    if (new URLSearchParams(location.search).has("distro")) history.replaceState(null, "", location.pathname);
  }, []);
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

  // The chat itself, shown in Chat/Cowork, and in a side panel during remote control.
  const chatView = (
    <ChatView
      key={chat.id}
      cowork={view === "cowork"}
      chat={chat}
      model={model}
      mode={mode}
      modeSlot={(started) => (
        <>
        {projects.length > 0 && (
          <Select
            value={(saved ? chat.projectId : (draftProject)) ?? "none"}
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
        {chatConns.length > 0 && (
          <>
            <ModelPicker compact id="composer-model" value={model} onChange={(r) => (saved ? patchChat(chat.id, { model: r }) : setDraftModel(r))} />
            <ThinkingSelect model={model} />
          </>
        )}
        </>
      )}
      onBranch={branch}
      onOpenKeys={() => setKeysOpen(true)}
      onOpenArtifact={setArtifact}
      initialFiles={pendingFiles}
      initialText={pendingText}
      bigInput={look.bigInput}
      projectId={saved ? chat.projectId : (draftProject)}
    />
  );

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col" data-workspace={workspace}>
      <div className="grid gap-2 border-b p-2">
        <WorkspaceSwitch workspace={workspace} onChange={switchWorkspace} hidden={look.hidden} />
        <SectionNav workspace={workspace} view={view} onChange={go} hidden={look.hidden} />
      </div>
      {workspace === "code" ? (
        <CodeSidebar
          projectId={codeProjectId}
          chatId={codeChatId}
          onSelect={(id, chatId) => {
            setCodeProjectId(id);
            setCodeChatId(chatId);
            go("code");
          }}
        />
      ) : (
        <Sidebar
          top={
            workspace === "cowork" && accountsEnabled ? (
              <YourComputers
                activeId={view === "remote" ? remoteDevice : undefined}
                onOpen={(id) => {
                  setRemoteDevice(id);
                  go("remote");
                }}
              />
            ) : undefined
          }
          workspace={workspace}
          activeId={saved ? chat.id : undefined}
          onSelect={(id) => {
            if (blocked()) return;
            setActiveId(id);
            setArtifact(undefined);
            setView(workspace);
            setNavOpen(false);
          }}
          onNew={() => start()}
          onAllChats={() => go("chats")}
          onOpenProject={(id) => {
            setLibraryProject(id);
            go("library");
          }}
        />
      )}
      <SettingsButton active={view === "settings"} onClick={() => openSettings(section)} onProfile={() => openSettings("profile")} />
    </div>
  );

  return (
    <TooltipProvider>
      <LookApplier />
      <ModHost />
      <AutomationRunner />
      <RenewalReminders />
      <ConsentPrompt />
      {accountsEnabled && <SyncRunner />}
      {accountsEnabled && desktop() && <RemoteHost />}
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
        {!quick && <aside className={`hidden w-72 shrink-0 md:block bg-sidebar ${look.sidebarSide === "right" ? "border-l" : "border-r"}`}>{sidebar}</aside>}
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent side="left" className={`w-72 p-0 bg-sidebar`}>
            <SheetTitle className="sr-only">Chats</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>

        <main className="flex min-w-0 flex-1 flex-col">
          <ComputerBanner />
          {view !== "chat" && view !== "cowork" && !quick && (
            <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2 md:hidden">
              <Button variant="ghost" size="icon" aria-label="Open chats" onClick={() => setNavOpen(true)}>
                <Menu />
              </Button>
              <span className="font-semibold">{VIEW_TITLES[view]}</span>
            </header>
          )}
          {view === "settings" && <Settings section={section} onSection={setSection} availableViews={availableViews()} onClose={() => go(workspace)} onChat={() => go("chat")} />}
          {remoteDevice && (
            // Remote control stays connected when you go elsewhere: then it floats as a small picture you can move
            // and resize (watch only), until you come back.
            <div
              className={view === "remote" ? `relative flex min-h-0 flex-1 ${remoteDevice2 ? "flex-col md:flex-row" : ""}` : remoteLive ? "fixed z-40 overflow-hidden rounded-xl border bg-card shadow-xl [resize:both]" : "hidden"}
              style={view === "remote" ? undefined : { right: pip.x, bottom: pip.y, width: 360, height: 240, minWidth: 220, minHeight: 150, maxWidth: "90vw", maxHeight: "80vh" }}
              onPointerDown={(e) => {
                if (view === "remote" || !(e.target as HTMLElement).closest("[data-pip-handle]") || (e.target as HTMLElement).closest("button")) return;
                // The window is placed from the bottom-right corner, so moving the pointer right/down shrinks the offsets.
                const start = { cx: e.clientX, cy: e.clientY, x: pip.x, y: pip.y };
                const move = (m: PointerEvent) => setPip({ x: Math.max(0, start.x - (m.clientX - start.cx)), y: Math.max(0, start.y - (m.clientY - start.cy)) });
                const up = () => {
                  removeEventListener("pointermove", move);
                  removeEventListener("pointerup", up);
                };
                addEventListener("pointermove", move);
                addEventListener("pointerup", up);
              }}
            >
              <RemoteView
                key={remoteDevice}
                deviceId={remoteDevice}
                mini={view !== "remote"}
                onLive={setRemoteLive}
                onOpen={() => go("remote")}
                onClose={() => {
                  setRemoteDevice(undefined);
                  setRemoteLive(false);
                }}
                onSetup={() => openSettings("account")}
                extra={
                  <>
                    {!remoteDevice2 && <SplitPicker current={remoteDevice} onPick={setRemoteDevice2} />}
                    <Button size="sm" variant="secondary" aria-pressed={sideChat} onClick={() => setSideChat((v) => !v)}>
                      <MessageSquare /> {sideChat ? "Close chat" : "Chat"}
                    </Button>
                  </>
                }
              />
              {/* Split screen: a second PC beside the first, each with its own connection and controls. */}
              {view === "remote" && remoteDevice2 && (
                <div className="flex min-h-0 flex-1 border-t md:border-t-0 md:border-l">
                  <RemoteView
                    key={`split:${remoteDevice2}`}
                    deviceId={remoteDevice2}
                    onSetup={() => openSettings("account")}
                    extra={
                      <Button size="sm" variant="secondary" onClick={() => setRemoteDevice2(undefined)}>
                        <X /> Close split
                      </Button>
                    }
                  />
                </div>
              )}
              {view === "remote" && sideChat && (
                <aside aria-label="Chat beside remote control" className="fixed inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l bg-background md:static md:z-auto md:w-96">
                  <div className="flex justify-end border-b p-1 md:hidden">
                    <Button size="sm" variant="ghost" onClick={() => setSideChat(false)}>
                      Close chat
                    </Button>
                  </div>
                  {chatView}
                </aside>
              )}
            </div>
          )}
          {view === "code" && <CodeWorkspace
              projectId={codeProjectId}
              chatId={codeChatId}
              onSelect={(id, chatId) => {
                setCodeProjectId(id);
                setCodeChatId(chatId);
              }} onConnectGitHub={() => openSettings("connectors")} onOpenConnectors={() => openSettings("connectors")} />}
          {view === "chats" && (
            <AllChats
              workspace={workspace === "cowork" ? "cowork" : "chat"}
              activeId={saved ? chat.id : undefined}
              onSelect={(id) => {
                setActiveId(id);
                go(workspace === "cowork" ? "cowork" : "chat");
              }}
              onNew={() => start()}
            />
          )}
          {view === "subscriptions" && <Subscriptions onConnectGoogle={() => openSettings("connectors")} />}
          {view === "models" && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-5xl px-4 py-6">
                <LocalModels onChat={() => go("chat")} />
              </div>
            </div>
          )}
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
              selectedId={libraryProject}
              onSelectProject={setLibraryProject}
              onOpenProject={(id) => {
                start(newChat(), "chat");
                setDraftProject(id);
              }}
              onOpenChat={(id) => {
                setActiveId(id);
                go("chat");
              }}
              onOpenConnectors={() => openSettings("connectors")}
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
          {(view === "chat" || view === "cowork") && (<>
          <header className="flex h-14 shrink-0 items-center gap-1 border-b px-2">
            <Button variant="ghost" size="icon" className={quick ? "hidden" : "md:hidden"} aria-label="Open chats" onClick={() => setNavOpen(true)}>
              <Menu />
            </Button>
            <span className="min-w-0 truncate px-2 font-semibold">{saved && chat.title ? chat.title : "MoonlightC"}</span>
            <div className="ml-auto flex items-center">
              <Button variant="ghost" size="icon" aria-label="Models and keys" onClick={() => setKeysOpen(true)}>
                <KeyRound />
              </Button>
              <ThemeToggle />
            </div>
          </header>
          {view === "cowork" && (
            <CoworkAccess
              onOpenSettings={openSettings}
              onOpenScreen={(id) => {
                setRemoteDevice(id);
                go("remote");
              }}
            />
          )}
          {chatView}
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
            setView("chat");
          },
          pickModel: (r) => {
            update((s) => ({ ...s, lastModel: r }));
            if (saved) patchChat(chat.id, { model: r });
            else setDraftModel(r);
          },
          openKeys: () => setKeysOpen(true),
          openModes: () => setModesOpen(true),
          openSettings: () => openSettings("general"),
        }}
      />
    </TooltipProvider>
  );
}

/** Remote control: open another of your online PCs beside this one. */
function SplitPicker({ current, onPick }: { current: string; onPick: (id: string) => void }) {
  const others = useDevices().filter((d) => d.id !== current && d.remote_enabled && isOnline(d));
  if (!others.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary">
          <Columns2 /> Split screen
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {others.map((d) => (
          <DropdownMenuItem key={d.id} onSelect={() => onPick(d.id)}>
            {d.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
