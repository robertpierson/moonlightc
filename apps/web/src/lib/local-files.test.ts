import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fileTools, resolveGranted } from "./local-files";

describe("local files", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "moonc-files-")));
  const shared = path.join(root, "shared");
  const secret = path.join(root, "secret");
  fs.mkdirSync(path.join(shared, "notes"), { recursive: true });
  fs.mkdirSync(secret);
  fs.writeFileSync(path.join(shared, "notes", "todo.txt"), "buy milk");
  fs.writeFileSync(path.join(secret, "keys.txt"), "nope");
  fs.writeFileSync(path.join(shared, "pic.bin"), Buffer.from([1, 0, 2]));

  it("only allows paths inside shared folders", async () => {
    await expect(resolveGranted(path.join(shared, "notes", "todo.txt"), [shared])).resolves.toBe(path.join(shared, "notes", "todo.txt"));
    await expect(resolveGranted("notes/new.txt", [shared])).resolves.toBe(path.join(shared, "notes", "new.txt"));
    await expect(resolveGranted(path.join(shared, "..", "secret", "keys.txt"), [shared])).rejects.toThrow("outside");
    await expect(resolveGranted(path.join(secret, "keys.txt"), [shared])).rejects.toThrow("outside");
    await expect(resolveGranted("x", [])).rejects.toThrow("No folders");
  });

  it("refuses links that point out of a shared folder", async () => {
    try {
      fs.symlinkSync(secret, path.join(shared, "sneaky"), "junction");
    } catch {
      return; // creating links needs extra rights on some systems
    }
    await expect(resolveGranted(path.join(shared, "sneaky", "keys.txt"), [shared])).rejects.toThrow("outside");
  });

  it("lists, searches, reads and writes", async () => {
    const { tools, approval } = fileTools([shared]);
    const run = (name: string, input: object) => (tools[name].execute as (i: object, o: object) => Promise<Record<string, unknown>>)(input, { toolCallId: "t", messages: [] });
    expect(await run("files_list", {})).toEqual({ sharedFolders: [shared] });
    expect(((await run("files_search", { query: "todo" })).matches as string[])[0]).toBe(path.join(shared, "notes", "todo.txt"));
    expect((await run("files_read", { path: "notes/todo.txt" })).text).toBe("buy milk");
    expect((await run("files_read", { path: "pic.bin" })).error).toContain("not a text file");
    await run("files_write", { path: "notes/out/new.md", content: "hi" });
    expect(fs.readFileSync(path.join(shared, "notes", "out", "new.md"), "utf8")).toBe("hi");
    expect(approval).toEqual({ files_write: "user-approval" });
  });
});
