import { describe, expect, it } from "vitest";
import { thinkingLevels, thinkingOptions } from "./thinking";

describe("thinking levels", () => {
  it("offers effort levels on current Claude models and none on old ones", () => {
    expect(thinkingLevels("anthropic", "claude-opus-5-5")).toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(thinkingLevels("anthropic", "claude-sonnet-4-6")).not.toContain("xhigh");
    expect(thinkingLevels("anthropic", "claude-3-haiku-20240307")).toEqual([]);
  });
  it("maps a level to each company's own setting", () => {
    expect(thinkingOptions("anthropic", "claude-sonnet-5-5", "high")).toEqual({ noTemperature: true, providerOptions: { anthropic: { thinking: { type: "adaptive" }, effort: "high" } } });
    expect(thinkingOptions("google", "gemini-3-pro-preview", "low").providerOptions).toEqual({ google: { thinkingConfig: { thinkingLevel: "low" } } });
    expect(thinkingOptions("google", "gemini-2.5-flash", "medium").providerOptions).toEqual({ google: { thinkingConfig: { thinkingBudget: 8192 } } });
    expect(thinkingOptions("openai", "gpt-5", "high").providerOptions).toEqual({ openai: { reasoningEffort: "high" } });
    expect(thinkingOptions("openai", "gpt-4o", "high").providerOptions).toBeUndefined();
  });
});
