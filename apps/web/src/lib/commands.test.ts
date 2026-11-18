import { describe, expect, it } from "vitest";
import { BUILT_IN, fill, find, matchModel, mine, parse, suggest } from "./commands";

const all = [...mine([{ name: "tweet", prompt: "Turn this into a tweet: {input}" }, { name: "explain", prompt: "Explain like a pirate" }]), ...BUILT_IN];

describe("commands", () => {
  it("reads the name and what follows", () => {
    expect(parse("/translate spanish good morning")).toEqual({ name: "translate", input: "spanish good morning" });
    expect(parse("/new")).toEqual({ name: "new", input: "" });
    expect(parse("/plug:cmd x")).toEqual({ name: "plug:cmd", input: "x" });
    expect(parse("hello /new")).toBeUndefined();
  });

  it("fills prompts, with the first word and the rest for translate", () => {
    expect(fill(find("translate", all)!, "french hi there")).toBe("Translate this into french. Reply with only the translation:\n\nhi there");
    expect(fill(find("summarize", all)!, "")).toMatch(/our conversation/);
    expect(fill(find("tweet", all)!, "cats rule")).toBe("Turn this into a tweet: cats rule");
  });

  it("lets your own command replace a built-in one with the same name", () => {
    expect(find("explain", all)!.from).toBe("Yours");
    expect(fill(find("explain", all)!, "taxes")).toBe("Explain like a pirate\n\ntaxes");
  });

  it("suggests while typing, best matches first", () => {
    expect(suggest("/tr", all).map((c) => c.name)[0]).toBe("translate");
    expect(suggest("/", all).length).toBe(all.length);
    expect(suggest("/tr hi", all)).toEqual([]);
  });

  it("finds a model from plain words", () => {
    const models = [
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
      { id: "claude-sonnet-4-5-thinking", name: "Claude Sonnet 4.5 (thinking)" },
      { id: "gpt-5", name: "GPT-5" },
    ];
    expect(matchModel("sonnet", models)?.id).toBe("claude-sonnet-4-5");
    expect(matchModel("GPT", models)?.id).toBe("gpt-5");
    expect(matchModel("gemini", models)).toBeUndefined();
  });
});
