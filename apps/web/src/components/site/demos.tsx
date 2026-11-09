"use client";

// Animated pictures of the app for the marketing site. They're illustrations: nothing in here is clickable or focusable.
// Each one only animates while on screen, and shows a still final frame under prefers-reduced-motion.
import { useEffect, useRef, useState } from "react";

function useActive<T extends Element>() {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !ref.current) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.2 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return [ref, on] as const;
}

/** Steps 0..count-1 every `ms` while visible; sits on the last step when motion is reduced. */
function useStep<T extends Element>(count: number, ms: number) {
  const [ref, on] = useActive<T>();
  const [step, setStep] = useState(count - 1);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setStep((s) => (s + 1) % count), ms);
    return () => clearInterval(t);
  }, [on, count, ms]);
  return [ref, step] as const;
}

const MODELS = [
  ["Anthropic", "Claude"],
  ["OpenAI", "GPT"],
  ["Google", "Gemini"],
  ["xAI", "Grok"],
  ["Mistral", "Mistral"],
  ["DeepSeek", "DeepSeek"],
];

export function ModelMenu() {
  const [ref, step] = useStep<HTMLDivElement>(MODELS.length, 1300);
  return (
    <div ref={ref} aria-hidden className="app-dark pointer-events-none w-full max-w-sm rounded-2xl border border-white/10 p-2 text-[13px] shadow-2xl shadow-[#0e1628]/40">
      <div className="px-2.5 pt-1 pb-2 text-[11px] text-white/60">Models from your keys</div>
      {MODELS.map(([co, m], i) => (
        <div key={co} className={`flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors duration-300 ${i === step ? "bg-[#2c3b5e] text-white" : "text-white/75"}`}>
          <span>{m}</span>
          <span className={`text-[11px] ${i === step ? "text-white/80" : "text-white/60"}`}>{co}</span>
        </div>
      ))}
    </div>
  );
}

const ROUTES = [
  ["Fix this TypeError in my script", "Coding"],
  ["Compare these two job offers", "Deep thinking"],
  ["What's 15% of 80?", "Quick"],
  ["Draw a fox in a space suit", "Images"],
];

