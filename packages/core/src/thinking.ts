// "How hard should it think?" per company and model, mapped to each API's own setting.
// Claude 4.6+: adaptive thinking + effort (newest Claude models reject "thinking off" and sampling settings).
// Gemini 3: thinkingLevel. Gemini 2.5: a thinking token budget. OpenAI reasoning models: reasoningEffort.

export type ThinkingLevel = "off" | "low" | "medium" | "high" | "xhigh" | "max";
export const THINKING_LABELS: Record<ThinkingLevel, string> = { off: "Off", low: "Low", medium: "Medium", high: "High", xhigh: "Extra high", max: "Max" };

const claudeAdaptive = (id: string) => /claude-(opus|sonnet|haiku|fable|mythos)-(4-[6-9]|[5-9])/.test(id);
const claudeNoXhigh = (id: string) => /claude-(opus|sonnet)-4-6/.test(id);
const gemini3 = (id: string) => /gemini-[3-9]/.test(id);
const gemini25 = (id: string) => /gemini-2\.5/.test(id);
const openaiReasoning = (id: string) => /^(gpt-5|o\d)/.test(id);

/** Levels this model accepts (empty: it has no thinking setting). */
export function thinkingLevels(providerId: string, modelId: string): ThinkingLevel[] {
  if (providerId === "anthropic" && claudeAdaptive(modelId)) return claudeNoXhigh(modelId) ? ["low", "medium", "high", "max"] : ["low", "medium", "high", "xhigh", "max"];
  // Gemini 2.5 Flash models can think not at all; Pro always thinks a little.
  if (providerId === "google" && gemini25(modelId) && /flash/.test(modelId)) return ["off", "low", "medium", "high"];
  if (providerId === "google" && (gemini3(modelId) || gemini25(modelId))) return ["low", "medium", "high"];
  if (providerId === "openai" && openaiReasoning(modelId)) return ["off", "low", "medium", "high"];
  return [];
}

/** Settings to send for a chosen level, and whether this model refuses temperature. */
export function thinkingOptions(providerId: string, modelId: string, level?: string): { providerOptions?: Record<string, Record<string, unknown>>; noTemperature: boolean } {
  const noTemperature = providerId === "anthropic" && claudeAdaptive(modelId) && !/4-6/.test(modelId);
  const levels = thinkingLevels(providerId, modelId);
  if (!level || !levels.includes(level as ThinkingLevel)) return { noTemperature };
  if (providerId === "anthropic") return { noTemperature, providerOptions: { anthropic: { thinking: { type: "adaptive" }, effort: level } } };
  if (providerId === "google")
    return {
      noTemperature,
      providerOptions: { google: { thinkingConfig: gemini3(modelId) ? { thinkingLevel: level } : { thinkingBudget: { off: 0, low: 1024, medium: 8192, high: 24576 }[level as "off" | "low" | "medium" | "high"] } } },
    };
  return { noTemperature, providerOptions: { openai: { reasoningEffort: level === "off" ? "minimal" : level } } };
}
