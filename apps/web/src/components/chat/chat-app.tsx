"use client";

import type { UIMessage } from "ai";
import { Columns2, KeyRound, Menu } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getState, patchChat, saveChat, update, useStore, type Chat, type ModelRef } from "@/lib/store";
import type { Artifact } from "@/lib/artifacts";
import { ArtifactPanel } from "./artifact-panel";
import { ChatView } from "./chat-view";
import { CompareView } from "./compare-view";
import { KeysDialog } from "./keys-dialog";
import { ModelPicker } from "./model-picker";
import { ModeSelect, ModesDialog, useModes } from "./modes";
import { CommandPalette } from "./command-palette";
import { Sidebar } from "./sidebar";

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
  const [draftMode, setDraftMode] = useState("general");
  const [artifact, setArtifact] = useState<Artifact>();
  const [comparing, setComparing] = useState(false);
  const [modesOpen, setModesOpen] = useState(false);
  const modes = useModes();

  const chat = chats.find((c) => c.id === activeId) ?? draft;
  const saved = chats.some((c) => c.id === chat.id);
  const valid = (r?: ModelRef) => !!r && connections.some((c) => c.id === r.connectionId && c.models.some((m) => m.id === r.modelId));
  const fallback = connections[0] && { connectionId: connections[0].id, modelId: connections[0].models[0]?.id };
  const mode = modes.find((m) => m.id === (saved ? chat.modeId : draftMode)) ?? modes[0];
  const model = [chat.model, saved ? undefined : draftModel, mode.model, lastModel, fallback].find(valid);

  const start = (c: Chat = newChat()) => {
    setDraft(c);
    setActiveId(undefined);
    setDraftModel(undefined);
    setDraftMode("general");
    setArtifact(undefined);
    setComparing(false);
    setNavOpen(false);
  };

  const branch = (messages: UIMessage[]) => {
    const src = getState().chats.find((c) => c.id === chat.id) ?? chat;
    const c: Chat = { ...newChat(), title: `${src.title || "Chat"} (branch)`, model, modeId: mode.id, messages };
    saveChat(c);
    setActiveId(c.id);
  };

  const sidebar = (
    <Sidebar
      activeId={saved ? chat.id : undefined}
      onSelect={(id) => {
        setActiveId(id);
        setArtifact(undefined);
        setComparing(false);
        setNavOpen(false);
      }}
      onNew={() => start()}
    />
  );

  return (
    <TooltipProvider>
      <div className="flex h-dvh min-h-0">
        <aside className="hidden w-72 shrink-0 border-r bg-sidebar md:block">{sidebar}</aside>
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent side="left" className="w-72 bg-sidebar p-0">
            <SheetTitle className="sr-only">Chats</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-1 border-b px-2">
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open chats" onClick={() => setNavOpen(true)}>
              <Menu />
            </Button>
            {comparing ? (
              <span className="px-2 font-semibold">Compare models</span>
            ) : connections.length > 0 ? (
              <ModelPicker
                value={model}
                onChange={(r) => (saved ? patchChat(chat.id, { model: r }) : setDraftModel(r))}
              />
            ) : (
              <span className="px-2 font-semibold">MoonlightC</span>
            )}
            <div className="ml-auto flex items-center">
              {connections.length > 0 && (
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
              <ModeSelect
                value={mode.id}
                lockPrivate={saved || started}
                onChange={(id) => (saved ? patchChat(chat.id, { modeId: id }) : setDraftMode(id))}
              />
            )}
            onBranch={branch}
            onOpenKeys={() => setKeysOpen(true)}
            onOpenArtifact={setArtifact}
          />
          )}
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
