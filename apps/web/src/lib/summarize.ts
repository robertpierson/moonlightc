import { isAuto, resolveAuto } from "./auto-model";
import { freePool, isFree } from "./free-models";
import { findModel, getState, type Chat } from "./store";

const textOf = (m: Chat["messages"][number]) => m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n");
/** The chat as plain text ("You: … / Assistant: …"), for copying and summarizing. */
export const chatText = (c: Chat) =>
  c.messages
    .map((m) => `${m.role === "user" ? "You" : "Assistant"}: ${textOf(m)}`)
    .filter((l) => !/: $/.test(l))
    .join("\n\n");

/** A title or a summary of a chat, written by the chat's own model (or your default one). */
export async function summarize(chat: Chat, kind: "title" | "summary" | "image-prompt" | "video-prompt" | "answer"): Promise<string> {
  const ref = isFree(chat.model)
    ? freePool(getState().connections, getState().freePicks)[0]
    : chat.model && !isAuto(chat.model) ? chat.model : isAuto(chat.model) ? resolveAuto("everyday", getState().autoPicks) : getState().lastModel;
  const found = findModel(isAuto(ref) ? undefined : ref);
  if (!found || found.conn.providerId === "home-pc") throw new Error("Pick a model first.");
  const { apiKey, providerId, baseURL } = found.conn;
  const res = await fetch("/api/summarize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ connection: { apiKey, providerId, baseURL }, modelId: found.model.id, kind, text: kind === "title" ? chatText(chat).slice(0, 4000) : kind.endsWith("-prompt") || kind === "answer" ? textOf(chat.messages[0]) : chatText(chat) }),
  });
  const d = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok || !d.text) throw new Error(d.error ?? "Couldn't summarize this chat.");
  return kind === "title" ? d.text.replace(/^["'#\s]+|["'.\s]+$/g, "").slice(0, 60) : d.text;
}

/** Studio's "Improve prompt": your idea rewritten as a detailed image or video prompt by your default chat model. */
export const improvePrompt = (idea: string, kind: "image" | "video") =>
  summarize(
    { id: "prompt", title: "", updatedAt: 0, model: getState().lastModel, messages: [{ id: "p", role: "user", parts: [{ type: "text", text: idea }] }] } as Chat,
    kind === "video" ? "video-prompt" : "image-prompt",
  );

/** "Ask AI" in a friend chat: your own default model answers the last question, given the recent messages. */
export const askInChat = (recent: string) =>
  summarize({ id: "dm", title: "", updatedAt: 0, model: getState().lastModel, messages: [{ id: "q", role: "user", parts: [{ type: "text", text: recent.slice(-6000) }] }] } as Chat, "answer");
