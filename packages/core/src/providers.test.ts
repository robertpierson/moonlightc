import { describe, expect, it } from "vitest";
import { estimateCost, getProvider, listModels, parseModels, ProviderError } from "./providers";

const json = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("listModels", () => {
  it("parses OpenRouter models with pricing per 1M tokens", async () => {
    const models = await listModels(
      { providerId: "openrouter", apiKey: "k" },
      json(200, { data: [{ id: "a/b", name: "B", context_length: 1000, pricing: { prompt: "0.000001", completion: "0.000002" } }] }),
    );
    expect(models).toEqual([{ id: "a/b", name: "B", contextLength: 1000, pricing: { input: 1, output: 2 } }]);
    expect(estimateCost(models[0], 1_000_000, 500_000)).toBe(2);
  });

  it("turns 401 into a human-readable message with the key URL", async () => {
    await expect(listModels({ providerId: "anthropic", apiKey: "bad" }, json(401, {}))).rejects.toThrow(/rejected this key.*console\.anthropic\.com/);
  });

  it("reports network failure", async () => {
    const fail = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(listModels({ providerId: "groq", apiKey: "k" }, fail)).rejects.toBeInstanceOf(ProviderError);
  });

  it("requires a base URL for custom providers", async () => {
    await expect(listModels({ providerId: "custom", apiKey: "" }, json(200, { data: [] }))).rejects.toThrow(/base URL/);
  });

  it("uses the custom base URL and strips trailing slash", async () => {
    let seen = "";
    const f = (async (u: string) => {
      seen = u;
      return new Response(JSON.stringify({ data: [{ id: "llama" }] }));
    }) as unknown as typeof fetch;
    await listModels({ providerId: "custom", apiKey: "", baseURL: "http://localhost:1234/v1/" }, f);
    expect(seen).toBe("http://localhost:1234/v1/models");
  });
});

describe("parseModels", () => {
  it("filters Google to generateContent models and strips the prefix", () => {
    const out = parseModels(getProvider("google"), {
      models: [
        { name: "models/gemini-x", displayName: "Gemini X", supportedGenerationMethods: ["generateContent"], inputTokenLimit: 9 },
        { name: "models/embed-1", supportedGenerationMethods: ["embedContent"] },
      ],
    });
    expect(out).toEqual([{ id: "gemini-x", name: "Gemini X", contextLength: 9 }]);
  });

  it("drops non-chat OpenAI models and accepts bare arrays", () => {
    const out = parseModels(getProvider("together"), [{ id: "text-embedding-3" }, { id: "whisper-1" }, { id: "chat-1" }]);
    expect(out.map((m) => m.id)).toEqual(["chat-1"]);
  });
});

describe.runIf(process.env.LIVE)("live", () => {
  it("lists real OpenRouter models (public endpoint)", async () => {
    const models = await listModels({ providerId: "openrouter", apiKey: "" });
    expect(models.length).toBeGreaterThan(50);
    expect(models.some((m) => m.pricing)).toBe(true);
  });
});

describe("Azure and Bedrock", () => {
  it("lists Azure deployments with the api-key header", async () => {
    const seen: { url: string; key?: string }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      seen.push({ url, key: (init.headers as Record<string, string>)["api-key"] });
      return new Response(JSON.stringify({ data: [{ id: "my-gpt", model: "gpt-5" }] }));
    }) as unknown as typeof fetch;
    const out = await listModels({ providerId: "azure", apiKey: "k1", baseURL: "https://res.openai.azure.com/" }, f);
    expect(out).toEqual([{ id: "my-gpt", name: "my-gpt (gpt-5)" }]);
    expect(seen[0]).toEqual({ url: "https://res.openai.azure.com/openai/deployments?api-version=2022-12-01", key: "k1" });
  });
  it("refuses endpoints that aren't Azure", async () => {
    await expect(listModels({ providerId: "azure", apiKey: "k", baseURL: "https://evil.example.com" })).rejects.toThrow(/Azure OpenAI endpoint/);
  });
  it("lists Bedrock inference profiles and models for a region", async () => {
    const f = (async (url: string) =>
      new Response(
        JSON.stringify(
          url.includes("inference-profiles")
            ? { inferenceProfileSummaries: [{ inferenceProfileId: "us.anthropic.claude-x", inferenceProfileName: "US Claude X" }] }
            : { modelSummaries: [{ modelId: "amazon.nova-pro-v1:0", modelName: "Nova Pro", providerName: "Amazon" }] },
        ),
      )) as unknown as typeof fetch;
    const out = await listModels({ providerId: "bedrock", apiKey: "k", baseURL: "us-east-1" }, f);
    expect(out.map((m) => m.id)).toEqual(["us.anthropic.claude-x", "amazon.nova-pro-v1:0"]);
    await expect(listModels({ providerId: "bedrock", apiKey: "k", baseURL: "mars-1" }, f)).rejects.toThrow(/region/);
  });
});
