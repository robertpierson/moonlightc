import { describe, expect, it } from "vitest";
import { classifyTask, resolveAuto } from "./auto-model";

describe("auto model", () => {
  it("classifies tasks", () => {
    expect(classifyTask("what's in this?", true)).toBe("vision");
    expect(classifyTask("Why does my python script throw a KeyError?")).toBe("coding");
    expect(classifyTask("```\nfoo()\n```")).toBe("coding");
    expect(classifyTask("Solve this equation for x and show it step by step: 3x + 2 = 11")).toBe("thinking");
    expect(classifyTask("hi")).toBe("quick");
    expect(classifyTask("Write a friendly note to my neighbor thanking them for watering the plants while I was away.")).toBe("everyday");
  });
  it("falls back to the everyday pick", () => {
    const everyday = { connectionId: "a", modelId: "m1" };
    const coding = { connectionId: "a", modelId: "m2" };
    expect(resolveAuto("coding", { everyday, coding })).toBe(coding);
    expect(resolveAuto("thinking", { everyday })).toBe(everyday);
    expect(resolveAuto("quick", {})).toBeUndefined();
  });
});
