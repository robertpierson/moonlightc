"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { joinChannel, RemoteClient, subscribed, type Device, type Tier } from "./remote";
import type { UIMessage, UIMessageChunk } from "ai";
import { update } from "./store";
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

// Closing or leaving the page ends the session on the PC (its orange frame goes away).
if (typeof window !== "undefined") addEventListener("pagehide", () => void disconnectHomePc());

export async function findHomePc(): Promise<Device | undefined> {
  const { data } = await supabase().from("devices").select("id, name, os, remote_enabled, local_models, app_version, last_seen, is_home").eq("is_home", true).limit(1);
  return (data?.[0] as Device | undefined) ?? undefined;
}

export async function connectHomePc(device: Device) {
  set({ device, connecting: true, error: undefined });
  let ch: RealtimeChannel | undefined;
  try {
    ch = await joinChannel(device.id, { key: `client:${crypto.randomUUID()}` });
    const client = new RemoteClient(ch);
    await subscribed(ch);
    const r = await client.call<{ allowed: boolean; tiers?: Tier[] }>("connect", { tiers: ["files", "terminal", "chat"] }, 130_000);
    if (!r.allowed) throw new Error("The home PC didn't allow this device.");
    channel = ch;
    set({ client, tiers: r.tiers ?? [], connecting: false });
    // Its local models show up in the model picker on this device (never synced: they only work through this link).
    const models = (device.local_models ?? []).map((m) => ({ id: m, name: m }));
    if (models.length && r.tiers?.includes("chat"))
      update((s) => ({
        ...s,
        connections: [...s.connections.filter((c) => c.id !== HOME_CONN), { id: HOME_CONN, providerId: "home-pc", label: `Home PC (${device.name})`, apiKey: "", models, addedAt: Date.now() }],
      }));
  } catch (e) {
    if (ch) supabase().removeChannel(ch);
    set({ connecting: false, error: e instanceof Error ? e.message : String(e) });
  }
}

export async function disconnectHomePc() {
  await state.client?.call("disconnect").catch(() => {});
  if (channel) supabase().removeChannel(channel);
  channel = undefined;
  set({ client: undefined, tiers: [] });
}

export const HOME_CONN = "home-pc";

/** A chat reply from a local model on the home PC, streamed back over the remote link in the AI SDK's format. */
export function homeChatStream(modelId: string, messages: UIMessage[], signal?: AbortSignal): ReadableStream<UIMessageChunk> {
  const c = state.client;
  return new ReadableStream<UIMessageChunk>({
    async start(ctl) {
      if (!c || !state.tiers.includes("chat")) {
        ctl.enqueue({ type: "error", errorText: "Your home PC isn't connected. In Cowork, tap \"Let AI use it\" first." });
        ctl.close();
        return;
      }
      const reqId = crypto.randomUUID();
      const id = `home-${reqId}`;
      ctl.enqueue({ type: "start" });
      ctl.enqueue({ type: "text-start", id });
      const finished = new Promise<void>((resolve) => {
        const off = c.listenChat(reqId, (d) => {
          if (d.delta) ctl.enqueue({ type: "text-delta", id, delta: d.delta });
          if (d.error) ctl.enqueue({ type: "error", errorText: d.error });
          if (d.done) {
            off();
            resolve();
          }
        });
        signal?.addEventListener("abort", () => {
          off();
          resolve();
        });
      });
      const plain = messages
        .map((m) => ({ role: m.role, content: m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n") }))
        .filter((m) => m.content);
      try {
        await c.call("chat", { model: modelId, messages: plain, reqId }, 30_000);
        await finished;
      } catch (e) {
        ctl.enqueue({ type: "error", errorText: e instanceof Error ? e.message : String(e) });
      }
      ctl.enqueue({ type: "text-end", id });
      ctl.enqueue({ type: "finish" });
      ctl.close();
    },
  });
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
