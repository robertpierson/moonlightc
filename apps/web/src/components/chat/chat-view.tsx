"use client";

import { useChat } from "@ai-sdk/react";
import { BROWSER_TOOLS, callExtension, hasExtension } from "@/lib/browser-ext";
import {
  expandPluginCommand,
  findSkill,
  skillsInstructions,
} from "@/lib/claude-plugins";
import { classifyTask, isAuto, resolveAuto } from "@/lib/auto-model";
import { estimateCost } from "@moonc/core";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
  type FileUIPart,
  type UIMessage,
} from "ai";
import {
  ArrowUp,
  FileText,
  MousePointerClick,
  Wrench,
  KeyRound,
  Paperclip,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Artifact } from "@/lib/artifacts";
import { buildInstructions, relevantMemories } from "@/lib/context";
import { callModTool, modToolName } from "@/lib/mods";
import { fillCommand } from "@moonc/mods-sdk";
import { desktop, type ComputerAction } from "@/lib/desktop";
import { refreshMcpTokens } from "@/lib/mcp-auth-client";
import { googleToken, oauthToken } from "@/lib/oauth-client";
import { runPython } from "@/lib/python";

/** "/tldr some text" -> the installed mod command's prompt with the text filled in. */
function expandCommand(text: string) {
  const fromPlugin = expandPluginCommand(text, getState().plugins ?? []);
  if (fromPlugin !== undefined) return fromPlugin;
  const m = text.match(/^(\/[a-z0-9-]+)(?:\s+([\s\S]*))?$/);
  if (!m) return text;
  const cmd = (getState().mods ?? [])
    .filter((x) => x.enabled)
    .flatMap((x) => x.manifest.commands)
    .find((c) => c.name === m[1]);
  return cmd ? fillCommand(cmd.prompt, m[2] ?? "") : text;
}
import {
  composeText,
  isSupported,
  MAX_TOTAL_BYTES,
  readAttachment,
  type Attachment,
} from "@/lib/attachments";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  addMemory,
  findModel,
  getState,
  saveChat,
  update,
  useStore,
  type Chat,
  type Mode,
  type ModelRef,
} from "@/lib/store";
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
  return cost === undefined
    ? tokens
    : `${tokens} · ~$${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}`;
}

