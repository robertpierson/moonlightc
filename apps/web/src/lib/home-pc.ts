"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { joinChannel, RemoteClient, subscribed, type Device, type Tier } from "./remote";
import { supabase } from "./supabase/client";

// One open connection from this device to your home PC, shared by Cowork's chats.
// The PC still checks every request against what it allowed this device to do.

type State = { device?: Device; client?: RemoteClient; tiers: Tier[]; connecting: boolean; error?: string };
let state: State = { tiers: [], connecting: false };
let channel: RealtimeChannel | undefined;
const subs = new Set<() => void>();
const set = (p: Partial<State>) => {
  state = { ...state, ...p };
  subs.forEach((f) => f());
};

export const useHomePc = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
    () => state,
  );
export const homePcClient = () => state.client;

export async function findHomePc(): Promise<Device | undefined> {
  const { data } = await supabase().from("devices").select("id, name, os, remote_enabled, local_models, app_version, last_seen, is_home").eq("is_home", true).limit(1);
  return (data?.[0] as Device | undefined) ?? undefined;
}

export async function connectHomePc(device: Device) {
  set({ device, connecting: true, error: undefined });
  try {
    const ch = await joinChannel(device.id, { key: `client:${crypto.randomUUID()}` });
    const client = new RemoteClient(ch);
    await subscribed(ch);
    const r = await client.call<{ allowed: boolean; tiers?: Tier[] }>("connect", { tiers: ["files", "terminal", "chat"] }, 130_000);
    if (!r.allowed) throw new Error("The home PC didn't allow this device.");
    channel = ch;
    set({ client, tiers: r.tiers ?? [], connecting: false });
  } catch (e) {
    set({ connecting: false, error: e instanceof Error ? e.message : String(e) });
  }
}

export async function disconnectHomePc() {
  await state.client?.call("disconnect").catch(() => {});
  if (channel) supabase().removeChannel(channel);
  channel = undefined;
  set({ client: undefined, tiers: [] });
}

/** Tools the AI gets in Cowork while the home PC is connected. Changes and commands ask the person first. */
export const HOME_TOOLS = ["pc_list_files", "pc_read_file", "pc_write_file", "pc_run_command"] as const;
export const homeToolNeedsOk = (name: string) => name === "pc_write_file" || name === "pc_run_command";

export async function runHomeTool(name: string, input: Record<string, unknown>) {
  const c = state.client;
  if (!c) throw new Error("The home PC isn't connected. Connect it at the top of Cowork.");
  const path = String(input.path ?? "");
  switch (name) {
    case "pc_list_files":
      return c.call("files.list", { dir: path || undefined });
    case "pc_read_file": {
      const f = await c.call<{ name: string; data: string }>("files.read", { path }, 60_000);
      const bytes = Uint8Array.from(atob(f.data), (ch) => ch.charCodeAt(0));
      if (bytes.subarray(0, 8000).includes(0)) return { error: "That's not a text file." };
      return { path, text: new TextDecoder().decode(bytes).slice(0, 200_000) };
    }
    case "pc_write_file": {
      const parts = path.replace(/\\/g, "/").split("/");
      const fileName = parts.pop() ?? "";
      const data = btoa(String.fromCharCode(...new TextEncoder().encode(String(input.content ?? ""))));
      return c.call("files.write", { dir: parts.join("/"), name: fileName, data }, 60_000);
    }
    case "pc_run_command":
      return c.call("exec", { command: String(input.command ?? ""), cwd: input.cwd ? String(input.cwd) : undefined }, 150_000);
  }
  throw new Error("Unknown tool.");
}
