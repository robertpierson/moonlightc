"use client";

import type { UIMessage, UIMessageChunk } from "ai";
import { desktop } from "./desktop";
import { getState, updateNow } from "./store";

// Desktop app: the Claude Code CLI installed and signed in on this PC, offered as models in Chat, Cowork and Code.
// It answers on its own (MoonlightC's tools, artifacts and connectors don't run for it). Never synced.

export const CLAUDE_CODE = "claude-code";
export const CLAUDE_CODE_MODELS = [
  { id: "claude-opus-5-5", name: "Opus 5.5" },
  { id: "claude-sonnet-5-5", name: "Sonnet 5.5" },
  { id: "claude-haiku-5-5", name: "Haiku 5.5" },
];

/** Show Claude Code in the model menu when it's installed on this PC (and remove it when it isn't). */
export async function syncClaudeCode() {
  const b = desktop();
  if (!b) return;
  const { installed } = await b.claude.status();
  const has = getState().connections.some((c) => c.id === CLAUDE_CODE);
  if (installed === has) return;
  updateNow((s) => {
    const others = s.connections.filter((c) => c.id !== CLAUDE_CODE);
    return installed ? { ...s, connections: [...others, { id: CLAUDE_CODE, providerId: CLAUDE_CODE, label: "Claude Code (your plan)", apiKey: "", models: CLAUDE_CODE_MODELS, addedAt: Date.now() }] } : { ...s, connections: others };
  });
}

const KEY = "moonc:claude-code-sessions";
export const sessions = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
};
export const remember = (chat: string, sid: string) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...sessions(), [chat]: sid }));
  } catch {}
};

export const friendly = (msg = "") =>
  /authenticat|log ?in|expired/i.test(msg)
    ? "Claude Code needs you to sign in again: in Code > Terminal type claude, press Enter, then type /login."
    : /usage credits/i.test(msg)
      ? "That model needs extra usage credits on your Claude plan. Pick Sonnet 5.5 or Haiku 5.5."
      : msg || "Claude Code stopped.";

const textOf = (m: UIMessage) => m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n");

/** What to send: the new message, or (for a new Claude Code session in an ongoing chat) the conversation so far. */
export function claudePrompt(messages: UIMessage[], sid?: string) {
  const lastAt = messages.findLastIndex((m) => m.role === "user");
  const last = textOf(messages[lastAt]);
  const earlier = messages.slice(0, lastAt).filter((m) => textOf(m).trim());
  return sid || !earlier.length ? last : `Earlier in this conversation:\n\n${earlier.map((m) => `${m.role === "user" ? "Me" : "You"}: ${textOf(m)}`).join("\n\n")}\n\nNow: ${last}`;
}

/** A reply from Claude Code, in the AI SDK's chat format. Each MoonlightC chat keeps its own Claude Code session. */
type Block = { type: string; text?: string; name?: string; input?: Record<string, unknown> };
const VERB: Record<string, string> = { Bash: "Ran", Edit: "Edited", MultiEdit: "Edited", Write: "Wrote", Read: "Read", Glob: "Looked for", Grep: "Searched for", WebFetch: "Opened", WebSearch: "Searched the web for", NotebookEdit: "Edited", Task: "Started a helper for", TodoWrite: "Updated its to-do list" };
/** What Claude Code said and did, as text: its words, plus one short line per step (ran a command, edited a file...). */
export function claudeText(content: Block[] = []) {
  return content
    .flatMap((c) => {
      if (c.type === "text" && c.text) return [c.text];
      if (c.type !== "tool_use" || !c.name) return [];
      const i = c.input ?? {};
      const what = String(i.command ?? i.file_path ?? i.notebook_path ?? i.pattern ?? i.url ?? i.query ?? i.description ?? "").split("\n")[0].slice(0, 160);
      const verb = VERB[c.name] ?? `Used ${c.name}`;
      return [what ? `*${verb}* \`${what.replace(/`/g, "'")}\`` : `*${verb}*`];
    })
    .join("\n\n");
}

export function claudeCodeStream(model: string, messages: UIMessage[], chatId: string, signal?: AbortSignal, effort?: string): ReadableStream<UIMessageChunk> {
  const b = desktop()!;
  return new ReadableStream<UIMessageChunk>({
    start(ctl) {
      const id = crypto.randomUUID();
      const tid = `cc-${id}`;
      const sid = sessions()[chatId];
      const prompt = claudePrompt(messages, sid);
      let done = false;
      let wrote = false;
      ctl.enqueue({ type: "start" });
      ctl.enqueue({ type: "text-start", id: tid });
      const finish = () => {
        if (done) return;
        done = true;
        off();
        ctl.enqueue({ type: "text-end", id: tid });
        ctl.enqueue({ type: "finish" });
        ctl.close();
      };
      const off = b.claude.onEvent((rid, raw) => {
        if (rid !== id || done) return;
        let e: { type?: string; subtype?: string; is_error?: boolean; session_id?: string; result?: string; message?: { content?: Block[] } };
        try {
          e = JSON.parse(raw);
        } catch {
          return;
        }
        if (e.session_id) remember(chatId, e.session_id);
        const said = e.type === "assistant" ? claudeText(e.message?.content) : "";
        if (said) {
          ctl.enqueue({ type: "text-delta", id: tid, delta: (wrote ? "\n\n" : "") + said });
          wrote = true;
        }
        if (e.type === "result") {
          if (e.is_error || e.subtype !== "success") ctl.enqueue({ type: "error", errorText: friendly(e.result) });
          finish();
        }
        if (e.type === "exit") finish();
      });
      signal?.addEventListener("abort", () => {
        b.claude.stop(id);
        finish();
      });
      b.claude.run(id, prompt, sid, model, effort, getState().codePermission ?? "auto");
    },
  });
}
