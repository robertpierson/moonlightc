import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { applyChange, codeInstructions, normalizePath, pushToGitHub, revertChange, TEMPLATES, zipProject, type CodeProject } from "./code";

const proj = (): CodeProject => ({ id: "p", name: "My App", template: "react", files: { ...TEMPLATES.react.files }, history: [], updatedAt: 0 });

describe("code projects", () => {
  it("rejects paths that escape the project", () => {
    expect(normalizePath("src/App.js")).toBe("/src/App.js");
    for (const bad of ["../etc/passwd", "/a/../../b", "C:/x.js", `a${String.fromCharCode(92)}b.js`]) expect(() => normalizePath(bad)).toThrow();
  });

  it("records each change so it can be shown and undone", () => {
    const p1 = applyChange(proj(), "Add a button", [{ path: "App.js", content: "new" }, { path: "/Button.js", content: "b" }], ["/package.json"]);
    expect(p1.files["/App.js"]).toBe("new");
    expect(p1.files["/package.json"]).toBeUndefined();
    expect(p1.history[0].before["/Button.js"]).toBeNull();
    const p2 = revertChange(p1, p1.history[0]);
    expect(p2.files).toEqual(proj().files);
  });

  it("gives the AI the files", () => {
    const s = codeInstructions(proj());
    expect(s).toContain('<file path="/App.js">');
    expect(s).toContain("write_files");
  });

  it("zips files without leading slashes", () => {
    const z = unzipSync(zipProject(proj()));
    expect(strFromU8(z["App.js"])).toContain("Hello from MoonlightC");
    expect(Object.keys(z)).toContain("README.md");
  });

  it("pushes a new private repo file by file", async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method ?? "GET", body: init.body as string });
      if (url.endsWith("/user/repos")) return new Response(JSON.stringify({ full_name: "me/my-app" }), { status: 201 });
      if ((init.method ?? "GET") === "GET") return new Response("{}", { status: 404 });
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;
    expect(await pushToGitHub(proj(), "t", f)).toBe("me/my-app");
    expect(JSON.parse(calls[0].body!)).toMatchObject({ name: "my-app", private: true });
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(Object.keys(TEMPLATES.react.files).length);
  });
});
