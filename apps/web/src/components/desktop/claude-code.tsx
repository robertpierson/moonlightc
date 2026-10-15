"use client";

import { ArrowUp, Loader2, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { desktop } from "@/lib/desktop";

type Line = { role: "you" | "claude" | "note"; text: string };

/** Desktop app: chat with the Claude Code CLI installed and signed in on this PC (your own login, your own use). */
export function ClaudeCode() {
  const b = desktop()!;
  const [status, setStatus] = useState<{ installed: boolean; version?: string }>();
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [run, setRun] = useState<string>();
  const session = useRef<string | undefined>(undefined);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    b.claude.status().then(setStatus);
    return b.claude.onEvent((id, raw) => {
      let e: { type?: string; subtype?: string; is_error?: boolean; session_id?: string; message?: { content?: { type: string; text?: string; name?: string }[] }; result?: string; text?: string; code?: number };
      try {
        e = JSON.parse(raw);
      } catch {
        return;
      }
      if (e.session_id) session.current = e.session_id;
      const add = (l: Line) => setLines((x) => [...x, l]);
      if (e.type === "assistant")
        for (const c of e.message?.content ?? []) {
          if (c.type === "text" && c.text) add({ role: "claude", text: c.text });
          if (c.type === "tool_use") add({ role: "note", text: `Using ${c.name}…` });
        }
      if (e.type === "result" && (e.is_error || e.subtype !== "success"))
        add({
          role: "note",
          text: /authenticat|log ?in|expired/i.test(e.result ?? "")
            ? "Claude Code needs you to sign in again: open Terminal (in this sidebar), type claude, press Enter, then type /login and follow the steps."
            : e.result || "Claude Code stopped.",
        });
      if (e.type === "stderr" && e.text) add({ role: "note", text: e.text });
      // A "result" ends the reply (helper processes can keep the CLI open a little longer).
      if (e.type === "result" || e.type === "exit") setRun((r) => (r === id ? undefined : r));
    });
  }, [b]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || run) return;
    const id = crypto.randomUUID();
    setLines((x) => [...x, { role: "you", text }]);
    setInput("");
    setRun(id);
    b.claude.run(id, text, session.current);
  };

  if (!status) return <Loader2 className="m-6 size-5 animate-spin" aria-label="Looking for Claude Code" />;
  if (!status.installed)
    return <p className="m-6 text-sm text-muted-foreground">Claude Code isn&apos;t installed on this PC. Install it from claude.com/code and sign in once in a terminal, then come back here.</p>;
  return (
    <section aria-label="Claude Code" className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-3xl gap-3 px-4 py-6 text-sm">
          <p className="text-xs text-muted-foreground">
            Claude Code {status.version} on this PC, with your own Claude login. It works in your home folder; it asks before changing files, so file edits and commands are skipped here.
          </p>
          {lines.map((l, i) =>
            l.role === "you" ? (
              <p key={i} className="justify-self-end rounded-2xl bg-muted px-3 py-2 whitespace-pre-wrap">
                {l.text}
              </p>
            ) : (
              <p key={i} className={`whitespace-pre-wrap ${l.role === "note" ? "text-xs text-muted-foreground" : ""}`}>
                {l.text}
              </p>
            ),
          )}
          {run && <Loader2 className="size-4 animate-spin" aria-label="Claude Code is working" />}
          <div ref={bottom} />
        </div>
      </div>
      <form onSubmit={send} className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 pb-4">
        <Textarea
          aria-label="Message Claude Code"
          placeholder="Ask Claude Code…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) send(e);
          }}
          className="max-h-48 min-h-11 resize-none"
        />
        {run ? (
          <Button type="button" size="icon-lg" aria-label="Stop" onClick={() => b.claude.stop(run)}>
            <Square className="fill-current" />
          </Button>
        ) : (
          <Button type="submit" size="icon-lg" aria-label="Send to Claude Code" disabled={!input.trim()}>
            <ArrowUp />
          </Button>
        )}
      </form>
    </section>
  );
}
