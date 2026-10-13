import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { money, summarizeUsage } from "./usage";

const now = Date.UTC(2026, 9, 13, 12);
const reply = (modelId: string, input: number, output: number, at: number): UIMessage => ({ id: String(Math.random()), role: "assistant", parts: [], metadata: { usage: { inputTokens: input, outputTokens: output }, modelId, createdAt: at } });

describe("usage", () => {
  it("adds up tokens and cost by model and by day", () => {
    const chats = [
      { messages: [{ id: "u", role: "user", parts: [] } as UIMessage, reply("a", 1000, 500, now), reply("b", 200, 100, now - 86_400_000)] },
      { messages: [reply("a", 1000, 500, now), reply("a", 9, 9, now - 40 * 86_400_000)] },
    ];
    const s = summarizeUsage(chats, [{ id: "a", name: "A", pricing: { input: 3, output: 15 } }], now);
    expect(s.total.messages).toBe(3);
    expect(s.total.tokens).toBe(3300);
    expect(s.byModel[0]).toMatchObject({ modelId: "a", messages: 2, input: 2000, output: 1000 });
    expect(s.byModel[0].cost).toBeCloseTo(0.021);
    expect(s.byModel[1].cost).toBeUndefined();
    expect(s.today.tokens).toBe(3000);
    expect(s.daily).toHaveLength(30);
    expect(s.daily[28].tokens).toBe(300);
    expect(money(0.021)).toBe("$0.02");
    expect(money(0.0012)).toBe("$0.0012");
  });
});
