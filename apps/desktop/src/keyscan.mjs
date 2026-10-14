// Finds AI keys already set up on this computer (the standard environment variables that tools like the OpenAI
// and Anthropic SDKs, Claude Code or Cursor read). Nothing is added until the person picks keys in the app.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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
    const out = execFileSync("reg", ["query", "HKCU\\Environment"], { encoding: "utf8", windowsHide: true, timeout: 5000 });
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

// Keys whose format gives away the company, whatever the variable is called.
const PREFIXES = [
  [/^sk-ant-/, "anthropic"],
  [/^sk-or-/, "openrouter"],
  [/^sk-proj-/, "openai"],
  [/^AIza[\w-]{30,}$/, "google"],
  [/^gsk_/, "groq"],
  [/^xai-/, "xai"],
  [/^pplx-/, "perplexity"],
  [/^r8_/, "replicate"],
];

/** .env files in your home folder and project folders up to two levels down (skipping installed packages). */
function envFiles() {
  const home = os.homedir();
  const out = [];
  const skip = /^(node_modules|\.git|AppData|Library|\.cache|\.npm|\.pnpm-store|Windows|Program Files.*)$/i;
  const walk = (dir, depth) => {
    let items;
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of items) {
      if (out.length > 200) return;
      const p = path.join(dir, d.name);
      if (d.isFile() && /^\.env(\.local|\.development)?$/.test(d.name)) out.push(p);
      else if (d.isDirectory() && depth < 2 && !skip.test(d.name)) walk(p, depth + 1);
    }
  };
  walk(home, 0);
  return out;
}

function parseEnv(file) {
  try {
    if (fs.statSync(file).size > 100_000) return [];
    return fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*["']?([^"'\s#]+)/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]);
  } catch {
    return [];
  }
}

export function scanKeys() {
  const seen = new Set();
  const found = [];
  const add = (name, value, where) => {
    value = String(value ?? "").trim();
    const provider = VARS[name] ?? PREFIXES.find(([re]) => re.test(value))?.[1];
    if (!provider || value.length < 16 || seen.has(value)) return;
    seen.add(value);
    found.push({ provider, source: where ? `${name} in ${where}` : name, value, masked: `${value.slice(0, 4)}…${value.slice(-4)}` });
  };
  const env = { ...windowsUserVars(), ...process.env };
  for (const name of Object.keys(VARS)) add(name, env[name]);
  const home = os.homedir();
  for (const f of envFiles()) for (const [name, value] of parseEnv(f)) add(name, value, path.relative(home, f) || f);
  return found;
}
