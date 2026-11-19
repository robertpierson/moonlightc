// PC storage: keep files in the "MoonlightC Storage" folder on one of your PCs, from any device on your account.
// Requests go over the PC's private channel; file bytes go over a direct link between the two devices (WebRTC, free
// and fast). If the networks block a direct link, small files still go over the channel. Never through the paid
// relay. The PC side (desktop/src/storage.mjs) checks every request and only touches that one folder.
import { gathered, ICE, type RemoteClient } from "./remote";

/** What the other device may ask the PC's storage to do (anything else is refused). */
export const STORAGE_METHODS = ["list", "mkdir", "remove", "rename", "begin", "write", "finish", "cancel", "stat", "read"] as const;
export type StorageMethod = (typeof STORAGE_METHODS)[number];
/** Over the channel (no direct link), files are capped: every piece is a message and those are limited. */
export const SLOW_MAX = 25 * 1024 * 1024;
const SLOW_CHUNK = 64 * 1024;

export function toBase64(b: Uint8Array) {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
export const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

type Header = { id: string; m?: StorageMethod; p?: Record<string, unknown>; ok?: boolean; r?: unknown; e?: string; bytes?: boolean };

/**
 * Messages on a data channel: a JSON header, and when it says `bytes`, the next message is its binary data
 * (both are sent in the same tick, and the channel keeps order, so they always arrive together).
 */
export function framed(dc: RTCDataChannel, onMessage: (h: Header, bytes?: Uint8Array) => void) {
  let waiting: Header | undefined;
  dc.binaryType = "arraybuffer";
  dc.addEventListener("message", (ev) => {
    if (typeof ev.data === "string") {
      let h: Header;
      try {
        h = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (h.bytes) waiting = h;
      else onMessage(h);
    } else if (waiting) {
      const h = waiting;
      waiting = undefined;
      onMessage(h, new Uint8Array(ev.data as ArrayBuffer));
    }
  });
  return (h: Header, bytes?: Uint8Array) => {
    if (dc.readyState !== "open") return;
    dc.send(JSON.stringify(bytes ? { ...h, bytes: true } : h));
    if (bytes) dc.send(bytes as Uint8Array<ArrayBuffer>);
  };
}

/** One device's link to a PC's storage. */
export class StorageLink {
  private pc?: RTCPeerConnection;
  private send?: (h: Header, bytes?: Uint8Array) => void;
  private waits = new Map<string, { ok: (v: { r: unknown; bytes?: Uint8Array }) => void; fail: (e: Error) => void }>();
  /** Biggest piece the direct link takes in one message. */
  chunk = SLOW_CHUNK;
  constructor(private client: RemoteClient) {}
  get direct() {
    return !!this.send;
  }

  /** Try a direct link (up to 12 seconds); without one, everything goes over the channel. */
  async open() {
    try {
      const pc = new RTCPeerConnection({ iceServers: ICE });
      const dc = pc.createDataChannel("storage", { ordered: true });
      const opened = new Promise<void>((ok, fail) => {
        dc.addEventListener("open", () => ok());
        setTimeout(() => fail(new Error("no direct link")), 12_000);
      });
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc, 5000);
      const { sdp } = await this.client.call<{ sdp: string }>("storage.rtc", { sdp: pc.localDescription?.sdp }, 30_000);
      await pc.setRemoteDescription({ type: "answer", sdp });
      await opened;
      this.pc = pc;
      this.chunk = Math.min(256 * 1024, pc.sctp?.maxMessageSize || 64 * 1024);
      this.send = framed(dc, (h, bytes) => {
        const w = this.waits.get(h.id);
        if (!w) return;
        this.waits.delete(h.id);
        if (h.ok) w.ok({ r: h.r, bytes });
        else w.fail(new Error(h.e ?? "Something went wrong on your PC."));
      });
      const lost = () => {
        this.send = undefined;
        this.chunk = SLOW_CHUNK;
        for (const w of this.waits.values()) w.fail(new Error("The direct link to your PC dropped. Try again."));
        this.waits.clear();
      };
      dc.addEventListener("close", lost);
      pc.addEventListener("connectionstatechange", () => pc.connectionState === "failed" && lost());
    } catch {
      this.pc?.close();
      this.pc = undefined;
    }
    return this.direct;
  }

  async call<T = unknown>(m: StorageMethod, p: Record<string, unknown> = {}, bytes?: Uint8Array): Promise<{ r: T; bytes?: Uint8Array }> {
    if (this.send) {
      const id = crypto.randomUUID();
      const send = this.send;
      return new Promise((ok, fail) => {
        const timer = setTimeout(() => (this.waits.delete(id), fail(new Error("Your PC didn't answer in time."))), 60_000);
        this.waits.set(id, { ok: (v) => (clearTimeout(timer), ok(v as { r: T; bytes?: Uint8Array })), fail: (e) => (clearTimeout(timer), fail(e)) });
        send({ id, m, p }, bytes);
      });
    }
    const r = await this.client.call<{ r: T; data?: string }>(`storage.${m}`, bytes ? { ...p, data: toBase64(bytes) } : p, 60_000);
    return { r: r.r, bytes: r.data !== undefined ? fromBase64(r.data) : undefined };
  }

  close() {
    this.pc?.close();
    this.pc = undefined;
    this.send = undefined;
  }
}

export type Progress = (done: number, total: number) => void;

/** Run `jobs` with up to `n` at once, in order of start. */
async function pool(count: number, n: number, job: (i: number) => Promise<void>, signal?: AbortSignal) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, count) }, async () => {
      while (next < count) {
        if (signal?.aborted) throw new Error("Stopped.");
        await job(next++);
      }
    }),
  );
}

