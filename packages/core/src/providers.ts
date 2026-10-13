import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

type Kind = "anthropic" | "google" | "openai" | "compat";

export interface ProviderDef {
  id: string;
  name: string;
  kind: Kind;
  /** Where the user creates a key. */
  keyUrl: string;
  /** Chat base URL for OpenAI-compatible providers. */
  baseURL?: string;
  /** Model list URL when it differs from `${baseURL}/models`. */
  modelsURL?: string;
}

export const PROVIDERS: ProviderDef[] = [
  { id: "openrouter", name: "OpenRouter", kind: "compat", baseURL: "https://openrouter.ai/api/v1", keyUrl: "https://openrouter.ai/settings/keys" },
  { id: "anthropic", name: "Anthropic", kind: "anthropic", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "openai", name: "OpenAI", kind: "openai", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "google", name: "Google Gemini", kind: "google", keyUrl: "https://aistudio.google.com/app/apikey" },
  { id: "xai", name: "xAI (Grok)", kind: "compat", baseURL: "https://api.x.ai/v1", keyUrl: "https://console.x.ai" },
  { id: "mistral", name: "Mistral", kind: "compat", baseURL: "https://api.mistral.ai/v1", keyUrl: "https://console.mistral.ai/api-keys" },
  { id: "deepseek", name: "DeepSeek", kind: "compat", baseURL: "https://api.deepseek.com", keyUrl: "https://platform.deepseek.com/api_keys" },
  { id: "groq", name: "Groq", kind: "compat", baseURL: "https://api.groq.com/openai/v1", keyUrl: "https://console.groq.com/keys" },
  { id: "together", name: "Together AI", kind: "compat", baseURL: "https://api.together.xyz/v1", keyUrl: "https://api.together.ai/settings/api-keys" },
  { id: "perplexity", name: "Perplexity", kind: "compat", baseURL: "https://api.perplexity.ai", modelsURL: "https://api.perplexity.ai/v1/models", keyUrl: "https://www.perplexity.ai/account/api/keys" },
  { id: "cohere", name: "Cohere", kind: "compat", baseURL: "https://api.cohere.ai/compatibility/v1", keyUrl: "https://dashboard.cohere.com/api-keys" },
  { id: "custom", name: "Custom (OpenAI-compatible URL)", kind: "compat", keyUrl: "" },
];

export function getProvider(id: string): ProviderDef {
  const p = PROVIDERS.find((x) => x.id === id);
  if (!p) throw new ProviderError(`Unknown provider "${id}".`);
  return p;
}

/** What a user saved: which provider, their key, and (for custom) the base URL. */
export interface Connection {
  providerId: string;
  apiKey: string;
  baseURL?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextLength?: number;
  /** USD per 1M tokens, only when the provider publishes it. */
  pricing?: { input: number; output: number };
}

export class ProviderError extends Error {}

function resolveBaseURL(p: ProviderDef, c: Connection): string {
  const url = (p.id === "custom" ? c.baseURL : p.baseURL)?.replace(/\/+$/, "");
  if (!url) throw new ProviderError("Enter the base URL of your OpenAI-compatible server (for example http://localhost:1234/v1).");
  return url;
}

// ponytail: name heuristic to hide non-chat models from OpenAI-style lists; refine per provider if users report misses.
const NON_CHAT = /embed|tts|whisper|dall-e|moderation|transcribe|rerank|image|audio|realtime|speech|sora|guard/i;