export function AutoRoutes() {
  const [ref, step] = useStep<HTMLDivElement>(ROUTES.length + 2, 1100);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none grid w-full max-w-sm gap-2 text-[13px]">
      {ROUTES.map(([q, m], i) => (
        <div
          key={q}
          className={`flex items-center justify-between gap-3 rounded-xl bg-white/90 px-3.5 py-2.5 text-[var(--ink)] shadow-sm transition-all duration-500 ${i <= step ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
        >
          <span className="truncate">{q}</span>
          <span className="shrink-0 rounded-full bg-[#e6e9f0] px-2 py-0.5 text-[11px] font-medium text-[#24365f]">{m}</span>
        </div>
      ))}
    </div>
  );
}

/** A laptop showing the PC's screen, with the pointer moving and clicking. */
export function RemoteScreen() {
  const [ref, step] = useStep<HTMLDivElement>(4, 1600);
  const spots = [
    [22, 30],
    [64, 44],
    [40, 70],
    [78, 24],
  ];
  const [x, y] = spots[step];
  return (
    <div ref={ref} aria-hidden className="pointer-events-none relative mx-auto w-full max-w-2xl">
      <div className="rounded-t-2xl bg-gradient-to-b from-[#d9dee7] to-[#b9c1ce] p-2.5 pb-3 shadow-[inset_0_1px_0_#fff]">
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-[radial-gradient(80%_80%_at_70%_20%,#5a6f99,#1e2a46_60%,#0e1527)]">
          <div className="absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-[var(--ink)] shadow">
            Connected to Home PC
          </div>
          <div className="absolute top-[18%] left-[10%] h-[46%] w-[46%] rounded-md bg-white/95 p-2 shadow-xl">
            <div className="h-1.5 w-1/3 rounded bg-[#c9d1dd]" />
            <div className="mt-2 grid gap-1">
              {[90, 70, 80, 55].map((w) => (
                <div key={w} className="h-1.5 rounded bg-[#e3e7ee]" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
          <div className="absolute top-[40%] left-[48%] h-[42%] w-[40%] rounded-md bg-[#0d121d] p-2 font-mono text-[9px] leading-tight text-[#b9c6e4] shadow-xl">
            PS C:\&gt; npm run build
            <br />
            <span className="text-white/60">✓ built in 4.2s</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1.5 bg-white/20 py-1.5 backdrop-blur">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="size-3 rounded-sm bg-white/70" />
            ))}
          </div>
          <svg
            viewBox="0 0 16 16"
            className="absolute size-5 drop-shadow transition-all duration-[1100ms] ease-[cubic-bezier(.4,.1,.2,1)]"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <path d="M2 1l11 7-5 1 3 5-2 1-3-5-4 3z" fill="#fff" stroke="#0b1530" strokeWidth="1" />
          </svg>
          <span key={step} className="absolute size-8 -translate-x-1/3 -translate-y-1/3 animate-ping rounded-full bg-white/50 [animation-delay:1.1s] [animation-iteration-count:1]" style={{ left: `${x}%`, top: `${y}%` }} />
        </div>
      </div>
      <div className="mx-[-4%] h-3 rounded-b-xl bg-gradient-to-b from-[#c9d0db] to-[#9aa4b4]" />
    </div>
  );
}

const CODE = ["$ claude", "Reading 4 files in src/", "Edited src/cart.ts (+12 −3)", "Running npm test", "✓ 38 tests passed"];

export function CodeTerminal() {
  const [ref, step] = useStep<HTMLDivElement>(CODE.length + 2, 900);
  return (
    <div ref={ref} aria-hidden className="app-dark pointer-events-none h-full rounded-xl p-4 font-mono text-[11.5px] leading-6">
      <div className="mb-2 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2 rounded-full bg-white/20" />
        ))}
      </div>
      {CODE.map((l, i) => (
        <div key={l} className={`transition-opacity duration-300 ${i <= step ? "opacity-100" : "opacity-0"} ${l.startsWith("✓") ? "text-[#7ee2a8]" : i === 0 ? "text-[#b9c6e4]" : "text-white/75"}`}>
          {l}
        </div>
      ))}
    </div>
  );
}

export function BrowserTab() {
  const [ref, step] = useStep<HTMLDivElement>(4, 1500);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none relative h-full overflow-hidden rounded-xl bg-white text-[11px] shadow-[0_0_0_1px_var(--line)]">
      <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--silver-1)] px-3 py-2">
        <span className="size-2 rounded-full bg-[#c9d1dd]" />
        <span className="flex-1 truncate rounded-md bg-white px-2 py-0.5 text-[var(--faint)]">shop.example/cart</span>
      </div>
      <div className="mx-auto mt-2 w-max rounded-full [background:var(--g-brand)] px-3 py-1 font-medium text-white shadow">MoonlightC can see and use this tab · Stop</div>
      <div className="grid gap-1.5 p-4">
        <div className="h-2 w-1/2 rounded bg-[#dfe4ec]" />
        <div className="h-2 w-3/4 rounded bg-[#eef1f5]" />
        <div className="h-2 w-2/3 rounded bg-[#eef1f5]" />
        <div className={`mt-2 w-max rounded-md px-3 py-1 font-medium transition-colors ${step >= 1 ? "bg-[#24365f] text-white" : "bg-[#e7ebf1] text-[var(--ink)]"}`}>Place order</div>
      </div>
      <div
        className={`absolute inset-x-6 bottom-4 rounded-lg bg-white p-3 shadow-xl ring-1 ring-[var(--line)] transition-all duration-500 ${step >= 2 ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
      >
        <div className="font-medium text-[var(--ink)]">The AI wants to click &quot;Place order&quot;</div>
        <div className="mt-2 flex justify-end gap-1.5">
          <span className="rounded-full px-2.5 py-0.5 ring-1 ring-[var(--line)]">Deny</span>
          <span className={`rounded-full px-2.5 py-0.5 text-white ${step >= 3 ? "bg-[#121b31]" : "bg-[#2c3b5e]"}`}>Allow</span>
        </div>
      </div>
    </div>
  );
}

const LOCAL = ["Llama", "Qwen", "Gemma", "Mistral"];

export function LocalModels() {
  const [ref, step] = useStep<HTMLDivElement>(5, 1200);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none grid h-full content-center gap-2.5 rounded-xl bg-white p-4 text-[12px] shadow-[0_0_0_1px_var(--line)]">
      {LOCAL.map((m, i) => {
        const pct = step > i ? 100 : step === i ? 55 : 0;
        return (
          <div key={m}>
            <div className="flex justify-between">
              <span className="font-medium text-[var(--ink)]">{m}</span>
              <span className="text-[var(--faint)]">{pct === 100 ? "On your PC" : pct ? "Downloading" : "Download"}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--silver-2)]">
              <div className="h-full rounded-full [background:var(--g-brand)] transition-[width] duration-1000" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const COMPANIES_QC = ["Claude", "ChatGPT", "Gemini", "Grok", "Mistral", "DeepSeek", "Groq", "Perplexity"];

/** The real "Quick connect" grid from the app's key settings, with one company being connected. */
export function QuickConnect() {
  const [ref, step] = useStep<HTMLDivElement>(COMPANIES_QC.length, 1100);
  return (
    <div ref={ref} aria-hidden className="app-dark pointer-events-none w-full max-w-sm rounded-2xl border border-white/10 p-4 text-[12px] shadow-2xl shadow-[#0e1628]/40">
      <div className="text-[14px] font-semibold">Models and keys</div>
      <div className="mt-1 text-white/65">Pick a company, copy a key on its site, and MoonlightC checks it and connects.</div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {COMPANIES_QC.map((c, i) => (
          <div key={c} className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors duration-500 ${i < step ? "border-[#7fa7e0]/40 text-white" : "border-white/10 text-white/75"}`}>
            {c}
            <span className={`text-[10px] transition-opacity duration-500 ${i < step ? "opacity-100" : "opacity-0"}`}>✓</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const MODES = [
  ["Ask", "Every change and command waits for your OK."],
  ["Auto-accept edits", "File edits go through; commands still ask."],
  ["Plan", "It writes a plan first and changes nothing."],
  ["Bypass", "No questions. For throwaway projects only."],
];

/** The Code tab's permission modes, cycling. */
export function CodeModes() {
  const [ref, step] = useStep<HTMLDivElement>(MODES.length, 1600);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none grid w-full max-w-sm gap-2 text-[13px]">
      {MODES.map(([m, d], i) => (
        <div key={m} className={`rounded-xl px-4 py-3 transition-all duration-500 ${i === step ? "bg-[var(--ink)] text-white shadow-lg" : "bg-white text-[var(--ink)] shadow-sm"}`}>
          <div className="font-medium">{m}</div>
          <div className={i === step ? "text-white/75" : "text-[var(--mist)]"}>{d}</div>
        </div>
      ))}
    </div>
  );
}
