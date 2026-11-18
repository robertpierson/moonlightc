import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { bigNumber, budgetState, contextUse, isAiPlan, monthValue, money, summarizeUsage } from "./usage";

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


describe("plans and list-price value", () => {
  it("values tokens at list prices, using a typical price when a model has none", () => {
    const chats = [{ messages: [reply("a", 1_000_000, 0, now), reply("local", 1_000_000, 1_000_000, now)] }];
    const v = monthValue(chats, [{ id: "a", name: "A", pricing: { input: 3, output: 15 } }], now);
    expect(v.tokens).toBe(3_000_000);
    expect(v.spent).toBeCloseTo(3);
    expect(v.listValue).toBeCloseTo(3 + 18);
    expect(v.estimated).toBe(true);
  });
  it("spots AI plans and writes big numbers in words", () => {
    expect(isAiPlan({ service: "ChatGPT Plus" })).toBe(true);
    expect(isAiPlan({ service: "Claude Pro" })).toBe(true);
    expect(isAiPlan({ service: "Netflix" })).toBe(false);
    expect(bigNumber(10_000_000_000)).toBe("10 billion");
    expect(bigNumber(3_400_000)).toBe("3.4 million");
  });
});

describe("context and budget", () => {
  const msg = (role: "user" | "assistant", text: string, usage?: { inputTokens: number; outputTokens: number }) =>
    ({ id: Math.random().toString(), role, parts: [{ type: "text", text }], metadata: usage ? { usage } : undefined }) as UIMessage;
  it("uses the last reply's token count when there is one", () => {
    expect(contextUse([msg("user", "hi"), msg("assistant", "hello", { inputTokens: 700, outputTokens: 100 })], 1000)).toEqual({ used: 800, pct: 0.8 });
  });
  it("estimates from the text otherwise, and says nothing without a known size", () => {
    expect(contextUse([msg("user", "x".repeat(400))], 1000)).toEqual({ used: 100, pct: 0.1 });
    expect(contextUse([msg("user", "hi")], undefined)).toBeUndefined();
  });
  it("flags a budget near its end and over it", () => {
    expect(budgetState(8, 10)).toEqual({ pct: 0.8, over: false, near: true });
    expect(budgetState(12, 10)?.over).toBe(true);
    expect(budgetState(5, undefined)).toBeUndefined();
  });
});
