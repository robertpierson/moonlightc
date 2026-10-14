import { describe, expect, it, vi } from "vitest";

const calls: [string, Record<string, unknown>][] = [];
vi.mock("./supabase/client", () => ({ supabase: () => ({ removeChannel() {} }) }));
vi.mock("./remote", () => ({
  joinChannel: async () => ({}),
  subscribed: async () => {},
  RemoteClient: class {
    async call(method: string, params: Record<string, unknown> = {}) {
      calls.push([method, params]);
      if (method === "connect") return { allowed: true, tiers: params.tiers };
      if (method === "files.read") return { name: "a.txt", data: btoa(String.fromCharCode(...new TextEncoder().encode("héllo"))) };
      return { ok: true };
    }
  },
}));

const { connectHomePc, homePcClient, homeToolNeedsOk, runHomeTool } = await import("./home-pc");

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
});
