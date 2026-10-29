import type { RealtimeChannel } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MooncBridge } from "./desktop";
import { RemoteClient, routeKinds, subscribed, type Req, type Res } from "./remote";
import { createHostHandler } from "./remote-host";

vi.mock("./supabase/client", () => ({
  supabase: () => ({ rpc: async () => ({ data: 1 }), auth: { getUser: async () => ({ data: { user: { id: "me" } } }), getSession: async () => ({ data: { session: null } }) } }),
}));
let account: unknown;

/** An in-memory stand-in for a Realtime channel shared by the PC and one phone. */
function wire() {
  const handlers: { side: "pc" | "phone"; event: string; fn: (m: { payload: unknown }) => void }[] = [];
  const make = (side: "pc" | "phone") =>
    ({
      on: (_t: string, f: { event: string }, fn: (m: { payload: unknown }) => void) => {
        handlers.push({ side, event: f.event, fn });
        return undefined;
      },
      send: ({ event, payload }: { event: string; payload: unknown }) => {
        for (const h of handlers) if (h.side !== side && h.event === event) queueMicrotask(() => h.fn({ payload }));
        return Promise.resolve("ok");
      },
    }) as unknown as RealtimeChannel;
  return { pc: make("pc"), phone: make("phone") };
}

/** A fake desktop bridge with the same permission rules as apps/desktop/src/remote.mjs. */
function fakeBridge() {
  const sessions = new Map<string, string[]>();
  const onData = new Map<string, (d: string) => void>();
  const killed: string[] = [];
  const written: { dir: string; name: string; data: string }[] = [];
  const b = {
    device: { info: async () => ({ id: "pc1", name: "Desk PC", os: "windows", version: "0.3.0" }) },
    remote: {
      connect: async (c: { id: string }, tiers: string[], _w: unknown, a: unknown) => ((account = a), sessions.set(c.id, tiers), { allowed: true, tiers }),
      end: async (id?: string) => void (id ? sessions.delete(id) : sessions.clear()),
      allowed: async (id: string, t: string) => !!sessions.get(id)?.includes(t),
      frame: async (id: string) => {
        if (!sessions.get(id)?.includes("view")) throw new Error("not allowed");
        return { image: "jpg", width: 10, height: 5 };
      },
      write: async (id: string, dir: string, name: string, data: string) => {
        if (!sessions.get(id)?.includes("files")) throw new Error("not allowed");
        written.push({ dir, name, data });
        return { saved: `${dir}/${name}` };
      },
      clipboardGet: async () => ({ text: "from the PC" }),
      openUrl: async () => ({ ok: true }),
      clipboardSet: async () => ({ ok: true }),
      input: async (id: string) => {
        if (!sessions.get(id)?.includes("control")) throw new Error("This device wasn't allowed to use the mouse and keyboard.");
        return { ok: true };
      },
    },
    terminals: {
      create: async () => ({ id: "t1", title: "shell" }),
      onData: (id: string, cb: (d: string) => void) => (onData.set(id, cb), () => onData.delete(id)),
      write: (id: string, d: string) => onData.get(id)?.(`echo:${d}`),
      kill: (id: string) => void killed.push(id),
    },
  } as unknown as MooncBridge;
  return { b, killed, written };
}

function connectPair() {
  const { pc, phone } = wire();
  const { b, killed, written } = fakeBridge();
  const send = (event: string, payload: unknown) => pc.send({ type: "broadcast", event, payload });
  const host = createHostHandler(b, send);
  pc.on("broadcast", { event: "req" }, async ({ payload }) => {
    const req = payload as Req;
    let res: Res;
    try {
      res = { id: req.id, to: req.from, ok: true, result: await host.handle(req) };
    } catch (e) {
      res = { id: req.id, to: req.from, ok: false, error: (e as Error).message };
    }
    send("res", res);
  });
  return { client: new RemoteClient(phone), host, killed, written };
}

// The phone's id lives in localStorage; give the test a tiny one.
const mem = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone) Safari" });

