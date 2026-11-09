import type { CSSProperties } from "react";

/** AI brands with their marks (public/brands, from Lobe Icons, MIT) and the model name people know them by. */
export const BRANDS: [icon: string, name: string][] = [
  ["claude", "Claude"],
  ["openai", "GPT"],
  ["gemini", "Gemini"],
  ["grok", "Grok"],
  ["meta", "Llama"],
  ["mistral", "Mistral"],
  ["deepseek", "DeepSeek"],
  ["qwen", "Qwen"],
  ["perplexity", "Sonar"],
  ["ollama", "Ollama"],
  ["cohere", "Command"],
  ["kimi", "Kimi"],
  ["zhipu", "GLM"],
  ["openrouter", "OpenRouter"],
];

/** A brand mark drawn in the current text color. */
export function BrandMark({ icon, className = "" }: { icon: string; className?: string }) {
  return <i aria-hidden className={`brand-mark ${className}`} style={{ "--m": `url(/brands/${icon}.svg)` } as CSSProperties} />;
}
