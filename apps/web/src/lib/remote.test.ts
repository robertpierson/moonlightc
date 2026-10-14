import type { RealtimeChannel } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MooncBridge } from "./desktop";
import { RemoteClient, type Req, type Res } from "./remote";
import { createHostHandler } from "./remote-host";

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
  const b = {
    device: { info: async () => ({ id: "pc1", name: "Desk PC", os: "windows", version: "0.3.0" }) },
    remote: {
      connect: async (c: { id: string }, tiers: string[]) => (sessions.set(c.id, tiers), { allowed: true, tiers }),
      end: async (id?: string) => void (id ? sessions.delete(id) : sessions.clear()),
      allowed: async (id: string, t: string) => !!sessions.get(id)?.includes(t),
      frame: async (id: string) => {
        if (!sessions.get(id)?.includes("view")) throw new Error("not allowed");
        return { image: "jpg", width: 10, height: 5 };
      },
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
  return { b, killed };
}

function connectPair() {
  const { pc, phone } = wire();
  const { b, killed } = fakeBridge();
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
  return { client: new RemoteClient(phone), host, killed };
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
    expect(await client.call("frame")).toMatchObject({ image: "jpg", width: 10 });
    await expect(client.call("input", { action: "click", x: 1, y: 1 })).rejects.toThrow("mouse and keyboard");
    await expect(client.call("models")).rejects.toThrow("isn't allowed");
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
