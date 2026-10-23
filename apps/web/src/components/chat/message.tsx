"use client";

import type { UIMessage } from "ai";
import { AppWindow, Brain, Check, MousePointerClick, Copy, FileText, GitBranch, Link2, Loader2, Globe, Plug, Puzzle, Search, Terminal, Pencil, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { utterance } from "@/lib/voice";
import { Textarea } from "@/components/ui/textarea";
import { extractArtifacts, type Artifact } from "@/lib/artifacts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// The markdown renderer (code highlighting, math, diagrams) is large, so it loads only once there is an answer to show.
const Markdown = dynamic(() => import("./markdown"), { ssr: false, loading: () => <div className="h-5" /> });

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
}

export const textOf = (m: UIMessage) =>
  m.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n\n");

function Action({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const FILE_BLOCK = /<file name="([^"]*)">\n[\s\S]*?\n<\/file>\n\n/g;

/** Split a user message into inlined text files and what the user actually typed. */
function splitFiles(text: string) {
  const names = [...text.matchAll(FILE_BLOCK)].map((m) => m[1]);
  const blocks = (text.match(FILE_BLOCK) ?? []).join("");
  return { names, blocks, typed: text.replace(FILE_BLOCK, "") };
}

interface ToolPart {
  type: "tool-web_search" | "tool-fetch_url";
  state: string;
  input?: { query?: string; url?: string };
  output?: { results?: { title: string; url: string }[]; title?: string; url?: string };
  errorText?: string;
}

