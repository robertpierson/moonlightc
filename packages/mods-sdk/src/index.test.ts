import { describe, expect, it } from "vitest";
import { fillCommand, validateManifest } from "./index";

const base = { id: "units", name: "Units", version: "1.0.0", description: "d", author: "a" };

describe("validateManifest", () => {
  it("accepts a tool mod that declares its permission and script", () => {
    const m = validateManifest({ ...base, permissions: ["tools"], script: "mod.js", tools: [{ name: "convert", description: "c", inputSchema: { type: "object", properties: {} } }] });
    expect(m.tools[0].name).toBe("convert");
  });
  it("rejects tools without the permission", () => {
    expect(() => validateManifest({ ...base, script: "mod.js", tools: [{ name: "x", description: "c", inputSchema: { type: "object" } }] })).toThrow(/permission/);
  });
  it("rejects script paths that escape or aren't js", () => {
    expect(() => validateManifest({ ...base, script: "https://evil.example/x.js" })).toThrow();
    expect(() => validateManifest({ ...base, script: "mod.html" })).toThrow();
  });
  it("rejects bad theme colors", () => {
    expect(() => validateManifest({ ...base, themes: [{ name: "t", tokens: { primary: "red;}" } }] })).toThrow();
  });
});

it("fills command templates", () => expect(fillCommand("Summarize:\n{{ input }}", "hello")).toBe("Summarize:\nhello"));
