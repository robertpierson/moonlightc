"use client";

import { useChat } from "@ai-sdk/react";
import { estimateCost } from "@moonc/core";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, KeyRound, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { findModel, getState, saveChat, type Chat, type Mode, type ModelRef } from "@/lib/store";
import { Message, textOf, type Usage } from "./message";

function costLabel(m: UIMessage): string | undefined {
  const meta = m.metadata as { usage?: Usage; modelId?: string } | undefined;
  const u = meta?.usage;
  if (!u?.outputTokens) return undefined;
  const tokens = `${((u.inputTokens ?? 0) + u.outputTokens).toLocaleString()} tokens`;
  const model = getState()
    .connections.flatMap((c) => c.models)
    .find((x) => x.id === meta?.modelId);
  const cost = model && estimateCost(model, u.inputTokens ?? 0, u.outputTokens);
  return cost === undefined ? tokens : `${tokens} · ~$${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}`;
}

export function ChatView({
  chat,
  model,
  mode,
  modeSlot,
  onBranch,
  onOpenKeys,
}: {
  chat: Chat;
  model?: ModelRef;
  mode: Mode;
  modeSlot: (started: boolean) => React.ReactNode;
  onBranch: (messages: UIMessage[]) => void;
  onOpenKeys: () => void;
}) {
  const [input, setInput] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const [transport] = useState(() => new DefaultChatTransport({ api: "/api/chat" }));

  // The key and model travel with each request, so switching models mid-chat just works.
  const request = () => {
    const found = findModel(model);
    if (!found) return {};
    const { apiKey, providerId, baseURL } = found.conn;
    return {
      body: {
        connection: { apiKey, providerId, baseURL },
        modelId: found.model.id,
        instructions: mode.instructions,
        temperature: mode.temperature,
      },
    };
  };

  const { messages, sendMessage, status, stop, regenerate, error, clearError } = useChat({
    id: chat.id,
    messages: chat.messages,
    transport,
  });

  const streaming = status === "streaming" || status === "submitted";

  // Persist whenever a turn settles (including after Stop, which keeps the partial answer).
  useEffect(() => {
    if (streaming || messages.length === 0 || mode.private) return;
    const first = messages.find((m) => m.role === "user");
    const saved = getState().chats.find((c) => c.id === chat.id) ?? chat;
    saveChat({
      ...saved,
      title: saved.title || (first ? textOf(first).slice(0, 60) : "New chat"),
      model,
      modeId: mode.id,
      messages,
      updatedAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, streaming]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const canSend = !!findModel(model);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || streaming || !canSend) return;
    clearError();
    sendMessage({ text }, request());
    setInput("");
  };

  const lastAssistant = messages.findLastIndex((m) => m.role === "assistant");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 pt-[18vh] text-center">
              <h2 className="text-2xl font-semibold tracking-tight">{mode.private ? "Private chat" : "What can I help with?"}</h2>
              {mode.private && <p className="max-w-sm text-sm text-muted-foreground">Nothing in this chat is saved. Close it or start a new chat and it&apos;s gone.</p>}
              {!canSend && (
                <Button onClick={onOpenKeys}>
                  <KeyRound /> Connect a model
                </Button>
              )}
            </div>
          )}
          {messages.map((m, i) => (
            <Message
              key={m.id}
              message={m}
              streaming={streaming && i === messages.length - 1 && m.role === "assistant"}
              isLast={i === lastAssistant && i === messages.length - 1}
              costLabel={m.role === "assistant" ? costLabel(m) : undefined}
              onEdit={(text) => {
                clearError();
                sendMessage({ text, messageId: m.id }, request());
              }}
              onRegenerate={() => {
                clearError();
                regenerate(request());
              }}
              onBranch={mode.private ? undefined : () => onBranch(messages.slice(0, i + 1))}
            />
          ))}
          {status === "submitted" && <div className="size-2.5 animate-pulse rounded-full bg-primary" aria-label="Waiting for the model" />}
          {error && (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <span className="flex-1">{friendly(error.message)}</span>
              <Button size="sm" variant="outline" onClick={() => { clearError(); regenerate(request()); }}>
                Retry
              </Button>
            </div>
          )}
          <div ref={bottom} />
        </div>
      </div>

      <form onSubmit={submit} className="mx-auto w-full max-w-3xl px-4 pb-4">
        <div className="rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
        <div className="flex items-end gap-2">
          <Textarea
            aria-label="Message"
            placeholder={canSend ? "Message MoonlightC…" : "Connect a model to start chatting"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
            }}
            rows={1}
            className="max-h-60 min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          {streaming ? (
            <Button type="button" size="icon-lg" aria-label="Stop generating" onClick={() => stop()}>
              <Square className="fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon-lg" aria-label="Send message" disabled={!input.trim() || !canSend}>
              <ArrowUp />
            </Button>
          )}
        </div>
        <div className="flex items-center">{modeSlot(messages.length > 0)}</div>
        </div>
      </form>
    </div>
  );
}

// Route errors arrive as JSON bodies; show just the message.
function friendly(msg: string) {
  try {
    return (JSON.parse(msg) as { error?: string }).error ?? msg;
  } catch {
    return msg;
  }
}