export function ChatView({
  chat,
  model,
  mode,
  modeSlot,
  onBranch,
  onOpenKeys,
  onOpenArtifact,
  initialFiles,
  bigInput,
  projectId,
}: {
  chat: Chat;
  model?: ModelRef;
  mode: Mode;
  modeSlot: (started: boolean) => React.ReactNode;
  onBranch: (messages: UIMessage[]) => void;
  onOpenKeys: () => void;
  onOpenArtifact: (a: Artifact) => void;
  initialFiles?: FileUIPart[];
  bigInput?: boolean;
  projectId?: string;
}) {
  const [input, setInput] = useState("");
  const [computerOn, setComputerOn] = useState(false);
  const googleTokenRef = useRef<string | undefined>(undefined);
  const accountsRef = useRef<{
    spotify?: string;
    slack?: string;
    discord?: string;
    x?: string;
  }>({});
  const hasSearchKey = useStore((s) => !!s.searchKey);
  const userName = useStore((s) => s.profile?.name?.trim().split(/\s+/)[0]);
  const bottom = useRef<HTMLDivElement>(null);
  // The key and model travel with each request, so switching models mid-chat just works.
  const messagesRef = useRef<UIMessage[]>(chat.messages);
  const lastUserText = () => {
    const m = [...messagesRef.current].reverse().find((x) => x.role === "user");
    return m ? textOf(m) : input;
  };

  const lastUserHasImage = () =>
    !![...messagesRef.current]
      .reverse()
      .find((x) => x.role === "user")
      ?.parts.some(
        (p) => p.type === "file" && p.mediaType.startsWith("image/"),
      );

  const request = () => {
    const skillsText = skillsInstructions(getState().plugins ?? []);
    const found = findModel(
      isAuto(model)
        ? resolveAuto(
            classifyTask(lastUserText(), lastUserHasImage()),
            getState().autoPicks,
          )
        : model,
    );
    if (!found) return {};
    const { apiKey, providerId, baseURL } = found.conn;
    return {
      body: {
        connection: { apiKey, providerId, baseURL },
        modelId: found.model.id,
        instructions: [
          buildInstructions({
            mode: mode.instructions,
            project: getState().projects?.find((p) => p.id === projectId),
            memoryOn: !!getState().memory?.enabled && !mode.private,
            memories: relevantMemories(
              getState().memory?.items ?? [],
              lastUserText(),
              projectId,
            ),
          }),
          skillsText,
          getState().profile?.name?.trim() ? `The user's name is ${getState().profile!.name!.trim()}.` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        skills: !!skillsText || undefined,
        memory: (!!getState().memory?.enabled && !mode.private) || undefined,
        computer: computerOn || undefined,
        files: !!desktop() || undefined,
        browser: hasExtension() || undefined,
        google: googleTokenRef.current
          ? { accessToken: googleTokenRef.current }
          : undefined,
        accounts: accountsRef.current,
        temperature: mode.temperature,
        tools:
          getState().webTools || mode.research
            ? { search: getState().searchKey }
            : undefined,
        research: mode.research || undefined,
        modTools: (getState().mods ?? [])
          .filter((m) => m.enabled && m.code)
          .flatMap((m) =>
            m.manifest.tools.map((t) => ({
              name: modToolName(m.manifest.id, t.name),
              description: `${t.description} (from the ${m.manifest.name} mod)`,
              inputSchema: t.inputSchema,
            })),
          ),
        mcp: (getState().mcpServers ?? [])
          .filter((m) => m.enabled)
          .map(
            ({ id, name, kind, url, token, command, args, policy, oauth }) => ({
              id,
              name,
              kind,
              url,
              token,
              accessToken: oauth?.tokens?.access_token,
              command,
              args,
              policy,
            }),
          ),
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
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        // The outgoing messages include the one just sent, which Auto and memory need to look at.
        prepareSendMessagesRequest: ({
          id,
          messages,
          body,
          trigger,
          messageId,
        }) => {
          messagesRef.current = messages;
          return {
            body: {
              ...body,
              id,
              messages,
              trigger,
              messageId,
              ...(latest.current().body ?? {}),
            },
          };
        },
      }),
  );

  const {
    messages,
    sendMessage,
    status,
    stop,
    regenerate,
    error,
    clearError,
    addToolOutput,
    addToolApprovalResponse,
  } = useChat({
    id: chat.id,
    messages: chat.messages,
    transport,
    sendAutomaticallyWhen: (o) =>
      lastAssistantMessageIsCompleteWithToolCalls(o) ||
      lastAssistantMessageIsCompleteWithApprovalResponses(o),
    onToolCall: async ({ toolCall }) => {
      if (toolCall.dynamic) return;
      if (toolCall.toolName === "computer") {
        const bridge = desktop();
        try {
          if (!bridge)
            throw new Error("Computer use works in the desktop app.");
          const output = await bridge.computer.act(
            toolCall.input as ComputerAction,
          );
          addToolOutput({
            tool: "computer",
            toolCallId: toolCall.toolCallId,
            output,
          } as never);
        } catch (e) {
          addToolOutput({
            tool: "computer",
            toolCallId: toolCall.toolCallId,
            output: { error: e instanceof Error ? e.message : String(e) },
          } as never);
        }
        return;
      }
      if (BROWSER_TOOLS[toolCall.toolName]) {
        try {
          const output = await callExtension(BROWSER_TOOLS[toolCall.toolName], toolCall.input as object);
          addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output } as never);
        } catch (e) {
          addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output: { error: e instanceof Error ? e.message : String(e) } } as never);
        }
        return;
      }
      if (toolCall.toolName === "load_skill") {
        const name = String((toolCall.input as { name?: string }).name ?? "");
        const skill = findSkill(getState().plugins ?? [], name);
        addToolOutput({
          tool: "load_skill",
          toolCallId: toolCall.toolCallId,
          output: skill
            ? { instructions: skill.body }
            : { error: `No skill named ${name}.` },
        } as never);
        return;
      }
      if (toolCall.toolName === "save_memory") {
        const fact = String((toolCall.input as { fact?: string }).fact ?? "")
          .slice(0, 500)
          .trim();
        if (fact) addMemory(fact, projectId);
        addToolOutput({
          tool: "save_memory",
          toolCallId: toolCall.toolCallId,
          output: { saved: !!fact },
        } as never);
        return;
      }
      if (toolCall.toolName.startsWith("mod_")) {
        const mod = (getState().mods ?? []).find((m) =>
          m.manifest.tools.some(
            (t) => modToolName(m.manifest.id, t.name) === toolCall.toolName,
          ),
        );
        const t = mod?.manifest.tools.find(
          (x) => modToolName(mod.manifest.id, x.name) === toolCall.toolName,
        );
        try {
          if (!mod || !t) throw new Error("That mod isn't installed anymore.");
          const output = await callModTool(
            mod.manifest.id,
            t.name,
            toolCall.input,
          );
          addToolOutput({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: output ?? null,
          } as never);
        } catch (e) {
          addToolOutput({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            output: { error: e instanceof Error ? e.message : String(e) },
          } as never);
        }
        return;
      }
      if (toolCall.toolName !== "run_python") return;
      const { output, error } = await runPython(
        (toolCall.input as { code: string }).code,
      );
      addToolOutput({
        tool: "run_python",
        toolCallId: toolCall.toolCallId,
        output: error ? { output, error } : { output },
      });
    },
  });

  const streaming = status === "streaming" || status === "submitted";
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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
      projectId,
      messages,
      updatedAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, streaming]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const needsSearch = !!mode.research && !hasSearchKey;
  const usable = !!findModel(
    isAuto(model) ? getState().autoPicks?.everyday : model,
  );
  const canSend = usable && !needsSearch;

  const [attachments, setAttachments] = useState<Attachment[]>(() =>
    chat.messages.length
      ? []
      : (initialFiles ?? []).map((part) => ({
          kind: "file" as const,
          part,
          size: part.url.length,
        })),
  );
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const bad = list.filter((f) => !isSupported(f));
    if (bad.length)
      toast.error(
        `Can't attach ${bad.map((f) => f.name).join(", ")}. Images, PDFs and text or code files work.`,
      );
    const read = await Promise.all(
      list.filter(isSupported).map(readAttachment),
    );
    setAttachments((prev) => {
      const next = [...prev, ...read];
      if (next.reduce((n, a) => n + a.size, 0) > MAX_TOTAL_BYTES) {
        toast.error(
          "Attachments are limited to 3 MB per message for now. Remove a file or use a smaller one.",
        );
        return prev;
      }
      return next;
    });
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && attachments.length === 0) || streaming || !canSend) return;
    googleTokenRef.current = await googleToken();
    accountsRef.current = {
      spotify: await oauthToken("spotify"),
      slack: await oauthToken("slack"),
      discord: await oauthToken("discord"),
      x: getState().xToken?.enabled ? getState().xToken?.token : undefined,
    };
    await refreshMcpTokens();
    // Computer use: the person at the PC must approve each session in a native dialog first.
    if (
      computerOn &&
      !(await desktop()!.computer.status()).active &&
      !(await desktop()!.computer.start(text))
    ) {
      toast("Computer use wasn't allowed, so the AI won't control this PC.");
      setComputerOn(false);
      return;
    }
    clearError();
    const files = attachments.flatMap((a) =>
      a.kind === "file" ? [a.part] : [],
    );
    sendMessage(
      { text: composeText(expandCommand(text), attachments), files },
      request(),
    );
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
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDragging(false);
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
              <h2 className="text-2xl font-semibold tracking-tight">
                {mode.private ? "Private chat" : userName ? `What can I help with, ${userName}?` : "What can I help with?"}
              </h2>
              {mode.private && (
                <p className="max-w-sm text-sm text-muted-foreground">
                  Nothing in this chat is saved. Close it or start a new chat
                  and it&apos;s gone.
                </p>
              )}
              {mode.research && (
                <p className="max-w-md text-sm text-muted-foreground">
                  Deep Research plans sub-questions, searches and reads many
                  sources, then writes a cited report. It can take a few minutes
                  and uses more tokens.
                </p>
              )}
              {!usable ? (
                <Button onClick={onOpenKeys}>
                  <KeyRound /> Connect a model
                </Button>
              ) : (
                needsSearch && (
                  <Button onClick={onOpenKeys}>
                    <KeyRound /> Add a web search key
                  </Button>
                )
              )}
            </div>
          )}
          {messages.map((m, i) => (
            <Message
              key={m.id}
              message={m}
              streaming={
                streaming && i === messages.length - 1 && m.role === "assistant"
              }
              isLast={i === lastAssistant && i === messages.length - 1}
              costLabel={m.role === "assistant" ? costLabel(m) : undefined}
              onEdit={(text) => {
                clearError();
                sendMessage(
                  {
                    text,
                    files: m.parts.filter((p) => p.type === "file"),
                    messageId: m.id,
                  },
                  request(),
                );
              }}
              onRegenerate={() => {
                clearError();
                regenerate(request());
              }}
              onOpenArtifact={onOpenArtifact}
              onApproval={(id, approved) =>
                addToolApprovalResponse({ id, approved })
              }
              onBranch={
                mode.private
                  ? undefined
                  : () => onBranch(messages.slice(0, i + 1))
              }
            />
          ))}
          {status === "submitted" && (
            <div
              className="size-2.5 animate-pulse rounded-full bg-primary"
              aria-label="Waiting for the model"
            />
          )}
          {error && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
            >
              <span className="flex-1">{friendly(error.message)}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  clearError();
                  regenerate(request());
                }}
              >
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
                <li
                  key={i}
                  className="flex items-center gap-1.5 rounded-lg border bg-background py-1 pr-1 pl-2 text-xs"
                >
                  {a.kind === "file" &&
                  a.part.mediaType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.part.url}
                      alt=""
                      className="size-6 rounded object-cover"
                    />
                  ) : (
                    <FileText className="size-4" />
                  )}
                  <span className="max-w-40 truncate">
                    {a.kind === "file" ? a.part.filename : a.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${a.kind === "file" ? a.part.filename : a.name}`}
                    onClick={() =>
                      setAttachments((p) => p.filter((_, j) => j !== i))
                    }
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              aria-label="Message"
              placeholder={
                canSend
                  ? "Message MoonlightC…"
                  : needsSearch
                    ? "Add a web search key to use Deep Research"
                    : "Connect a model to start chatting"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={(e) => {
                if (e.clipboardData.files.length) {
                  e.preventDefault();
                  addFiles(e.clipboardData.files);
                }
              }}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                )
                  submit(e);
              }}
              rows={1}
              className={`max-h-60 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent ${bigInput ? "min-h-32 text-lg md:text-lg" : "min-h-10"}`}
            />
            {streaming ? (
              <Button
                type="button"
                size="icon-lg"
                aria-label="Stop generating"
                onClick={() => stop()}
              >
                <Square className="fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon-lg"
                aria-label="Send message"
                disabled={
                  (!input.trim() && attachments.length === 0) || !canSend
                }
              >
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
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Attach files"
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip />
            </Button>
            <MicButton onText={(t) => setInput((v) => (v ? `${v} ${t}` : t))} />
            <WebToggle />
            {desktop() && (
              <Button
                type="button"
                variant={computerOn ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={computerOn}
                title="Let the AI see and control this PC (you'll be asked first)"
                onClick={() => setComputerOn((v) => !v)}
              >
                <MousePointerClick /> Use this PC
              </Button>
            )}
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
      title={
        hasSearch
          ? "Let the AI search the web, read links and run Python"
          : "Let the AI read links and run Python (add a search key in Models and keys to search the web too)"
      }
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
