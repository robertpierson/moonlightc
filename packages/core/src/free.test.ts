import { describe, expect, it } from "vitest";
import { fallbackModel, freeCandidates, FREE_PROVIDERS, interleave, shouldFailOver, sizeInB } from "./free";

const m = (id: string, contextLength?: number) => ({ id, name: id, contextLength });

describe("free providers", () => {
  it("lists only companies with a free plan, never local or hidden ones", () => {
    const ids = FREE_PROVIDERS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["google", "groq", "cerebras", "mistral", "openrouter", "cohere"]));
    expect(ids).not.toContain("anthropic");
    expect(ids).not.toContain("ollama");
  });
});

describe("freeCandidates", () => {
  it("takes only :free models from OpenRouter", () => {
    const got = freeCandidates("openrouter", [m("meta-llama/llama-3.3-70b-instruct"), m("deepseek/deepseek-r1:free"), m("qwen/qwen3-235b-a22b:free")]);
    expect(got.map((x) => x.id)).toEqual(["qwen/qwen3-235b-a22b:free", "deepseek/deepseek-r1:free"]);
  });
  it("prefers bigger models and skips safety and speech models", () => {
    const got = freeCandidates("groq", [m("allam-2-7b"), m("llama-guard-4-12b"), m("llama-3.3-70b-versatile"), m("whisper-large-v3"), m("openai/gpt-oss-120b")]);
    expect(got.map((x) => x.id)).toEqual(["openai/gpt-oss-120b", "llama-3.3-70b-versatile"]);
  });
  it("gives nothing for a company without a free plan", () => expect(freeCandidates("anthropic", [m("claude-x")])).toEqual([]));
  it("reads sizes", () => {
    expect(sizeInB("mixtral-8x7b-32768")).toBe(56);
    expect(sizeInB("llama-3.1-8b-instant")).toBe(8);
    expect(sizeInB("gemini-flash")).toBe(0);
  });
});

describe("interleave", () => {
  it("takes the first of each list, then the second", () => expect(interleave([["a1", "a2"], ["b1"], ["c1", "c2"]])).toEqual(["a1", "b1", "c1", "a2", "c2"]));
});

describe("shouldFailOver", () => {
  const err = (statusCode?: number) => Object.assign(new Error("x"), { statusCode });
  it("moves on for limits, plans, missing models and outages", () => {
    for (const s of [402, 403, 404, 408, 429, 500, 503]) expect(shouldFailOver(err(s)), String(s)).toBe(true);
  });
  it("stops on a bad request or a key that's wrong, and when the person stopped it", () => {
    expect(shouldFailOver(err(400))).toBe(false);
    expect(shouldFailOver(err(401))).toBe(false);
    expect(shouldFailOver(Object.assign(new Error("stop"), { name: "AbortError" }))).toBe(false);
  });
  it("moves on when the network failed", () => expect(shouldFailOver(new TypeError("fetch failed"))).toBe(true));
});

describe("fallbackModel", () => {
  const model = (name: string, outcome: "ok" | number) => ({
    specificationVersion: "v4",
    provider: name,
    modelId: name,
    supportedUrls: {},
    doGenerate: async (_o?: unknown) => (outcome === "ok" ? { text: name } : Promise.reject(Object.assign(new Error(name), { statusCode: outcome }))),
    doStream: async (_o?: unknown) => (outcome === "ok" ? { stream: name } : Promise.reject(Object.assign(new Error(name), { statusCode: outcome }))),
  });
  it("skips models at their limit and says which one answered", async () => {
    let used = -1;
    const f = fallbackModel([model("a", 429), model("b", 503), model("c", "ok")], (i) => (used = i));
    expect(await f.doStream({})).toEqual({ stream: "c" });
    expect(used).toBe(2);
    expect(f.modelId).toBe("free");
  });
  it("reports the last error when every model fails", async () => {
    await expect(fallbackModel([model("a", 429), model("b", 429)]).doGenerate({})).rejects.toThrow("b");
  });
  it("doesn't move on from a bad request", async () => {
    await expect(fallbackModel([model("a", 400), model("b", "ok")]).doGenerate({})).rejects.toThrow("a");
  });
  it("doesn't move on once the person stopped", async () => {
    const stop = new AbortController();
    stop.abort();
    await expect(fallbackModel([model("a", 429), model("b", "ok")]).doGenerate({ abortSignal: stop.signal })).rejects.toThrow("a");
  });
});
