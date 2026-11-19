import type { RealtimeChannel } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { MooncBridge } from "./desktop";
import { bytes, downloadFile, framed, fromBase64, SLOW_MAX, StorageLink, toBase64, uploadFile } from "./pc-storage";
import { RemoteClient, type Req } from "./remote";
import { createHostHandler } from "./remote-host";

vi.mock("./supabase/client", () => ({
  supabase: () => ({ rpc: async () => ({ data: 1 }), auth: { getUser: async () => ({ data: { user: { id: "me" } } }) } }),
}));

const mem = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (X11; CrOS x86_64) Chrome/140" });

/** A channel shared by the PC and one Chromebook, in memory. */
function wire() {
  const handlers: { side: string; event: string; fn: (m: { payload: unknown }) => void }[] = [];
  const make = (side: string) =>
    ({
      on: (_t: string, f: { event: string }, fn: (m: { payload: unknown }) => void) => void handlers.push({ side, event: f.event, fn }),
      send: ({ event, payload }: { event: string; payload: unknown }) => {
        const copy = JSON.parse(JSON.stringify(payload)); // like the network: only JSON gets through
        for (const h of handlers) if (h.side !== side && h.event === event) queueMicrotask(() => h.fn({ payload: copy }));
        return Promise.resolve("ok");
      },
    }) as unknown as RealtimeChannel;
  return { pc: make("pc"), book: make("book") };
}

/** The PC: a fake desktop bridge whose storage keeps files in memory, with the same session rule as storage.mjs. */
function pc() {
  const sessions = new Map<string, string[]>();
  const files = new Map<string, Uint8Array>();
  const uploads = new Map<string, { path: string; data: Uint8Array; got: number }>();
  const asked: string[][] = [];
  const need = (id: string) => {
    if (!sessions.get(id)?.includes("storage")) throw new Error("Not connected to this PC's storage.");
  };
  const b = {
    remote: {
      connect: async (c: { id: string }, tiers: string[]) => (asked.push(tiers), sessions.set(c.id, tiers), { allowed: tiers.length > 0, tiers }),
      allowed: async (id: string, t: string) => !!sessions.get(id)?.includes(t),
    },
    storage: {
      list: async (id: string, rel: string) => (need(id), { path: rel, entries: [...files.keys()].filter((k) => k.startsWith(rel ? `${rel}/` : "")).map((k) => ({ name: k.split("/").pop()!, dir: false, size: files.get(k)!.length, at: 0 })), used: 0, max: 1e9, free: 1e9 }),
      begin: async (id: string, rel: string, name: string, size: number) => (need(id), uploads.set("u1", { path: rel ? `${rel}/${name}` : name, data: new Uint8Array(size), got: 0 }), { id: "u1" }),
      write: async (id: string, up: string, offset: number, data: Uint8Array) => {
        need(id);
        const u = uploads.get(up)!;
        u.data.set(data, offset);
        u.got += data.length;
        return { got: u.got };
      },
      finish: async (id: string, up: string) => {
        need(id);
        const u = uploads.get(up)!;
        if (u.got !== u.data.length) throw new Error("missing");
        files.set(u.path, u.data);
        return { name: u.path.split("/").pop()! };
      },
      cancel: async () => ({ ok: true }),
      stat: async (id: string, rel: string) => (need(id), { name: rel.split("/").pop()!, size: files.get(rel)!.length }),
      read: async (id: string, rel: string, offset: number, length: number) => (need(id), files.get(rel)!.slice(offset, offset + length)),
    },
  } as unknown as MooncBridge;
  return { b, files, asked };
}

async function connected() {
  const w = wire();
  const p = pc();
  const host = createHostHandler(p.b, (event, payload) => w.pc.send({ type: "broadcast", event, payload } as never));
  w.pc.on("broadcast", { event: "req" }, async ({ payload }: { payload: unknown }) => {
    const req = payload as Req;
    try {
      w.pc.send({ type: "broadcast", event: "res", payload: { id: req.id, to: req.from, ok: true, result: await host.handle(req) } } as never);
    } catch (e) {
      w.pc.send({ type: "broadcast", event: "res", payload: { id: req.id, to: req.from, ok: false, error: (e as Error).message } } as never);
    }
  });
  const client = new RemoteClient(w.book, "storage");
  return { client, ...p };
}

describe("PC storage", () => {
  it("with remote control off, the PC only grants storage", async () => {
    const { client, asked } = await connected();
    await client.call("connect", { tiers: ["view", "terminal", "storage"] });
    expect(asked[0]).toEqual(["storage"]);
  });

  it("refuses storage requests from a device that isn't connected", async () => {
    const { client } = await connected();
    await expect(new StorageLink(client).call("list", { path: "" })).rejects.toThrow(/allowed/);
    await expect(client.call("storage.open", {})).rejects.toThrow(/Unknown request/);
  });

  it("uploads and downloads a file over the channel, byte for byte", async () => {
    const { client, files } = await connected();
    await client.call("connect", { tiers: ["storage"] });
    const link = new StorageLink(client); // no direct link in tests: the channel path
    const data = new Uint8Array(200_000).map((_, i) => (i * 7) % 251);
    const saved = await uploadFile(link, "Chromebook", new File([data], "notes.bin"));
    expect(saved).toBe("notes.bin");
    expect(files.get("Chromebook/notes.bin")).toEqual(data);

    // The download lands in memory, then the browser saves it.
    let blob: Blob | undefined;
    vi.stubGlobal("document", { createElement: () => ({ click() {}, set href(_: string) {} }) });
    vi.stubGlobal("URL", { createObjectURL: (b: Blob) => ((blob = b), "blob:x"), revokeObjectURL() {} });
    let seen = 0;
    await downloadFile(link, "Chromebook/notes.bin", "notes.bin", data.length, (d) => (seen = d));
    expect(seen).toBe(data.length);
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(data);
  });

  it("big files need a direct link", async () => {
    const { client } = await connected();
    const big = { name: "movie.mp4", size: SLOW_MAX + 1 } as File;
    await expect(uploadFile(new StorageLink(client), "", big)).rejects.toThrow(/direct link/);
  });

  it("frames headers and bytes on a data channel", () => {
    const sent: (string | Uint8Array)[] = [];
    let listener: (e: { data: unknown }) => void = () => {};
    const dc = { readyState: "open", send: (d: string | Uint8Array) => sent.push(d), addEventListener: (_: string, f: typeof listener) => (listener = f) } as unknown as RTCDataChannel;
    const got: unknown[] = [];
    const send = framed(dc, (h, b) => got.push([h.id, b && [...b]]));
    send({ id: "a" }, new Uint8Array([1, 2, 3]));
    send({ id: "b" });
    for (const m of sent) listener({ data: typeof m === "string" ? m : m.buffer });
    expect(got).toEqual([["a", [1, 2, 3]], ["b", undefined]]);
  });

  it("base64 and sizes", () => {
    const b = new Uint8Array(70_000).map((_, i) => i % 256);
    expect(fromBase64(toBase64(b))).toEqual(b);
    expect(bytes(512)).toBe("512 B");
    expect(bytes(1536)).toBe("1.5 KB");
    expect(bytes(5 * 1024 ** 3)).toBe("5.0 GB");
  });
});
