"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { canReachPcs, joinChannel, leaveChannel, RemoteClient, sendToPc, subscribed, whereAmI, type Device, type Tier } from "./remote";
import type { UIMessage, UIMessageChunk } from "ai";
import { CLAUDE_CODE_MODELS, claudePrompt, friendly, remember, sessions } from "./claude-code";
import { getState, update } from "./store";
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

// Cowork gets the screen too, so the AI can look and click (Windows prompts and the sign-in screen are off limits to every app).
export async function connectHomePc(device: Device, tiers: Tier[] = ["view", "control", "files", "terminal", "chat"], quiet = false) {
  if (!quiet) set({ device, connecting: true, error: undefined });
  if (channel) leaveChannel(channel);
  channel = undefined;
  let ch: RealtimeChannel | undefined;
  try {
    ch = await joinChannel(device.id, { key: `client:${crypto.randomUUID()}` });
    const client = new RemoteClient(ch);
    await subscribed(ch);
    const r = await client.call<{ allowed: boolean; tiers?: Tier[]; reason?: string }>("connect", { tiers, where: await whereAmI() }, 130_000);
    if (!r.allowed) throw new Error(r.reason ?? "The home PC didn't allow this device.");
    channel = ch;
    set({ client, tiers: r.tiers ?? [], connecting: false });
    // Its local models show up in the model picker on this device (never synced: they only work through this link).
    const models = (device.local_models ?? []).map((m) => ({ id: m, name: m }));
    // Claude Code on the home PC (your own login there) works from here too.
    if (r.tiers?.includes("chat")) {
      const cc = await client.call<{ installed: boolean }>("claude.status", {}, 30_000).catch(() => ({ installed: false }));
      if (cc.installed) models.unshift(...CLAUDE_CODE_MODELS.map((m) => ({ id: `claude-code:${m.id}`, name: `Claude Code · ${m.name}` })));
    }
    if (models.length && r.tiers?.includes("chat"))
      update((s) => ({
        ...s,
        connections: [...s.connections.filter((c) => c.id !== HOME_CONN), { id: HOME_CONN, providerId: "home-pc", label: `Home PC (${device.name})`, apiKey: "", models, addedAt: Date.now() }],
      }));
  } catch (e) {
    if (ch) leaveChannel(ch);
    if (quiet) return;
    set({ connecting: false, error: e instanceof Error ? e.message : String(e) });
  }
}

export async function disconnectHomePc() {
  await state.client?.call("disconnect").catch(() => {});
  if (getState().connections.some((c) => c.id === HOME_CONN)) update((s) => ({ ...s, connections: s.connections.filter((c) => c.id !== HOME_CONN) }));
  if (channel) leaveChannel(channel);
  channel = undefined;
  set({ client: undefined, tiers: [] });
}

export const HOME_CONN = "home-pc";

/** A chat reply from a local model on the home PC, streamed back over the remote link in the AI SDK's format. */
export function homeChatStream(modelId: string, messages: UIMessage[], signal?: AbortSignal, chatId = "", effort?: string): ReadableStream<UIMessageChunk> {
  const claude = modelId.startsWith("claude-code:");
  const key = `home:${chatId}`;
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
          if (d.session) remember(key, d.session);
          if (d.delta) ctl.enqueue({ type: "text-delta", id, delta: d.delta });
          if (d.error) ctl.enqueue({ type: "error", errorText: claude ? friendly(d.error) : d.error });
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
        if (claude) await c.call("claude", { model: modelId.slice("claude-code:".length), prompt: claudePrompt(messages, sessions()[key]), session: sessions()[key], effort, reqId }, 30_000);
        else await c.call("chat", { model: modelId, messages: plain, reqId }, 30_000);
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

/** On your other devices: use the home PC's AI models (Claude Code, local models) without asking or sharing the
 * screen. Needs two-step sign-in on this device; quietly does nothing otherwise. */
export async function linkHomePcModels() {
  if (state.client) return;
  if (!(await canReachPcs())) return;
  const pc = await findHomePc().catch(() => undefined);
  if (pc && Date.now() - Date.parse(pc.last_seen) < 3 * 60_000) await connectHomePc(pc, ["chat"], true);
}

/** Cowork on another device may see and use the home PC's screen (it was allowed to). */
export const homeScreenOn = () => !!state.client && state.tiers.includes("view") && state.tiers.includes("control");

/** The AI's computer tool, run on the home PC: screenshots come back as pictures; clicks use their pixels. */
export async function runHomeScreen(a: { action: string; ms?: number; [k: string]: unknown }) {
  const c = state.client;
  if (!c || !homeScreenOn()) throw new Error("The home PC's screen isn't shared. Connect it at the top of Cowork.");
  if (a.action === "wait") await new Promise((r) => setTimeout(r, Math.min(5000, Number(a.ms ?? 1000))));
  else if (a.action !== "screenshot") await c.call("input", a, 30_000);
  if (a.action !== "screenshot") await new Promise((r) => setTimeout(r, 400));
  return c.call<{ image: string; width: number; height: number }>("frame", {}, 30_000);
}

/**
 * Keep the link to your home PC alive: if it's gone (the PC restarted or was updated), connect again quietly.
 * An older PC app doesn't know "ping"; that counts as alive.
 */
export async function checkHomeLink() {
  const c = state.client;
  if (!c) return linkHomePcModels();
  const ok = await c.call("ping", {}, 10_000).then(
    () => true,
    (e: Error) => /Unknown request/.test(e.message),
  );
  if (ok) return;
  await disconnectHomePc().catch(() => {});
  await linkHomePcModels();
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
      // Base64 in slices (spreading a big file into one call overflows), sent to the PC in pieces.
      const bytes = new TextEncoder().encode(String(input.content ?? ""));
      let bin = "";
      for (let i = 0; i < bytes.length; i += 32_768) bin += String.fromCharCode(...bytes.subarray(i, i + 32_768));
      return sendToPc(c, parts.join("/"), fileName, btoa(bin));
    }
    case "pc_run_command":
      return c.call("exec", { command: String(input.command ?? ""), cwd: input.cwd ? String(input.cwd) : undefined }, 150_000);
  }
  throw new Error("Unknown tool.");
}