/** Send a file to a folder in the PC's storage. Returns the name it was saved as. */
export async function uploadFile(link: StorageLink, dir: string, file: File, onProgress?: Progress, signal?: AbortSignal) {
  if (!link.direct && file.size > SLOW_MAX) throw new Error(`${file.name} is over 25 MB, which needs a direct link to your PC, and your networks don't allow one right now. Try on another network, or on the same Wi-Fi as the PC.`);
  const { r } = await link.call<{ id: string }>("begin", { path: dir, name: file.name, size: file.size });
  const chunk = link.chunk;
  const n = Math.ceil(file.size / chunk);
  let done = 0;
  try {
    await pool(
      n,
      link.direct ? 16 : 3,
      async (i) => {
        const piece = new Uint8Array(await file.slice(i * chunk, (i + 1) * chunk).arrayBuffer());
        await link.call("write", { id: r.id, offset: i * chunk }, piece);
        done += piece.length;
        onProgress?.(done, file.size);
      },
      signal,
    );
    return (await link.call<{ name: string }>("finish", { id: r.id })).r.name;
  } catch (e) {
    link.call("cancel", { id: r.id }).catch(() => {});
    throw e;
  }
}

type Sink = { write(at: number, b: Uint8Array): Promise<void>; close(): Promise<void>; abort(): void };

/** Where a download goes: straight to a file you pick (Chrome, Edge, Chromebook), or memory then a normal download. */
async function sinkFor(name: string): Promise<Sink> {
  const pick = (globalThis as unknown as { showSaveFilePicker?: (o: { suggestedName: string }) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
  if (pick) {
    const w = await (await pick({ suggestedName: name })).createWritable();
    return { write: (at, b) => w.write({ type: "write", position: at, data: b as Uint8Array<ArrayBuffer> }), close: () => w.close(), abort: () => void w.abort().catch(() => {}) };
  }
  const parts: { at: number; b: Uint8Array }[] = [];
  return {
    write: async (at, b) => void parts.push({ at, b }),
    close: async () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(parts.sort((x, y) => x.at - y.at).map((p) => p.b as Uint8Array<ArrayBuffer>)));
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    },
    abort: () => void (parts.length = 0),
  };
}

/** Save a file from the PC's storage onto this device. */
// The save box opens first, while the click still counts (browsers only allow it right after one).
export async function downloadFile(link: StorageLink, path: string, name: string, size: number, onProgress?: Progress, signal?: AbortSignal) {
  if (!link.direct && size > SLOW_MAX) throw new Error(`${name} is over 25 MB, which needs a direct link to your PC, and your networks don't allow one right now.`);
  const sink = await sinkFor(name);
  let st: { name: string; size: number };
  try {
    st = (await link.call<{ name: string; size: number }>("stat", { path })).r;
  } catch (e) {
    sink.abort();
    throw e;
  }
  const chunk = link.chunk;
  let done = 0;
  try {
    await pool(
      Math.ceil(st.size / chunk),
      link.direct ? 16 : 3,
      async (i) => {
        const { bytes } = await link.call("read", { path, offset: i * chunk, length: chunk });
        if (!bytes) throw new Error("Part of the file didn't arrive.");
        await sink.write(i * chunk, bytes);
        done += bytes.length;
        onProgress?.(done, st.size);
      },
      signal,
    );
    await sink.close();
    return st.name;
  } catch (e) {
    sink.abort();
    throw e;
  }
}

/** "1.2 GB" */
export function bytes(n: number) {
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  for (; n >= 1024 && i < u.length - 1; i++) n /= 1024;
  return `${i ? n.toFixed(n < 10 ? 1 : 0) : n} ${u[i]}`;
}

/** This device's own folder name in the PC's storage ("Chrome on Chromebook"). */
export const folderFor = (deviceName: string) => deviceName.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 60) || "My device";
