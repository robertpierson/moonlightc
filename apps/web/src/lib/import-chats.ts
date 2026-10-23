import type { UIMessage } from "ai";
import { unzipSync, strFromU8 } from "fflate";
import type { Chat } from "./store";

// Chats from ChatGPT or Claude data exports (Settings > Data controls > Export, in either app). Read in the browser;
// nothing is uploaded. Re-importing the same export doesn't make duplicates (each chat keeps its original id).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idFor = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v.toLowerCase() : crypto.randomUUID());
const msg = (role: "user" | "assistant", text: string, i: number, chat: string): UIMessage => ({ id: `${chat}-${i}`, role, parts: [{ type: "text", text }] });
const time = (v: unknown) => (typeof v === "number" ? (v < 1e12 ? v * 1000 : v) : typeof v === "string" ? Date.parse(v) || Date.now() : Date.now());

type GptNode = { message?: { author?: { role?: string }; content?: { parts?: unknown[] } } | null; parent?: string | null };
type GptChat = { id?: string; conversation_id?: string; title?: string; update_time?: number; create_time?: number; mapping?: Record<string, GptNode>; current_node?: string };
type ClaudeChat = { uuid?: string; name?: string; updated_at?: string; created_at?: string; chat_messages?: { sender?: string; text?: string; content?: { type?: string; text?: string }[] }[] };

function fromChatGpt(c: GptChat): Chat | undefined {
  if (!c.mapping) return undefined;
  const id = idFor(c.conversation_id ?? c.id);
  // The conversation as you last saw it: from the current message back to the start.
  const path: GptNode[] = [];
  let at = c.current_node ?? Object.keys(c.mapping).at(-1);
  for (let guard = 0; at && c.mapping[at] && guard < 20_000; guard++) {
    path.unshift(c.mapping[at]);
    at = c.mapping[at].parent ?? undefined;
  }
  const messages = path.flatMap((n, i) => {
    const role = n.message?.author?.role;
    if (role !== "user" && role !== "assistant") return [];
    const text = (n.message?.content?.parts ?? []).filter((p): p is string => typeof p === "string").join("\n").trim();
    return text ? [msg(role, text, i, id)] : [];
  });
  return messages.length ? { id, title: (c.title || "Imported chat").slice(0, 200), messages, updatedAt: time(c.update_time ?? c.create_time), titled: true } : undefined;
}

function fromClaude(c: ClaudeChat): Chat | undefined {
  if (!Array.isArray(c.chat_messages)) return undefined;
  const id = idFor(c.uuid);
  const messages = c.chat_messages.flatMap((m, i) => {
    const role = m.sender === "human" ? "user" : m.sender === "assistant" ? "assistant" : undefined;
    const text = (m.text || (m.content ?? []).filter((p) => p.type === "text").map((p) => p.text ?? "").join("\n")).trim();
    return role && text ? [msg(role, text, i, id)] : [];
  });
  return messages.length ? { id, title: (c.name || "Imported chat").slice(0, 200), messages, updatedAt: time(c.updated_at ?? c.created_at), titled: true } : undefined;
}

/** Chats in an export's conversations.json (ChatGPT or Claude). */
export function parseExport(json: unknown): { from: "ChatGPT" | "Claude"; chats: Chat[] } {
  const list = Array.isArray(json) ? json : [];
  const claude = list.some((c) => c && typeof c === "object" && "chat_messages" in c);
  const chats = list.flatMap((c) => (c && typeof c === "object" ? [claude ? fromClaude(c as ClaudeChat) : fromChatGpt(c as GptChat)] : [])).filter((c): c is Chat => !!c);
  return { from: claude ? "Claude" : "ChatGPT", chats };
}

/** The export as you downloaded it: the .zip, or conversations.json taken out of it. */
export async function readExport(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const files = unzipSync(bytes, { filter: (f) => /(^|\/)conversations\.json$/.test(f.name) });
    const name = Object.keys(files)[0];
    if (!name) throw new Error("This zip has no conversations.json. Use the export from ChatGPT or Claude.");
    return parseExport(JSON.parse(strFromU8(files[name])));
  }
  return parseExport(JSON.parse(strFromU8(bytes)));
}
