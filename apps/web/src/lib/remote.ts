"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase/client";

// Remote control messages over the private Realtime channel "device:<id>" (see supabase/migrations/*_devices.sql).
// Requests carry the asking device's id; the PC answers with a matching "res". Terminal output and chat text stream
// as separate events addressed to that device.

export type Tier = "view" | "control" | "files" | "terminal" | "chat";
export const TIER_LABELS: Record<Tier, string> = { view: "See the screen and hear its sound", control: "Use the mouse and keyboard", files: "Files in the home folder", terminal: "Terminal", chat: "Chat with its AI models" };

export type Req = { id: string; from: string; fromName: string; method: string; params?: Record<string, unknown> };
export type Res = { id: string; to: string; ok: boolean; result?: unknown; error?: string };
export type Device = { id: string; name: string; os: string | null; remote_enabled: boolean; local_models: string[]; app_version: string | null; last_seen: string; is_home?: boolean };

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
  // Supabase keeps one channel per PC in a page: the AI link, remote control and the PC's own host share it (each
  // reads only answers addressed to it), and it closes when the last one leaves.
  const ch = sb.channel(channelName(deviceId), { config: { private: true, broadcast: { self: false }, presence: { key: String(presence.key ?? crypto.randomUUID()) } } });
  users.set(ch, (users.get(ch) ?? 0) + 1);
  return ch;
}
const users = new Map<RealtimeChannel, number>();
const joins = new WeakMap<RealtimeChannel, Promise<void>>();

export function leaveChannel(ch: RealtimeChannel) {
  const n = (users.get(ch) ?? 1) - 1;
  if (n > 0) return void users.set(ch, n);
  users.delete(ch);
  joins.delete(ch);
  supabase().removeChannel(ch);
}

/** Joined (a second subscribe on a shared channel never answers, so everyone waits on the first one). */
export function subscribed(ch: RealtimeChannel) {
  let p = joins.get(ch);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      ch.subscribe((status, err) => {
        if (status === "SUBSCRIBED") resolve();
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          reject(new Error(/unauthorized|denied|policy/i.test(String(err?.message ?? "")) ? "Two-step sign-in is needed on both devices." : "Couldn't reach your PC. Check that MoonlightC is open on it."));
      });
    });
    joins.set(ch, p);
    p.catch(() => joins.delete(ch));
  }
  return p;
}

/** The phone/browser side: send requests to the PC and wait for answers. */
export class RemoteClient {
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private onTerm = new Map<string, (data: string) => void>();
  private onChat = new Map<string, (delta: { delta?: string; done?: boolean; error?: string; session?: string }) => void>();
  readonly me: { id: string; name: string };
  /** role: a separate connection from this device (remote control vs. the AI link), so ending one keeps the other. */
  constructor(
    private ch: RealtimeChannel,
    role?: string,
  ) {
    const c = thisClient();
    this.me = role ? { id: `${c.id}:${role}`, name: c.name } : c;
    const parts = new Map<string, string[]>();
    ch.on("broadcast", { event: "part" }, ({ payload }) => {
      const pt = payload as { id: string; to: string; i: number; n: number; data: string };
      if (pt.to !== this.me.id || !this.pending.has(pt.id) || !(pt.n > 0 && pt.n <= 200)) return;
      const got = parts.get(pt.id) ?? Array<string>(pt.n);
      got[pt.i] = pt.data;
      parts.set(pt.id, got);
      if (got.filter((x) => x !== undefined).length < pt.n) return;
      parts.delete(pt.id);
      settle(JSON.parse(got.join("")) as Res);
    });
    ch.on("broadcast", { event: "res" }, ({ payload }) => settle(payload as Res));
    const settle = (r: Res) => {
      if (r.to !== this.me.id) return;
      const p = this.pending.get(r.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(r.id);
      if (r.ok) p.resolve(r.result);
      else p.reject(new Error(r.error ?? "Something went wrong on your PC."));
    };
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
  listenChat(reqId: string, cb: (c: { delta?: string; done?: boolean; error?: string; session?: string }) => void) {
    this.onChat.set(reqId, cb);
    return () => this.onChat.delete(reqId);
  }
}

/** Public servers that only tell each side its own internet address, so the two can stream video directly. */
export const ICE: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];

/** Send a file to the PC (in pieces: messages have a size cap). Up to 10 MB. */
export async function uploadToPc(client: RemoteClient, dir: string, file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("Files over 10 MB can't be sent yet.");
  const url = await new Promise<string>((done, fail) => {
    const r = new FileReader();
    r.onload = () => done(String(r.result));
    r.onerror = () => fail(new Error("Couldn't read that file."));
    r.readAsDataURL(file);
  });
  const data = url.slice(url.indexOf(",") + 1);
  const size = 90_000;
  const n = Math.max(1, Math.ceil(data.length / size));
  const upload = crypto.randomUUID();
  let result: unknown;
  for (let i = 0; i < n; i++) result = await client.call("files.part", { upload, i, n, dir, name: file.name, data: data.slice(i * size, (i + 1) * size) }, 60_000);
  return result as { saved: string };
}

/** ICE servers plus a relay (when the server has one) for networks that block direct video. Cached for an hour. */
let relay: { at: number; list: RTCIceServer[] } | undefined;
export const forgetRelay = () => void (relay = undefined);
export async function iceServers(): Promise<RTCIceServer[]> {
  if (relay && Date.now() - relay.at < 3_600_000) return [...ICE, ...relay.list];
  try {
    const { data } = await supabase().auth.getSession();
    const r = await fetch("/api/turn", { headers: data.session ? { authorization: `Bearer ${data.session.access_token}` } : {}, cache: "no-store" });
    const list = r.ok ? (((await r.json()) as { iceServers?: RTCIceServer[] }).iceServers ?? []) : [];
    relay = { at: Date.now(), list };
    return [...ICE, ...list];
  } catch {
    return ICE;
  }
}

/** Opus at music quality in stereo (the default is tuned for voices on calls). */
export const hifiAudio = (sdp?: string) => (sdp ?? "").replace(/useinbandfec=1/g, "useinbandfec=1;stereo=1;sprop-stereo=1;maxaveragebitrate=192000");

/** Wait until the connection knows all its possible network paths (so one message carries everything). */
export function gathered(pc: RTCPeerConnection, ms = 4000) {
  return new Promise<void>((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const t = setTimeout(resolve, ms);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(t);
        resolve();
      }
    });
  });
}

/** This device may reach your PCs: signed in with the two-step code, or "connect without the code" is on. */
export async function canReachPcs() {
  const sb = supabase();
  const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === "aal2") return true;
  return (await sb.rpc("quick_access_on")).data === true;
}

/** A note signed by the MoonlightC website saying where this device is (for PCs that allow only certain places). */
export const whereAmI = () =>
  fetch("https://moonlightc.vercel.app/api/attest", { cache: "no-store" })
    .then((r) => r.json())
    .catch(() => undefined);
