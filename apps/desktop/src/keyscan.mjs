// Finds AI keys already set up on this computer (the standard environment variables that tools like the OpenAI
// and Anthropic SDKs, Claude Code or Cursor read). Nothing is added until the person picks keys in the app.
import { execFileSync } from "node:child_process";

const VARS = {
  OPENAI_API_KEY: "openai",
  ANTHROPIC_API_KEY: "anthropic",
  OPENROUTER_API_KEY: "openrouter",
  GEMINI_API_KEY: "google",
  GOOGLE_API_KEY: "google",
  GOOGLE_GENERATIVE_AI_API_KEY: "google",
  XAI_API_KEY: "xai",
  MISTRAL_API_KEY: "mistral",
  DEEPSEEK_API_KEY: "deepseek",
  GROQ_API_KEY: "groq",
  TOGETHER_API_KEY: "together",
  PERPLEXITY_API_KEY: "perplexity",
  PPLX_API_KEY: "perplexity",
  COHERE_API_KEY: "cohere",
  FAL_KEY: "fal",
  REPLICATE_API_TOKEN: "replicate",
  ELEVENLABS_API_KEY: "elevenlabs",
};

/** User-level variables saved in Windows (so keys set after this app started are found too). */
function windowsUserVars() {
  if (process.platform !== "win32") return {};
  try {
    const out = execFileSync("reg", ["query", "HKCU\Environment"], { encoding: "utf8", windowsHide: true, timeout: 5000 });
    return Object.fromEntries(
      out
        .split(/\r?\n/)
        .map((l) => l.trim().match(/^(\S+)\s+REG_(?:EXPAND_)?SZ\s+(.+)$/))
        .filter(Boolean)
        .map((m) => [m[1], m[2]]),
    );
  } catch {
    return {};
  }
}

export function scanKeys() {
  const env = { ...windowsUserVars(), ...process.env };
  const seen = new Set();
  const found = [];
  for (const [name, provider] of Object.entries(VARS)) {
    const value = String(env[name] ?? "").trim();
    if (value.length < 16 || seen.has(value)) continue;
    seen.add(value);
    found.push({ provider, source: name, value, masked: `${value.slice(0, 4)}…${value.slice(-4)}` });
  }
  return found;
}
