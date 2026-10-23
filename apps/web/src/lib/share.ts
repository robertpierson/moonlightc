"use client";

import { desktop } from "./desktop";
import type { Chat } from "./store";
import { supabase } from "./supabase/client";

const SITE = "https://moonlightc.vercel.app";

/** A read-only copy of a chat's text (no files) at a link anyone can open. Returns the link. */
export async function shareChat(c: Chat): Promise<string> {
  const sb = supabase();
  if (!(await sb.auth.getUser()).data.user) throw new Error("Sign in to share chats.");
  const id = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const messages = c.messages.flatMap((m) => {
    const text = m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n").trim();
    return (m.role === "user" || m.role === "assistant") && text ? [{ role: m.role, text }] : [];
  });
  if (!messages.length) throw new Error("There's nothing to share in this chat yet.");
  const { error } = await sb.from("shared_chats").insert({ id, title: c.title.slice(0, 200) || "Chat", messages });
  if (error) throw new Error(/check/i.test(error.message) ? "This chat is too long to share." : error.message);
  return `${desktop() ? SITE : location.origin}/share/${id}`;
}

export type SharedLink = { id: string; title: string; created_at: string };
export const sharedLinks = async () => ((await supabase().from("shared_chats").select("id, title, created_at").order("created_at", { ascending: false })).data ?? []) as SharedLink[];
export const unshare = async (id: string) => void (await supabase().from("shared_chats").delete().eq("id", id));
export const shareUrl = (id: string) => `${desktop() ? SITE : location.origin}/share/${id}`;
