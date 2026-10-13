"use client";

import { useSyncExternalStore } from "react";
import { getState, subscribe, update } from "./store";
import { supabase } from "./supabase/client";
import { emptyMeta, syncOnce, type RemoteChat, type RemoteConnection, type SyncBackend } from "./sync";

// The real backend for sync: the Supabase tables from supabase/migrations, protected by row-level security.

function backend(userId: string): SyncBackend {
  const sb = supabase();
  const check = <T,>(r: { data: T; error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };
  return {
    async pullChats(since) {
      let q = sb.from("chats").select("id, title, model, mode_id, pinned, project_id, workspace, updated_at, deleted_at, messages(id, position, role, parts, metadata)");
      if (since) q = q.gt("updated_at", since);
      return check(await q.order("updated_at", { ascending: true }).limit(500)) as unknown as RemoteChat[];
    },
    async pushChat(c) {
      const { messages = [], ...row } = c;
      check(await sb.from("chats").upsert({ ...row, user_id: userId }));
      check(await sb.from("messages").delete().eq("chat_id", c.id));
      if (messages.length) check(await sb.from("messages").insert(messages.map((m) => ({ ...m, chat_id: c.id, user_id: userId }))));
    },
    async deleteChat(id, at) {
      check(await sb.from("messages").delete().eq("chat_id", id));
      check(await sb.from("chats").update({ deleted_at: at, updated_at: at }).eq("id", id));
    },
    async pullSettings() {
      return check(await sb.from("user_settings").select("data, updated_at").eq("user_id", userId).maybeSingle());
    },
    async pushSettings(data, at) {
      check(await sb.from("user_settings").upsert({ user_id: userId, data, updated_at: at }));
    },
    async listConnections() {
      return (check(await sb.from("connections").select("id, provider_id, label, base_url, models, extra")) ?? []) as RemoteConnection[];
    },
    async pushConnection(c, apiKey) {
      check(await sb.from("connections").insert({ ...c, user_id: userId }));
      if (apiKey) check(await sb.rpc("set_connection_key", { connection: c.id, api_key: apiKey }));
    },
    async deleteConnection(id) {
      check(await sb.from("connections").delete().eq("id", id));
    },
    async getKey(id) {
      return check(await sb.rpc("get_my_connection_key", { connection: id })) as string | null;
    },
  };
}

// Sync status for the Account page.
let status: { at?: number; error?: string; running: boolean } = { running: false };
const subs = new Set<() => void>();
const setStatus = (s: Partial<typeof status>) => {
  status = { ...status, ...s };
  subs.forEach((f) => f());
};
export const useSyncStatus = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => status,
    () => status,
  );

let runNow: (() => Promise<void>) | undefined;
export const syncNow = () => runNow?.();

/** Runs sync for this signed-in person until they sign out. Returns a stop function. */
export function startSync(userId: string) {
  const key = `moonc:sync:${userId}`;
  let meta = (() => {
    try {
      return { ...emptyMeta(), ...JSON.parse(localStorage.getItem(key) ?? "{}") };
    } catch {
      return emptyMeta();
    }
  })();
  const b = backend(userId);
  let busy = false;
  let again = false;
  const run = async () => {
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    setStatus({ running: true });
    try {
      meta = await syncOnce(b, getState, update, meta);
      localStorage.setItem(key, JSON.stringify(meta));
      setStatus({ at: Date.now(), error: undefined });
    } catch (e) {
      setStatus({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      busy = false;
      setStatus({ running: false });
      if (again) {
        again = false;
        timer = setTimeout(run, 1500);
      }
    }
  };
  runNow = run;
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(run, 300);
  const unsub = subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(run, 2500);
  });
  const every = setInterval(run, 60_000);
  const onFocus = () => run();
  addEventListener("focus", onFocus);
  return () => {
    clearTimeout(timer);
    clearInterval(every);
    unsub();
    removeEventListener("focus", onFocus);
    runNow = undefined;
  };
}
