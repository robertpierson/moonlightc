"use client";

import { useChat } from "@ai-sdk/react";
import { estimateCost } from "@moonc/core";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls, type UIMessage } from "ai";
import { ArrowUp, FileText, Wrench, KeyRound, Paperclip, Square, X } from "lucide-react";
import { toast } from "sonner";
import type { Artifact } from "@/lib/artifacts";
import { runPython } from "@/lib/python";
import { composeText, isSupported, MAX_TOTAL_BYTES, readAttachment, type Attachment } from "@/lib/attachments";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { findModel, getState, saveChat, update, useStore, type Chat, type Mode, type ModelRef } from "@/lib/store";
import { Message, textOf, type Usage } from "./message";
import { MicButton } from "./mic-button";

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
  onOpenArtifact,
}: {
  chat: Chat;
  model?: ModelRef;
  mode: Mode;
  modeSlot: (started: boolean) => React.ReactNode;
  onBranch: (messages: UIMessage[]) => void;
  onOpenKeys: () => void;
  onOpenArtifact: (a: Artifact) => void;
}) {
  const [input, setInput] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
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
        tools: getState().webTools ? { search: getState().searchKey } : undefined,
      },
    };
  };

  // Automatic resubmits (after a browser-side tool runs) don't pass options, so the transport reads the latest request.
  const latest = useRef(request);
  useEffect(() => {
    latest.current = request;
  });
  const [transport] = useState(
    // eslint-disable-next-line react-hooks/refs -- the ref is read when a request is sent, not during render
    () => new DefaultChatTransport({ api: "/api/chat", body: () => latest.current().body ?? {} }),
  );

  const { messages, sendMessage, status, stop, regenerate, error, clearError, addToolOutput } = useChat({
    id: chat.id,
    messages: chat.messages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: async ({ toolCall }) => {
      if (toolCall.dynamic || toolCall.toolName !== "run_python") return;
      const { output, error } = await runPython((toolCall.input as { code: string }).code);
      addToolOutput({ tool: "run_python", toolCallId: toolCall.toolCallId, output: error ? { output, error } : { output } });
    },
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

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const bad = list.filter((f) => !isSupported(f));
    if (bad.length) toast.error(`Can't attach ${bad.map((f) => f.name).join(", ")}. Images, PDFs and text or code files work.`);
    const read = await Promise.all(list.filter(isSupported).map(readAttachment));
    setAttachments((prev) => {
      const next = [...prev, ...read];
      if (next.reduce((n, a) => n + a.size, 0) > MAX_TOTAL_BYTES) {
        toast.error("Attachments are limited to 3 MB per message for now. Remove a file or use a smaller one.");
        return prev;
      }
      return next;
    });
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && attachments.length === 0) || streaming || !canSend) return;
    clearError();
    const files = attachments.flatMap((a) => (a.kind === "file" ? [a.part] : []));
    sendMessage({ text: composeText(text, attachments), files }, request());
    setInput("");
    setAttachments([]);
  };

  const lastAssistant = messages.findLastIndex((m) => m.role === "assistant");

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-background/80 text-lg font-medium">
          Drop files to attach
        </div>
      )}
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
                sendMessage({ text, files: m.parts.filter((p) => p.type === "file"), messageId: m.id }, request());
              }}
              onRegenerate={() => {
                clearError();
                regenerate(request());
              }}
              onOpenArtifact={onOpenArtifact}
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
        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2 p-1" aria-label="Attachments">
            {attachments.map((a, i) => (
              <li key={i} className="flex items-center gap-1.5 rounded-lg border bg-background py-1 pr-1 pl-2 text-xs">
                {a.kind === "file" && a.part.mediaType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.part.url} alt="" className="size-6 rounded object-cover" />
                ) : (
                  <FileText className="size-4" />
                )}
                <span className="max-w-40 truncate">{a.kind === "file" ? a.part.filename : a.name}</span>
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${a.kind === "file" ? a.part.filename : a.name}`} onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            aria-label="Message"
            placeholder={canSend ? "Message MoonlightC…" : "Connect a model to start chatting"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => {
              if (e.clipboardData.files.length) {
                e.preventDefault();
                addFiles(e.clipboardData.files);
              }
            }}
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
            <Button type="submit" size="icon-lg" aria-label="Send message" disabled={(!input.trim() && attachments.length === 0) || !canSend}>
              <ArrowUp />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            aria-label="Attach files"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Attach files" onClick={() => fileInput.current?.click()}>
            <Paperclip />
          </Button>
          <MicButton onText={(t) => setInput((v) => (v ? `${v} ${t}` : t))} />
          <WebToggle />
          {modeSlot(messages.length > 0)}
        </div>
        </div>
      </form>
    </div>
  );
}

function WebToggle() {
  const on = useStore((s) => !!s.webTools);
  const hasSearch = useStore((s) => !!s.searchKey);
  return (
    <Button
      type="button"
      variant={on ? "secondary" : "ghost"}
      size="sm"
      aria-pressed={on}
      title={hasSearch ? "Let the AI search the web, read links and run Python" : "Let the AI read links and run Python (add a search key in Models and keys to search the web too)"}
      onClick={() => update((s) => ({ ...s, webTools: !s.webTools }))}
    >
      <Wrench /> Tools
    </Button>
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
