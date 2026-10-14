"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase/client";

// Remote control messages over the private Realtime channel "device:<id>" (see supabase/migrations/*_devices.sql).
// Requests carry the asking device's id; the PC answers with a matching "res". Terminal output and chat text stream
// as separate events addressed to that device.

export type Tier = "view" | "control" | "files" | "terminal" | "chat";
export const TIER_LABELS: Record<Tier, string> = { view: "See the screen", control: "Use the mouse and keyboard", files: "Files in the home folder", terminal: "Terminal", chat: "Chat with its AI models" };

export type Req = { id: string; from: string; fromName: string; method: string; params?: Record<string, unknown> };
export type Res = { id: string; to: string; ok: boolean; result?: unknown; error?: string };
export type Device = { id: string; name: string; os: string | null; remote_enabled: boolean; local_models: string[]; app_version: string | null; last_seen: string };

export const channelName = (deviceId: string) => `device:${deviceId}`;
export const isOnline = (d: Device, now = Date.now()) => now - Date.parse(d.last_seen) < 3 * 60_000;

/** This browser or app's id and name, as shown in the PC's "Allow this device?" prompt. */
export function thisClient() {
  let id = localStorage.getItem("moonc:client-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("moonc:client-id", id);
  }
  const ua = navigator.userAgent;
  const os = /iphone|ipad/i.test(ua) ? "iPhone/iPad" : /android/i.test(ua) ? "Android" : /cros/i.test(ua) ? "Chromebook" : /mac os/i.test(ua) ? "Mac" : /windows/i.test(ua) ? "Windows PC" : "Computer";
  const browser = /edg\//i.test(ua) ? "Edge" : /chrome|crios/i.test(ua) ? "Chrome" : /firefox|fxios/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : "browser";
  return { id, name: `${browser} on ${os}` };
}

export async function joinChannel(deviceId: string, presence: Record<string, unknown>) {
  const sb = supabase();
  await sb.realtime.setAuth();
  const ch = sb.channel(channelName(deviceId), { config: { private: true, broadcast: { self: false }, presence: { key: String(presence.key ?? crypto.randomUUID()) } } });
  return ch;
}

export function subscribed(ch: RealtimeChannel) {
  return new Promise<void>((resolve, reject) => {
    ch.subscribe((status, err) => {
      if (status === "SUBSCRIBED") resolve();
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
        reject(new Error(/unauthorized|denied|policy/i.test(String(err?.message ?? "")) ? "Two-step sign-in is needed on both devices." : "Couldn't reach your PC. Check that MoonlightC is open on it."));
    });
  });
}

/** The phone/browser side: send requests to the PC and wait for answers. */
export class RemoteClient {
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private onTerm = new Map<string, (data: string) => void>();
  private onChat = new Map<string, (delta: { delta?: string; done?: boolean; error?: string }) => void>();
  readonly me = thisClient();
  constructor(private ch: RealtimeChannel) {
    ch.on("broadcast", { event: "res" }, ({ payload }) => {
      const r = payload as Res;
      if (r.to !== this.me.id) return;
      const p = this.pending.get(r.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(r.id);
      if (r.ok) p.resolve(r.result);
      else p.reject(new Error(r.error ?? "Something went wrong on your PC."));
    });
    ch.on("broadcast", { event: "term" }, ({ payload }) => {
      const t = payload as { to: string; termId: string; data: string };
      if (t.to === this.me.id) this.onTerm.get(t.termId)?.(t.data);
    });
    ch.on("broadcast", { event: "chat" }, ({ payload }) => {
      const c = payload as { to: string; reqId: string; delta?: string; done?: boolean; error?: string };
      if (c.to === this.me.id) this.onChat.get(c.reqId)?.(c);
    });
  }
  call<T = unknown>(method: string, params?: Record<string, unknown>, timeoutMs = 20_000): Promise<T> {
    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(method === "connect" ? "Your PC didn't answer. Someone needs to click Allow on it." : "Your PC didn't answer in time."));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      const req: Req = { id, from: this.me.id, fromName: this.me.name, method, params };
      this.ch.send({ type: "broadcast", event: "req", payload: req });
    });
  }
  listenTerminal(termId: string, cb: (data: string) => void) {
    this.onTerm.set(termId, cb);
    return () => this.onTerm.delete(termId);
  }
  listenChat(reqId: string, cb: (c: { delta?: string; done?: boolean; error?: string }) => void) {
    this.onChat.set(reqId, cb);
    return () => this.onChat.delete(reqId);
  }
}
