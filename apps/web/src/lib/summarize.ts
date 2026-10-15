import { isAuto, resolveAuto } from "./auto-model";
import { findModel, getState, type Chat } from "./store";

const textOf = (m: Chat["messages"][number]) => m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n");
/** The chat as plain text ("You: … / Assistant: …"), for copying and summarizing. */
export const chatText = (c: Chat) =>
  c.messages
    .map((m) => `${m.role === "user" ? "You" : "Assistant"}: ${textOf(m)}`)
    .filter((l) => !/: $/.test(l))
    .join("\n\n");

/** A title or a summary of a chat, written by the chat's own model (or your default one). */
export async function summarize(chat: Chat, kind: "title" | "summary"): Promise<string> {
  const ref = chat.model && !isAuto(chat.model) ? chat.model : isAuto(chat.model) ? resolveAuto("everyday", getState().autoPicks) : getState().lastModel;
  const found = findModel(isAuto(ref) ? undefined : ref);
  if (!found || found.conn.providerId === "home-pc") throw new Error("Pick a model first.");
  const { apiKey, providerId, baseURL } = found.conn;
  const res = await fetch("/api/summarize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ connection: { apiKey, providerId, baseURL }, modelId: found.model.id, kind, text: kind === "title" ? chatText(chat).slice(0, 4000) : chatText(chat) }),
  });
  const d = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok || !d.text) throw new Error(d.error ?? "Couldn't summarize this chat.");
  return kind === "title" ? d.text.replace(/^["'#\s]+|["'.\s]+$/g, "").slice(0, 60) : d.text;
}
