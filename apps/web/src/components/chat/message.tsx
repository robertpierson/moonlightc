"use client";

import { code } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import type { UIMessage } from "ai";
import { Check, Copy, FileText, GitBranch, Pencil, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import "katex/dist/katex.min.css";
import "streamdown/styles.css";

const plugins = { code, math: createMathPlugin({ singleDollarTextMath: true }), mermaid };

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

export function Message({
  message,
  streaming,
  isLast,
  costLabel,
  onEdit,
  onRegenerate,
  onBranch,
}: {
  message: UIMessage;
  streaming: boolean;
  isLast: boolean;
  costLabel?: string;
  onEdit: (text: string) => void;
  onRegenerate: () => void;
  onBranch?: () => void;
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
    const u = new SpeechSynthesisUtterance(text);
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
              onEdit(blocks + draft.trim());
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
              ) : p.type === "text" ? (
                <Streamdown key={i} plugins={plugins} isAnimating={streaming} className="min-w-0">
                  {p.text}
                </Streamdown>
              ) : null,
            )}
          </>
        )}
      </div>
      {!streaming && text && (
        <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <Action label={copied ? "Copied" : "Copy"} onClick={copy}>
            {copied ? <Check /> : <Copy />}
          </Action>
          {isUser ? (
            <Action
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
              {isLast && (
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
