import { describe, expect, it } from "vitest";
import { featuredModels } from "./featured";

const m = (...ids: string[]) => ids.map((id) => ({ id, name: id }));

describe("featured models", () => {
  it("picks the newest of each Claude family", () => {
    const f = featuredModels("anthropic", m("claude-3-haiku-20240307", "claude-opus-4-1-20250805", "claude-opus-5-5", "claude-sonnet-5-5", "claude-sonnet-4-5-20250929", "claude-haiku-5-5"));
    expect(f.map((x) => x.id)).toEqual(["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]);
  });
  it("keeps Gemini to Pro, Flash and Flash-Lite and skips image, speech and old ones", () => {
    const f = featuredModels("google", m("gemini-2.5-pro", "gemini-1.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-image", "gemini-2.5-flash-preview-tts", "gemini-2.5-flash-lite", "gemini-3-pro-preview", "embedding-001"));
    expect(f.map((x) => x.id)).toEqual(["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"]);
  });
  it("returns nothing for companies without a short list", () => {
    expect(featuredModels("groq", m("llama-3.3-70b"))).toEqual([]);
  });
});
