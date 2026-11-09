import type { CSSProperties } from "react";
import { ScrollProgress } from "./motion";

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
const TOOLS = [
  "Voice",
  "Memory",
  "Deep research",
  "Projects",
  "Studio",
  "Remote control",
  "Code",
  "Live previews",
  "Private mode",
  "Plugins",
  "Connections",
  "Your keys",
];

/** A brand mark drawn in the current text color. */
export function BrandMark({ icon, className = "" }: { icon: string; className?: string }) {
  return <i aria-hidden className={`brand-mark ${className}`} style={{ "--m": `url(/brands/${icon}.svg)` } as CSSProperties} />;
}

const ROWS = 7;
const COLS = 15;
const TONES = [
  ["#eceef2", "#c9ced8"],
  ["#e4e7ed", "#bfc5d0"],
  ["#f1f2f5", "#d3d7df"],
  ["#dfe3ea", "#b6bdca"],
];

// Fixed seed, so the wall is the same on every visit (and on the server and in the browser).
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Stone = {
  r: number;
  c: number;
  len: number;
  label?: string;
  icon?: string;
  dark?: boolean;
  style: CSSProperties;
};

function buildWall(): Stone[][] {
  const rnd = seeded(7);
  const n = (x: number) => Math.round(x * 1000) / 1000;
  const cx = (COLS - 1) / 2;
  const cy = (ROWS - 1) / 2;
  const maxLen = Math.hypot(cx * 1.35, cy);
  const stones: Stone[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const dx = (c - cx) * 1.35;
      const dy = r - cy;
      const len = Math.hypot(dx, dy);
      const [tone, shade] = TONES[Math.floor(rnd() * TONES.length)];
      const radius = Array.from({ length: 8 }, () => `${Math.round(38 + rnd() * 24)}%`);
      stones.push({
        r,
        c,
        len,
        // The wave: each stone leaves away from the middle, the middle first and the edges last.
        style: {
          "--r": n(1.05 + rnd() * 0.7),
          "--br": `${radius.slice(0, 4).join(" ")} / ${radius.slice(4).join(" ")}`,
          "--c": tone,
          "--c2": shade,
          "--rot": `${Math.round((rnd() * 2 - 1) * 40)}deg`,
          "--tx": len ? n(dx / len) : 0,
          "--ty": len ? n(dy / len) : 1,
          "--w": n(len / maxLen),
        } as CSSProperties,
      });
    }
  // Labels go on the stones nearest the middle first, so even a phone sees the main ones.
  const labels: { label: string; icon?: string }[] = [];
  for (let i = 0; i < Math.max(BRANDS.length, TOOLS.length); i++) {
    if (BRANDS[i]) labels.push({ icon: BRANDS[i][0], label: BRANDS[i][1] });
    if (TOOLS[i]) labels.push({ label: TOOLS[i] });
  }
  const byDistance = [...stones].sort((a, b) => a.len - b.len);
  labels.forEach((l, i) =>
    Object.assign(byDistance[i], l, {
      dark: ["claude", "openai", "gemini"].includes(l.icon ?? ""),
    }),
  );
  return Array.from({ length: ROWS }, (_, r) => stones.filter((s) => s.r === r));
}

const WALL = buildWall();

/**
 * A wall of moon stones that fills the screen, each one a model or a tool. Scrolling pushes the stones out in a wave
 * from the middle, and what's behind them shows: everything, in one window.
 */
export function StoneWall() {
  return (
    <section aria-labelledby="stones" className="stone-scene">
      <ScrollProgress name="--sp" />
      <div className="stone-sticky">
        <div className="stone-reveal">
          <h2 id="stones" className="text-[clamp(2.6rem,7vw,5.5rem)] leading-[1.0]">
            One window for all of it.
          </h2>
          <p className="mx-auto mt-5 max-w-[36ch] text-lg text-[var(--mist)] sm:text-xl">
            Every model and every tool you&apos;d otherwise juggle, in one app, with your own keys.
          </p>
        </div>
        <div aria-hidden className="stone-wall">
          {WALL.map((row, r) => (
            <div key={r} className="stone-row">
              {row.map((s) => (
                <span key={s.c} className="stone" data-dark={s.dark || undefined} style={s.style}>
                  {s.icon && <BrandMark icon={s.icon} className="stone-mark" />}
                  {s.label}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
