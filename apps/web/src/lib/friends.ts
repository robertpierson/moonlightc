"use client";

// Friends and messages between them. Who can see and send what is decided by the database (see the community
// migration): only the two people see a conversation, only friends can message, and blocking stops both.
import { useCallback, useEffect, useState } from "react";
import { supabase, useUser } from "./supabase/client";

export type Friend = { id: string; username: string; display_name: string | null; status: "pending" | "accepted" | "blocked"; incoming: boolean };
export type Dm = { id: string; sender: string; recipient: string; body: string; kind: "text" | "ai"; created_at: string; read_at: string | null };

const plain = (e: { message: string } | null, fallback: string) => {
  if (!e) return;
  throw new Error(/^(No one|That's a lot|Slow down|Sign in)/.test(e.message) ? e.message : fallback);
};

export function useFriends() {
  const user = useUser();
  const [list, setList] = useState<Friend[]>();
  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase().rpc("my_friends");
    setList((data as Friend[]) ?? []);
  }, [user]);
  useEffect(() => {
    if (!user) return;
    void Promise.resolve().then(load);
    // New requests and answers show up without a refresh.
    const ch = supabase().channel(`friends:${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => load()).subscribe();
    const t = setInterval(load, 60_000);
    return () => {
      clearInterval(t);
      supabase().removeChannel(ch);
    };
  }, [user, load]);
  return { list: user === null ? [] : list, reload: load, me: user?.id };
}

export async function askFriend(username: string) {
  const u = username.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(u)) throw new Error("Usernames are 3 to 24 lowercase letters, numbers or underscores.");
  const { data, error } = await supabase().rpc("request_friend", { u });
  plain(error, "Couldn't send the request. Try again.");
  return data as "asked" | "friends";
}
export const answerFriend = async (id: string, accept: boolean) => plain((await supabase().rpc("answer_friend", { other: id, accept })).error, "Couldn't answer. Try again.");
export const removeFriend = async (id: string) => plain((await supabase().rpc("remove_friend", { other: id })).error, "Couldn't remove. Try again.");
export const blockPerson = async (id: string) => plain((await supabase().rpc("block_person", { other: id })).error, "Couldn't block. Try again.");

/** One conversation, live: the newest 200 messages, new ones as they arrive, marked read when you see them. */
export function useConversation(friendId: string | undefined) {
  const user = useUser();
  const [messages, setMessages] = useState<Dm[]>([]);
  useEffect(() => {
    // (The chat screen mounts one of these per friend, so there's nothing to clear.)
    if (!user || !friendId) return;
    let stop = false;
    const me = user.id;
    const markRead = () =>
      supabase()
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("sender", friendId)
        .eq("recipient", me)
        .is("read_at", null)
        .then(() => {});
    supabase()
      .from("direct_messages")
      .select("*")
      .or(`and(sender.eq.${me},recipient.eq.${friendId}),and(sender.eq.${friendId},recipient.eq.${me})`)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (stop) return;
        setMessages(((data as Dm[]) ?? []).reverse());
        markRead();
      });
    const ch = supabase()
      .channel(`dm:${me}:${friendId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient=eq.${me}` }, ({ new: m }) => {
        const d = m as Dm;
        if (d.sender !== friendId) return;
        setMessages((x) => (x.some((y) => y.id === d.id) ? x : [...x, d]));
        markRead();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "direct_messages" }, ({ old }) => setMessages((x) => x.filter((y) => y.id !== (old as Dm).id)))
      .subscribe();
    return () => {
      stop = true;
      supabase().removeChannel(ch);
    };
  }, [user, friendId]);

  const send = async (body: string, kind: Dm["kind"] = "text") => {
    if (!user || !friendId) return;
    const text = body.trim().slice(0, 4000);
    if (!text) return;
    const { data, error } = await supabase().from("direct_messages").insert({ recipient: friendId, body: text, kind }).select("*").single();
    plain(error, "Couldn't send. You can only message friends.");
    setMessages((x) => [...x, data as Dm]);
  };
  const unsend = async (id: string) => {
    plain((await supabase().from("direct_messages").delete().eq("id", id)).error, "Couldn't unsend.");
    setMessages((x) => x.filter((m) => m.id !== id));
  };
  return { messages, send, unsend, me: user?.id };
}

/** How many unread messages each friend sent you. */
export function useUnread() {
  const user = useUser();
  const [unread, setUnread] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!user) return;
    const load = () =>
      supabase()
        .from("direct_messages")
        .select("sender")
        .eq("recipient", user.id)
        .is("read_at", null)
        .limit(500)
        .then(({ data }) => {
          const n: Record<string, number> = {};
          for (const r of (data as { sender: string }[]) ?? []) n[r.sender] = (n[r.sender] ?? 0) + 1;
          setUnread(n);
        });
    load();
    const ch = supabase().channel(`unread:${user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "direct_messages", filter: `recipient=eq.${user.id}` }, load).subscribe();
    return () => void supabase().removeChannel(ch);
  }, [user]);
  return unread;
}