/** Fetch the live model list. Doubles as key validation: it throws a human-readable error on a bad key. */
export async function listModels(c: Connection, fetchFn: typeof fetch = fetch): Promise<ModelInfo[]> {
  const p = getProvider(c.providerId);
  let url: string;
  const headers: Record<string, string> = {};
  if (p.kind === "anthropic") {
    url = "https://api.anthropic.com/v1/models?limit=1000";
    headers["x-api-key"] = c.apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (p.kind === "google") {
    url = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000";
    headers["x-goog-api-key"] = c.apiKey;
  } else {
    url = p.modelsURL ?? `${p.kind === "openai" ? "https://api.openai.com/v1" : resolveBaseURL(p, c)}/models`;
    if (c.apiKey) headers.authorization = `Bearer ${c.apiKey}`;
  }

  let res: Response;
  try {
    res = await fetchFn(url, { headers });
  } catch {
    throw new ProviderError(`Couldn't reach ${p.name}. Check your internet connection${p.id === "custom" ? " and the server URL" : ""}, then try again.`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new ProviderError(`${p.name} rejected this key. Copy a fresh key${p.keyUrl ? ` from ${p.keyUrl}` : ""} and paste it again.`);
  }
  if (!res.ok) throw new ProviderError(`${p.name} returned an error (${res.status}). Try again in a minute.`);

  const body = (await res.json()) as Record<string, unknown>;
  return parseModels(p, body);
}

export function parseModels(p: ProviderDef, body: unknown): ModelInfo[] {
  const b = body as Record<string, unknown>;
  if (p.kind === "anthropic") {
    return (b.data as { id: string; display_name?: string }[]).map((m) => ({ id: m.id, name: m.display_name ?? m.id }));
  }
  if (p.kind === "google") {
    return (b.models as { name: string; displayName?: string; inputTokenLimit?: number; supportedGenerationMethods?: string[] }[])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => ({ id: m.name.replace(/^models\//, ""), name: m.displayName ?? m.name, contextLength: m.inputTokenLimit }));
  }
  // OpenAI-style: { data: [...] }; Together returns a bare array.
  const list = (Array.isArray(body) ? body : (b.data ?? b.models ?? [])) as {
    id: string;
    name?: string;
    context_length?: number;
    pricing?: { prompt?: string; completion?: string };
  }[];
  return list
    .filter((m) => typeof m.id === "string" && !NON_CHAT.test(m.id))
    .map((m) => {
      const input = Number(m.pricing?.prompt);
      const output = Number(m.pricing?.completion);
      return {
        id: m.id,
        name: m.name ?? m.id,
        contextLength: m.context_length,
        pricing: Number.isFinite(input) && Number.isFinite(output) && m.pricing ? { input: input * 1e6, output: output * 1e6 } : undefined,
      };
    })
    .sort((a, b2) => a.name.localeCompare(b2.name));
}

/** Build an AI SDK model for streamText. Call only server-side (web proxy) or in the desktop main process. */
export function languageModel(c: Connection, modelId: string): LanguageModel {
  const p = getProvider(c.providerId);
  switch (p.kind) {
    case "anthropic":
      return createAnthropic({ apiKey: c.apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey: c.apiKey })(modelId);
    case "openai":
      return createOpenAI({ apiKey: c.apiKey })(modelId);
    case "compat":
      return createOpenAICompatible({
        name: p.id,
        baseURL: resolveBaseURL(p, c),
        apiKey: c.apiKey || undefined,
        includeUsage: true,
        headers: p.id === "openrouter" ? { "HTTP-Referer": "https://moonlightc.vercel.app", "X-Title": "MoonlightC" } : undefined,
      })(modelId);
  }
}

/** Estimated USD cost of a message, when pricing is known. */
export function estimateCost(m: ModelInfo, inputTokens: number, outputTokens: number): number | undefined {
  if (!m.pricing) return undefined;
  return (inputTokens * m.pricing.input + outputTokens * m.pricing.output) / 1e6;
}

// Fixed, long-lived Whisper ids (not "latest" aliases). Only OpenAI and Groq offer Whisper over the API.
const WHISPER: Record<string, { baseURL: string; model: string }> = {
  openai: { baseURL: "https://api.openai.com/v1", model: "whisper-1" },
  groq: { baseURL: "https://api.groq.com/openai/v1", model: "whisper-large-v3-turbo" },
};

export const canTranscribe = (providerId: string) => providerId in WHISPER;

export function transcriptionModel(c: Connection) {
  const w = WHISPER[c.providerId];
  if (!w) throw new ProviderError("Voice typing needs an OpenAI or Groq key.");
  return createOpenAI({ apiKey: c.apiKey, baseURL: w.baseURL }).transcription(w.model);
}
