import { describe, expect, it } from "vitest";
import { checkMediaKey, listMediaModels } from "./studio";

const seq = (...bodies: unknown[]) => {
  const urls: string[] = [];
  const f = (async (u: string) => {
    urls.push(u);
    return new Response(JSON.stringify(bodies.shift()));
  }) as unknown as typeof fetch;
  return { f, urls };
};

describe("listMediaModels", () => {
  it("pages through fal's catalog for each video category", async () => {
    const m = (id: string) => ({ endpoint_id: id, metadata: { display_name: id } });
    const { f, urls } = seq(
      { models: [m("a/t2v")], has_more: true, next_cursor: "c1" },
      { models: [m("b/t2v")], has_more: false },
      { models: [m("c/i2v")], has_more: false },
    );
    const out = await listMediaModels({ providerId: "fal", apiKey: "k" }, "video", f);
    expect(out.map((x) => x.id)).toEqual(["a/t2v", "b/t2v", "c/i2v"]);
    expect(urls[1]).toContain("cursor=c1");
    expect(urls[2]).toContain("category=image-to-video");
  });

  it("keeps only image models from OpenAI's list", async () => {
    const { f } = seq({ data: [{ id: "gpt-5" }, { id: "gpt-image-2" }, { id: "dall-e-3" }, { id: "tts-1" }] });
    expect((await listMediaModels({ providerId: "openai", apiKey: "k" }, "image", f)).map((x) => x.id)).toEqual(["dall-e-3", "gpt-image-2"]);
  });

  it("turns a bad ElevenLabs key into a clear error", async () => {
    const f = (async () => new Response("{}", { status: 400 })) as unknown as typeof fetch;
    await expect(checkMediaKey({ providerId: "elevenlabs", apiKey: "x" }, f)).rejects.toThrow(/rejected this key/);
  });
});