function ToolCall({ part }: { part: ToolPart }) {
  const search = part.type === "tool-web_search";
  const label = search ? `Searched the web: ${part.input?.query ?? "…"}` : `Read ${part.output?.title ?? part.input?.url ?? "a page"}`;
  if (part.state === "output-error") {
    return <p className="mb-2 text-sm text-destructive">{search ? "Web search" : "Reading the page"} failed: {part.errorText}</p>;
  }
  const done = part.state === "output-available";
  return (
    <details className="mb-2 text-sm text-muted-foreground">
      <summary className="cursor-pointer select-none">
        {done ? (search ? <Search className="mr-1 inline size-3.5" /> : <Link2 className="mr-1 inline size-3.5" />) : <Loader2 className="mr-1 inline size-3.5 animate-spin" />}
        {label}
      </summary>
      <ul className="mt-1 grid gap-1 border-l-2 pl-3">
        {(search ? (part.output?.results ?? []) : part.output?.url ? [{ title: part.output.title ?? part.output.url, url: part.output.url }] : []).map((r, i) => (
          <li key={i} className="truncate">
            <a href={r.url} target="_blank" rel="noreferrer" className="text-link underline underline-offset-4">
              {r.title || r.url}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

function describeComputer(i?: Record<string, unknown>) {
  if (!i) return "Using the computer…";
  if (i.action === "type") return `Typed ${String(i.text ?? "").length} characters`;
  if (i.action === "key") return `Pressed ${String(i.keys)}`;
  if (i.action === "screenshot") return "Looked at the screen";
  if (typeof i.x === "number") return `${String(i.action).replace("_", " ")} at ${Math.round(i.x)}, ${Math.round(Number(i.y))}`;
  return String(i.action);
}

interface ConnectorPart {
  toolName: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  approval?: { id: string; approved?: boolean; isAutomatic?: boolean };
}

function ConnectorCall({ part, onApproval }: { part: ConnectorPart; onApproval?: (id: string, approved: boolean) => void }) {
  const [server, tool] = part.toolName.includes("__") ? part.toolName.replace(/^mod_/, "").split("__") : ["", part.toolName];
  const label = `${tool.replace(/_/g, " ")}${server ? ` (${server.replace(/_/g, " ")})` : ""}`;
  if (part.state === "approval-requested" && !part.approval?.isAutomatic) {
    return (
      <div role="group" aria-label={`Approve ${label}`} className="mb-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
        <p className="font-medium">Allow the AI to use {label}?</p>
        <pre className="mt-1 max-h-40 overflow-auto font-mono text-xs whitespace-pre-wrap text-muted-foreground">{JSON.stringify(part.input, null, 2)}</pre>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={() => onApproval?.(part.approval!.id, true)}>
            Allow once
          </Button>
          <Button size="sm" variant="outline" onClick={() => onApproval?.(part.approval!.id, false)}>
            Deny
          </Button>
        </div>
      </div>
    );
  }
  const denied = part.state === "output-denied" || part.approval?.approved === false;
  const done = part.state === "output-available" || part.state === "output-error" || denied;
  return (
    <details className="mb-2 text-sm text-muted-foreground">
      <summary className="cursor-pointer select-none">
        {done ? <Plug className="mr-1 inline size-3.5" /> : <Loader2 className="mr-1 inline size-3.5 animate-spin" />}
        {denied ? `Denied: ${label}` : part.state === "output-error" ? `${label} failed` : `Used ${label}`}
      </summary>
      <pre className="mt-1 max-h-60 overflow-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
        {part.errorText ?? JSON.stringify(part.output ?? part.input, null, 2)?.slice(0, 4000)}
      </pre>
    </details>
  );
}

interface PyPart {
  state: string;
  input?: { code?: string };
  output?: { output?: string; error?: string };
  errorText?: string;
}

function PythonCall({ part }: { part: PyPart }) {
  const done = part.state === "output-available" || part.state === "output-error";
  const failed = part.state === "output-error" || !!part.output?.error;
  return (
    <details className="mb-2 text-sm text-muted-foreground">
      <summary className="cursor-pointer select-none">
        {done ? <Terminal className="mr-1 inline size-3.5" /> : <Loader2 className="mr-1 inline size-3.5 animate-spin" />}
        {done ? (failed ? "Ran Python (error)" : "Ran Python") : "Running Python in your browser…"}
      </summary>
      <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-2 font-mono text-xs">{part.input?.code}</pre>
      {done && (
        <pre className="mt-1 overflow-x-auto rounded-md border p-2 font-mono text-xs whitespace-pre-wrap">
          {part.output?.output}
          {part.output?.error ?? part.errorText}
        </pre>
      )}
    </details>
  );
}

function describeBrowser(action: string, input: Record<string, unknown> = {}) {
  const what = String(input.text ?? input.ref ?? "");
  if (action === "tabs") return "Checked your shared tabs";
  if (action === "read") return "Read a shared tab";
  if (action === "click") return `Clicked ${what ? `"${what}"` : "in a shared tab"}`;
  if (action === "type") return `Typed into ${what ? `"${what}"` : "a field"}`;
  if (action === "open") return `Opened ${String(input.url ?? "a page")}`;
  return "Used a shared tab";
}

export function Message({
  message,
  streaming,
  isLast,
  costLabel,
  onEdit,
  onRegenerate,
  onBranch,
  onOpenArtifact,
  onApproval,
}: {
  message: UIMessage;
  streaming: boolean;
  isLast: boolean;
  costLabel?: string;
  onEdit?: (text: string) => void;
  onRegenerate?: () => void;
  onBranch?: () => void;
  onOpenArtifact?: (a: Artifact) => void;
  onApproval?: (id: string, approved: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const text = textOf(message);
  const isUser = message.role === "user";
  const { names, blocks, typed } = isUser ? splitFiles(text) : { names: [], blocks: "", typed: text };
  const fileParts = message.parts.filter((p) => p.type === "file");

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const speak = () => {
    if (speaking) {
      speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = utterance(text);
    u.onend = u.onerror = () => setSpeaking(false);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    setSpeaking(true);
  };

  if (editing) {
    return (
      <div className="ml-auto grid w-full max-w-[85%] gap-2">
        <Textarea aria-label="Edit message" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-24" />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button
            disabled={!draft.trim()}
            onClick={() => {
              setEditing(false);
              onEdit?.(blocks + draft.trim());
            }}
          >
            Send
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`} data-role={message.role}>
      <div className={isUser ? "max-w-[85%] rounded-2xl bg-secondary px-4 py-2.5 whitespace-pre-wrap" : "w-full min-w-0"}>
        {isUser ? (
          <>
            {(fileParts.length > 0 || names.length > 0) && (
              <div className="mb-2 flex flex-wrap gap-2">
                {fileParts.map((f, i) =>
                  f.mediaType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={f.url} alt={f.filename ?? "Attached image"} className="max-h-48 rounded-lg" />
                  ) : (
                    <span key={i} className="inline-flex items-center gap-1 rounded-md bg-background/60 px-2 py-1 text-xs">
                      <FileText className="size-3.5" /> {f.filename ?? "PDF"}
                    </span>
                  ),
                )}
                {names.map((n, i) => (
                  <span key={`t${i}`} className="inline-flex items-center gap-1 rounded-md bg-background/60 px-2 py-1 text-xs">
                    <FileText className="size-3.5" /> {n}
                  </span>
                ))}
              </div>
            )}
            {typed}
          </>
        ) : (
          <>
            {message.parts.map((p, i) =>
              p.type === "reasoning" && p.text ? (
                <details key={i} className="mb-2 text-sm text-muted-foreground">
                  <summary className="cursor-pointer select-none">Thinking</summary>
                  <div className="mt-1 border-l-2 pl-3 whitespace-pre-wrap">{p.text}</div>
                </details>
              ) : p.type === "tool-run_python" ? (
                <PythonCall key={i} part={p as unknown as PyPart} />
              ) : p.type === "tool-web_search" || p.type === "tool-fetch_url" ? (
                <ToolCall key={i} part={p as unknown as ToolPart} />
              ) : p.type === "tool-computer" ? (
                <p key={i} className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MousePointerClick className="size-3.5" /> {describeComputer((p as unknown as { input?: Record<string, unknown> }).input)}
                </p>
              ) : p.type.startsWith("tool-browser_") ? (
                <p key={i} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
                  <Globe className="size-3.5" /> {describeBrowser(p.type.slice(13), (p as unknown as { input?: Record<string, unknown> }).input)}
                </p>
              ) : p.type === "tool-load_skill" ? (
                <p key={i} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
                  <Puzzle className="size-3.5" /> Using skill {String((p as unknown as { input?: { name?: string } }).input?.name ?? "")}
                </p>
              ) : p.type === "tool-save_memory" ? (
                <p key={i} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
                  <Brain className="size-3.5" /> Remembered: {String((p as unknown as { input?: { fact?: string } }).input?.fact ?? "")}
                </p>
              ) : /^tool-(gmail|calendar|drive|youtube|spotify|slack|discord|x)_/.test(p.type) ? (
                <ConnectorCall key={i} part={{ ...(p as unknown as ConnectorPart), toolName: `${/^tool-(spotify|slack|discord|x)_/.exec(p.type)?.[1] ?? "google"}__${p.type.slice(5)}` }} onApproval={onApproval} />
              ) : p.type.startsWith("tool-files_") ? (
                <ConnectorCall key={i} part={{ ...(p as unknown as ConnectorPart), toolName: `your_files__${p.type.slice(11)}` }} onApproval={onApproval} />
              ) : p.type.startsWith("tool-mod_") ? (
                <ConnectorCall key={i} part={{ ...(p as unknown as ConnectorPart), toolName: p.type.slice(5) }} onApproval={onApproval} />
              ) : p.type === "dynamic-tool" ? (
                <ConnectorCall key={i} part={p as unknown as ConnectorPart} onApproval={onApproval} />
              ) : p.type === "text" ? (
                <Markdown key={i} text={p.text} streaming={streaming} />
              ) : null,
            )}
          </>
        )}
      </div>
      {!isUser &&
        (message.metadata as { connectorErrors?: string[] } | undefined)?.connectorErrors?.map((e) => (
          <p key={e} className="text-xs text-amber-700 dark:text-amber-300">
            Connector unavailable: {e}
          </p>
        ))}
      {!streaming && !isUser && onOpenArtifact && (
        <div className="flex flex-wrap gap-2">
          {extractArtifacts(text).map((a, i) => (
            <Button key={i} variant="outline" size="sm" onClick={() => onOpenArtifact(a)}>
              <AppWindow /> Open {a.title}
            </Button>
          ))}
        </div>
      )}
      {!streaming && text && (
        <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <Action label={copied ? "Copied" : "Copy"} onClick={copy}>
            {copied ? <Check /> : <Copy />}
          </Action>
          {isUser ? (
            onEdit && <Action
              label="Edit and resend"
              onClick={() => {
                setDraft(typed);
                setEditing(true);
              }}
            >
              <Pencil />
            </Action>
          ) : (
            <>
              <Action label={speaking ? "Stop reading" : "Read aloud"} onClick={speak}>
                {speaking ? <VolumeX /> : <Volume2 />}
              </Action>
              {isLast && onRegenerate && (
                <Action label="Regenerate" onClick={onRegenerate}>
                  <RotateCcw />
                </Action>
              )}
            </>
          )}
          {onBranch && (
            <Action label="Branch into a new chat from here" onClick={onBranch}>
              <GitBranch />
            </Action>
          )}
          {costLabel && <span className="px-1 text-xs text-muted-foreground">{costLabel}</span>}
        </div>
      )}
    </div>
  );
}
