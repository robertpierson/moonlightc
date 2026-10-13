import { describe, expect, it } from "vitest";
import { buildInstructions, relevantMemories } from "./context";

const mem = (text: string, i: number, projectId?: string) => ({ id: String(i), text, createdAt: i, projectId });

describe("relevantMemories", () => {
  it("keeps everything when there are few", () => expect(relevantMemories([mem("likes tea", 1)], "x")).toHaveLength(1));
  it("ranks by overlap and respects projects", () => {
    const items = [...Array.from({ length: 20 }, (_, i) => mem(`fact number ${i}`, i)), mem("favorite programming language is Rust", 99), mem("secret project detail", 100, "p2")];
    const out = relevantMemories(items, "which programming language should I use?", "p1");
    expect(out[0].text).toContain("Rust");
    expect(out.some((m) => m.projectId === "p2")).toBe(false);
    expect(out).toHaveLength(12);
  });
});

describe("buildInstructions", () => {
  it("combines mode, project and memory", () => {
    const s = buildInstructions({
      mode: "Be brief.",
      project: { id: "p", name: "Trip", instructions: "Plan in euros.", files: [{ name: "notes.md", text: "Lisbon in May" }], createdAt: 0 },
      memories: [mem("lives in Ohio", 1)],
      memoryOn: true,
    });
    expect(s).toContain("Be brief.");
    expect(s).toContain('project "Trip"');
    expect(s).toContain('<file name="notes.md">');
    expect(s).toContain("- lives in Ohio");
    expect(s).toContain("save_memory");
  });
  it("leaves memory out when it's off", () => expect(buildInstructions({ memoryOn: false, memories: [mem("x", 1)] })).toBe(""));
});
