import type { ModelInfo } from "./providers";

// The few models most people want from each company, picked from the live list (never hard-coded names):
// the newest model of each family, preferring finished releases over previews and dated snapshots.
const FAMILIES: Record<string, RegExp[]> = {
  anthropic: [/opus/i, /sonnet/i, /haiku/i],
  google: [/^gemini-[\d.]+-pro(-latest)?$|^gemini-[\d.]+-pro-preview/i, /^gemini-[\d.]+-flash(-latest)?$|^gemini-[\d.]+-flash-preview/i, /^gemini-[\d.]+-flash-lite/i],
  openai: [/^gpt-\d+(\.\d+)?$/i, /^gpt-\d+(\.\d+)?-mini$/i, /^gpt-\d+(\.\d+)?-nano$/i],
  xai: [/^grok-\d+(\.\d+)?(-\d{4})?$/i, /^grok-[\d.]+-.*mini/i],
  mistral: [/^mistral-large-latest$/i, /^mistral-medium-latest$/i, /^mistral-small-latest$/i],
  deepseek: [/^deepseek-chat$/i, /^deepseek-reasoner$/i],
};
const SKIP = /image|tts|audio|live|embedding|vision|customtools|computer-use|thinking-exp|-exp-|search/i;

/** Version numbers in an id, for "newest first" (claude-opus-4-1-20250805 → [4, 1, 20250805]). */
const version = (id: string) => (id.match(/\d+/g) ?? []).map(Number);
const newer = (a: string, b: string) => {
  const [x, y] = [version(a), version(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};
const unfinished = (id: string) => /preview|exp|beta/i.test(id);

export function featuredModels(providerId: string, models: ModelInfo[]): ModelInfo[] {
  const families = FAMILIES[providerId];
  if (!families) return [];
  const out: ModelInfo[] = [];
  for (const re of families) {
    const matches = models.filter((m) => re.test(m.id) && !SKIP.test(m.id));
    if (!matches.length) continue;
    // Finished releases first, then the highest version (a dated snapshot only wins over an older version).
    matches.sort((a, b) => Number(unfinished(a.id)) - Number(unfinished(b.id)) || newer(b.id, a.id));
    const best = matches[0];
    if (!out.includes(best)) out.push(best);
  }
  return out;
}
