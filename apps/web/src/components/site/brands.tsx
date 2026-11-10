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

/** The mark for each company in COMPANIES (and Ollama), by the name shown on the site. */
export const COMPANY_MARK: Record<string, string> = {
  Anthropic: "anthropic",
  OpenAI: "openai",
  "Google Gemini": "gemini",
  xAI: "xai",
  Mistral: "mistral",
  DeepSeek: "deepseek",
  Groq: "groq",
  "Together AI": "together",
  Perplexity: "perplexity",
  Cohere: "cohere",
  OpenRouter: "openrouter",
  "Azure OpenAI": "azure",
  "AWS Bedrock": "bedrock",
  "Ollama on your PC": "ollama",
};

/** A brand mark drawn in the current text color. */
export function BrandMark({ icon, className = "" }: { icon: string; className?: string }) {
  return <i aria-hidden className={`brand-mark ${className}`} style={{ "--m": `url(/brands/${icon}.svg)` } as CSSProperties} />;
}