describe("remote control protocol", () => {
  afterEach(() => vi.restoreAllMocks());

  it("connects, streams the screen, and refuses what wasn't allowed", async () => {
    const { client } = connectPair();
    expect(await client.call("connect", { tiers: ["view", "terminal"] })).toEqual({ allowed: true, tiers: ["view", "terminal"] });
    // The PC passes its account's security level and id, to check the other device's signed note against.
    expect(account).toEqual({ level: 1, uid: "me" });
    expect(await client.call("frame")).toMatchObject({ image: "jpg", width: 10 });
    await expect(client.call("input", { action: "click", x: 1, y: 1 })).rejects.toThrow("mouse and keyboard");
    await expect(client.call("models")).rejects.toThrow("isn't allowed");
  });

  it("a file sent in pieces is written once, whole; only with the files permission", async () => {
    const { client, written } = connectPair();
    await client.call("connect", { tiers: ["view"] });
    await expect(client.call("files.part", { upload: "u1", i: 0, n: 2, dir: "Downloads", name: "a.txt", data: "AAA" })).rejects.toThrow("isn't allowed");
    await client.call("connect", { tiers: ["view", "files"] });
    expect(await client.call("files.part", { upload: "u2", i: 1, n: 2, dir: "Downloads", name: "a.txt", data: "BBB" })).toEqual({ ok: true });
    expect(written).toHaveLength(0);
    expect(await client.call("files.part", { upload: "u2", i: 0, n: 2, dir: "Downloads", name: "a.txt", data: "AAA" })).toEqual({ saved: "Downloads/a.txt" });
    expect(written).toEqual([{ dir: "Downloads", name: "a.txt", data: "AAABBB" }]);
  });

  it("copy and paste need the mouse-and-keyboard permission", async () => {
    const { client } = connectPair();
    await client.call("connect", { tiers: ["view"] });
    await expect(client.call("clipboard.get")).rejects.toThrow("isn't allowed");
    await expect(client.call("clipboard.set", { text: "x" })).rejects.toThrow("isn't allowed");
    await expect(client.call("open.url", { url: "https://example.com" })).rejects.toThrow("isn't allowed");
    await client.call("connect", { tiers: ["view", "control"] });
    expect(await client.call("clipboard.get")).toEqual({ text: "from the PC" });
    expect(await client.call("open.url", { url: "https://example.com" })).toEqual({ ok: true });
  });

  it("terminal output flows back, and terminals close when the session ends", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const { client, host, killed } = connectPair();
    await client.call("connect", { tiers: ["terminal"] });
    const { termId } = await client.call<{ termId: string }>("term.open", { cols: 80, rows: 24 });
    const out: string[] = [];
    client.listenTerminal(termId, (d) => out.push(d));
    await client.call("term.write", { termId, data: "ls\r" });
    vi.advanceTimersByTime(100);
    await new Promise((r) => setTimeout(r, 0));
    expect(out.join("")).toBe("echo:ls\r");
    host.sessionsChanged([]);
    expect(killed).toEqual([termId]);
    vi.useRealTimers();
  });

  it("streams a local model's answer", async () => {
    const lines = ['{"message":{"content":"Hel"}}', '{"message":{"content":"lo"}}', '{"done":true}'].join("\n") + "\n";
    const real = globalThis.fetch;
    globalThis.fetch = (async () => new Response(lines)) as typeof fetch;
    const { client } = connectPair();
    await client.call("connect", { tiers: ["chat"] });
    let text = "";
    const done = new Promise<void>((resolve) => client.listenChat("r1", (c) => ((text += c.delta ?? ""), c.done && resolve())));
    await client.call("chat", { model: "llama", messages: [{ role: "user", content: "hi" }], reqId: "r1" });
    await done;
    expect(text).toBe("Hello");
    globalThis.fetch = real;
  });
});

describe("shared PC channel", () => {
  it("a second join waits on the first instead of subscribing again (which never answers)", async () => {
    let calls = 0;
    let done: (s: string) => void = () => {};
    const ch = { subscribe: (cb: (s: string) => void) => (calls++, (done = cb)) } as unknown as Parameters<typeof subscribed>[0];
    const a = subscribed(ch);
    const b = subscribed(ch);
    done("SUBSCRIBED");
    await Promise.all([a, b]);
    expect(calls).toBe(1);
  });
});

describe("big answers", () => {
  it("arrive in pieces and are put back together", async () => {
    const { pc, phone } = wire();
    const client = new RemoteClient(phone);
    const big = "x".repeat(350_000);
    pc.on("broadcast", { event: "req" }, ({ payload }) => {
      const req = payload as Req;
      const json = JSON.stringify({ id: req.id, to: req.from, ok: true, result: { url: big } } satisfies Res);
      for (let i = 0, n = Math.ceil(json.length / 100_000); i < n; i++) pc.send({ type: "broadcast", event: "part", payload: { id: req.id, to: req.from, i, n, data: json.slice(i * 100_000, (i + 1) * 100_000) } });
    });
    const r = await client.call<{ url: string }>("shot");
    expect(r.url.length).toBe(350_000);
  });
});

describe("routeKinds", () => {
  it("counts direct, internet and relay routes in a connection description", () => {
    const sdp = "a=candidate:1 1 udp 1 10.0.0.2 5000 typ host\r\na=candidate:2 1 udp 1 1.2.3.4 5000 typ srflx raddr 10.0.0.2\r\na=candidate:3 1 udp 1 5.6.7.8 3478 typ relay\r\na=candidate:4 1 tcp 1 5.6.7.8 443 typ relay\r\n";
    expect(routeKinds(sdp)).toBe("direct 1, internet 1, relay 2");
    expect(routeKinds(undefined)).toBe("direct 0, internet 0, relay 0");
  });
});
