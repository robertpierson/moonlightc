import { describe, expect, it, vi } from "vitest";

const calls: [string, Record<string, unknown>][] = [];
vi.mock("./supabase/client", () => ({ supabase: () => ({ removeChannel() {} }) }));
vi.mock("./store", () => ({ update: () => {}, getState: () => ({ connections: [] }) }));
let pingFails = "";
let chatCb: ((d: { delta?: string; done?: boolean }) => void) | undefined;
vi.mock("./remote", () => ({
  // Small files go in one piece.
  sendToPc: (c: { call: (m: string, p: unknown) => unknown }, dir: string, name: string, data: string) => c.call("files.write", { dir, name, data }),
  joinChannel: async () => ({}),
  leaveChannel: () => {},
  canReachPcs: async () => false,
  whereAmI: async () => undefined,
  subscribed: async () => {},
  RemoteClient: class {
    listenChat(_id: string, cb: typeof chatCb) {
      chatCb = cb;
      return () => (chatCb = undefined);
    }
    async call(method: string, params: Record<string, unknown> = {}) {
      calls.push([method, params]);
      if (method === "connect") return { allowed: true, tiers: params.tiers };
      if (method === "ping" && pingFails) throw new Error(pingFails);
      if (method === "chat") setTimeout(() => (chatCb?.({ delta: "Hi " }), chatCb?.({ delta: "there", done: true })));
      if (method === "files.read") return { name: "a.txt", data: btoa(String.fromCharCode(...new TextEncoder().encode("héllo"))) };
      return { ok: true };
    }
  },
}));

const { checkHomeLink, connectHomePc, homeChatStream, homePcClient, homeToolNeedsOk, runHomeTool } = await import("./home-pc");

describe("home PC tools", () => {
  it("refuse until connected, then map onto the PC's remote requests", async () => {
    await expect(runHomeTool("pc_list_files", {})).rejects.toThrow(/isn't connected/);
    await connectHomePc({ id: "pc1", name: "Desk" } as never);
    expect(homePcClient()).toBeTruthy();

    await runHomeTool("pc_list_files", { path: "code" });
    expect(calls.at(-1)).toEqual(["files.list", { dir: "code" }]);

    expect(await runHomeTool("pc_read_file", { path: "a.txt" })).toEqual({ path: "a.txt", text: "héllo" });

    await runHomeTool("pc_write_file", { path: "code\\app\\x.ts", content: "é" });
    expect(calls.at(-1)).toEqual(["files.write", { dir: "code/app", name: "x.ts", data: btoa(String.fromCharCode(0xc3, 0xa9)) }]);

    await runHomeTool("pc_run_command", { command: "git status", cwd: "code" });
    expect(calls.at(-1)).toEqual(["exec", { command: "git status", cwd: "code" }]);

    expect(homeToolNeedsOk("pc_write_file") && homeToolNeedsOk("pc_run_command")).toBe(true);
    expect(homeToolNeedsOk("pc_read_file")).toBe(false);
  });

  it("streams a home PC model's reply as chat chunks", async () => {
    const chunks: { type: string; delta?: string }[] = [];
    const reader = homeChatStream("llama3", [{ id: "1", role: "user", parts: [{ type: "text", text: "hello" }] }]).getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    expect(chunks.map((c) => c.type)).toEqual(["start", "text-start", "text-delta", "text-delta", "text-end", "finish"]);
    expect(chunks.flatMap((c) => c.delta ?? []).join("")).toBe("Hi there");
    expect(calls.find(([m]) => m === "chat")?.[1]).toMatchObject({ model: "llama3", messages: [{ role: "user", content: "hello" }] });
  });

  it("keeps the link: alive stays, an old PC app counts as alive, a dropped link is let go", async () => {
    await connectHomePc({ id: "pc1", name: "Desk" } as never);
    await checkHomeLink();
    expect(homePcClient()).toBeTruthy();
    pingFails = "Unknown request.";
    await checkHomeLink();
    expect(homePcClient()).toBeTruthy();
    pingFails = "This device isn't allowed to do that.";
    await checkHomeLink();
    expect(homePcClient()).toBeUndefined();
    pingFails = "";
  });
});
