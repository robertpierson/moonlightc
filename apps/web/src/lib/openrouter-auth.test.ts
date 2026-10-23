import { describe, expect, it } from "vitest";
import { firstModel } from "./openrouter-auth";

describe("first OpenRouter model", () => {
  it("starts on a free model from a known family, so a new account's first reply works", () => {
    expect(firstModel([{ id: "openai/gpt-x" }, { id: "some/odd:free" }, { id: "meta-llama/llama-z:free" }])).toBe("meta-llama/llama-z:free");
    expect(firstModel([{ id: "openai/gpt-x" }, { id: "some/odd:free" }])).toBe("some/odd:free");
    expect(firstModel([{ id: "openai/gpt-x" }])).toBe("openai/gpt-x");
  });
});
