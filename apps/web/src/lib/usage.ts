import { estimateCost, type ModelInfo } from "@moonc/core";
import type { UIMessage } from "ai";
import type { Subscription } from "./subscriptions";

// Usage on this device, added up from the token counts each AI reply carries.

type Meta = { usage?: { inputTokens?: number; outputTokens?: number }; modelId?: string; createdAt?: number };
export type ModelUsage = { modelId: string; messages: number; input: number; output: number; cost?: number };
export type DayUsage = { day: string; tokens: number; cost: number };

const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

export function summarizeUsage(chats: { messages: UIMessage[] }[], models: ModelInfo[], now = Date.now(), days = 30) {
  const since = now - days * 86_400_000;
  const byModel = new Map<string, ModelUsage>();
  const byDay = new Map<string, DayUsage>();
  for (const chat of chats)
    for (const m of chat.messages) {
      const meta = m.metadata as Meta | undefined;
      if (m.role !== "assistant" || !meta?.usage || !meta.createdAt || meta.createdAt < since) continue;
      const input = meta.usage.inputTokens ?? 0;
      const output = meta.usage.outputTokens ?? 0;
      const id = meta.modelId ?? "unknown";
      const info = models.find((x) => x.id === id);
      const cost = info ? estimateCost(info, input, output) : undefined;
      const row = byModel.get(id) ?? { modelId: id, messages: 0, input: 0, output: 0 };
      row.messages++;
      row.input += input;
      row.output += output;
      if (cost !== undefined) row.cost = (row.cost ?? 0) + cost;
      byModel.set(id, row);
      const d = dayOf(meta.createdAt);
      const day = byDay.get(d) ?? { day: d, tokens: 0, cost: 0 };
      day.tokens += input + output;
      day.cost += cost ?? 0;
      byDay.set(d, day);
    }
  const models_ = [...byModel.values()].sort((a, b) => b.input + b.output - (a.input + a.output));
  const total = models_.reduce((t, r) => ({ messages: t.messages + r.messages, tokens: t.tokens + r.input + r.output, cost: t.cost + (r.cost ?? 0) }), { messages: 0, tokens: 0, cost: 0 });
  const today = byDay.get(dayOf(now)) ?? { day: dayOf(now), tokens: 0, cost: 0 };
  const daily: DayUsage[] = Array.from({ length: days }, (_, i) => dayOf(now - (days - 1 - i) * 86_400_000)).map((d) => byDay.get(d) ?? { day: d, tokens: 0, cost: 0 });
  return { total, today, byModel: models_, daily };
}

export const money = (n: number) => (n === 0 ? "$0" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);

// ---------- Plans and "what it would cost" ----------

const AI_SERVICE = /chatgpt|openai|claude|anthropic|gemini|google one|copilot|perplexity|cursor|midjourney|openrouter|mistral|grok|super ?grok|poe\b|character\.?ai|runway|elevenlabs|suno|windsurf|\bv0\b|lovable|replit|bolt|deepseek|notebooklm/i;
export const isAiPlan = (s: Pick<Subscription, "service">) => AI_SERVICE.test(s.service);

/** What a typical top model charges per million tokens (in, out); used for models without a listed price. */
export const REFERENCE_PRICE = { input: 3, output: 15 };

/** Tokens this month and what they'd cost at list prices (falling back to the reference price). */
export function monthValue(chats: { messages: UIMessage[] }[], models: ModelInfo[], now = Date.now()) {
  const day = new Date(now).getDate();
  const s = summarizeUsage(chats, models, now, day);
  let listValue = 0;
  let estimated = false;
  for (const r of s.byModel) {
    if (r.cost !== undefined) listValue += r.cost;
    else {
      listValue += (r.input * REFERENCE_PRICE.input + r.output * REFERENCE_PRICE.output) / 1e6;
      estimated = true;
    }
  }
  return { tokens: s.total.tokens, spent: s.total.cost, listValue, estimated, byModel: s.byModel };
}

/** "10 billion", "3.4 million", "950". */
export const bigNumber = (n: number) => new Intl.NumberFormat("en", { notation: "compact", compactDisplay: "long", maximumFractionDigits: 1 }).format(n);
