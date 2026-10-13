"use client";

import type { UIMessage } from "ai";
import { KeyRound, Menu } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getState, patchChat, saveChat, useStore, type Chat, type ModelRef } from "@/lib/store";
import { ChatView } from "./chat-view";
import { KeysDialog } from "./keys-dialog";
import { ModelPicker } from "./model-picker";
import { ModeSelect, useModes } from "./modes";
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
            {connections.length > 0 ? (
              <ModelPicker
                value={model}
                onChange={(r) => (saved ? patchChat(chat.id, { model: r }) : setDraftModel(r))}
              />
            ) : (
              <span className="px-2 font-semibold">MoonlightC</span>
            )}
            <div className="ml-auto flex items-center">
              <Button variant="ghost" size="icon" aria-label="Models and keys" onClick={() => setKeysOpen(true)}>
                <KeyRound />
              </Button>
              <ThemeToggle />
            </div>
          </header>
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
          />
        </main>
      </div>
      <KeysDialog open={keysOpen} onOpenChange={setKeysOpen} />
    </TooltipProvider>
  );
}
