import { describe, expect, it } from "vitest";
import { coolDown, freeId, freePool } from "./free-models";
import type { SavedConnection } from "./store";

const conn = (id: string, providerId: string, models: string[]) =>
  ({ id, providerId, apiKey: "k", label: id, models: models.map((m) => ({ id: m, name: m })), addedAt: 0 }) as SavedConnection;

describe("freePool", () => {
  const conns = [conn("g", "groq", ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]), conn("c", "cerebras", ["gpt-oss-120b"]), conn("a", "anthropic", ["claude-x"])];

  it("takes the best of each free company first and leaves out paid ones", () => {
    expect(freePool(conns, 0).map(freeId)).toEqual(["g|llama-3.3-70b-versatile", "c|gpt-oss-120b", "g|llama-3.1-8b-instant"]);
  });

  it("moves models at their limit to the end until their rest is over", () => {
    coolDown([{ id: "g|llama-3.3-70b-versatile", wait: 600 }], 1000);
    expect(freePool(conns, 2000).map(freeId)).toEqual(["c|gpt-oss-120b", "g|llama-3.1-8b-instant", "g|llama-3.3-70b-versatile"]);
    expect(freePool(conns, 1000 + 601_000)[0]).toEqual({ connectionId: "g", modelId: "llama-3.3-70b-versatile" });
  });
});
