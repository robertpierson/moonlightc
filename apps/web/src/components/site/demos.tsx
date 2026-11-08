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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CHATS = [
  {
    model: "Claude",
    q: "Plan a 3-day trip to Chicago on a budget",
    a: "Day 1: Millennium Park and the Riverwalk, both free. Day 2: Lincoln Park Zoo (also free) and deep-dish pizza in Wicker Park. Day 3: rent a bike and ride the Lakefront Trail, then catch the sunset at North Avenue Beach.",
  },
  {
    model: "GPT",
    q: "Why does my Python loop print the same number?",
    a: "Your lambda captures the variable i, not its value, so every call sees the last one. Bind it as a default argument: lambda i=i: print(i).",
  },
  {
    model: "Gemini",
    q: "Summarize this PDF in 3 bullet points",
    a: "• Revenue grew 14% year over year, led by subscriptions.\n• Costs rose faster in Q3 because of new hiring.\n• The company expects flat margins next year.",
  },
];

const CHAT_TITLES = ["Chicago trip on a budget", "Python loop bug", "Quarterly report summary", "Birthday card ideas", "Spanish practice"];

/** The hero picture: the MoonlightC window with a conversation typing itself out. */
export function AppWindow() {
  const [ref, on] = useActive<HTMLDivElement>();
  const [s, setS] = useState({ i: 0, q: CHATS[0].q.length, a: CHATS[0].a.length, thinking: false });
  useEffect(() => {
    if (!on) return;
    let off = false;
    (async () => {
      for (let i = 0; !off; i = (i + 1) % CHATS.length) {
        const c = CHATS[i];
        for (let q = 0; q <= c.q.length && !off; q++) {
          setS({ i, q, a: 0, thinking: false });
          await wait(32);
        }
        await wait(300);
        setS({ i, q: c.q.length, a: 0, thinking: true });
        await wait(800);
        for (let a = 0; a <= c.a.length + 2 && !off; a += 3) {
          setS({ i, q: c.q.length, a, thinking: false });
          await wait(20);
        }
        await wait(2800);
      }
    })();
    return () => {
      off = true;
    };
  }, [on]);
  const c = CHATS[s.i];
  const sent = s.q >= c.q.length && (s.thinking || s.a > 0);
  return (
    <div ref={ref} aria-hidden className="app-dark pointer-events-none flex h-full select-none text-left text-[13px]">
      <aside className="hidden w-52 shrink-0 flex-col gap-1 border-r border-white/[0.07] bg-[#0d1530] p-3 md:flex">
        <div className="mb-2 flex items-center gap-2 px-2 py-1 font-semibold">
          <span className="size-4 rounded-full bg-gradient-to-br from-[#5b8cff] to-[#1d3a9c]" />
          MoonlightC
        </div>
        <div className="rounded-lg bg-white/[0.06] px-2 py-1.5">+ New chat</div>
        <div className="mt-3 px-2 text-[11px] text-white/60">Recent</div>
        {CHAT_TITLES.map((t, i) => (
          <div key={t} className={`truncate rounded-lg px-2 py-1.5 ${i === s.i ? "bg-white/[0.08] text-white" : "text-white/60"}`}>
            {i === s.i ? CHATS[s.i].q.slice(0, 26) : t}
          </div>
        ))}
        <div className="mt-auto px-2 py-1.5 text-white/65">Settings</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-center border-b border-white/[0.07] py-2.5">
          <div className="flex rounded-full bg-white/[0.06] p-0.5 text-[12px]">
            {["Chat", "Cowork", "Code"].map((t) => (
              <span key={t} className={`rounded-full px-3 py-1 ${t === "Chat" ? "bg-[#2a5bea] text-white" : "text-white/60"}`}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-hidden px-5 py-5 sm:px-10">
          {sent && <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-[#1f3270] px-3.5 py-2">{c.q}</div>}
          {sent && (
            <div className="max-w-[92%]">
              <div className="mb-1.5 flex items-center gap-2 text-[11px] text-white/65">
                <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-white/80">{c.model}</span>
                {s.thinking && <span className="animate-pulse">Thinking…</span>}
              </div>
              <p className="whitespace-pre-line leading-relaxed text-white/90">
                {c.a.slice(0, s.a)}
                {!s.thinking && s.a < c.a.length && <span className="caret" />}
              </p>
            </div>
          )}
        </div>
        <div className="p-3 sm:px-8 sm:pb-5">
          <div className="rounded-2xl border border-white/[0.1] bg-white/[0.04] p-3">
            <div className="min-h-5 text-white/90">
              {sent ? <span className="text-white/55">Message MoonlightC</span> : <span className="caret">{c.q.slice(0, s.q)}</span>}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px]">
              <span className="rounded-full border border-white/[0.12] px-2 py-0.5 text-white/70">+</span>
              <span className="rounded-full border border-white/[0.12] px-2 py-0.5 text-white/70">{c.model}</span>
              <span className="ml-auto grid size-6 place-items-center rounded-full bg-[#2a5bea] text-white">↑</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
    <div ref={ref} aria-hidden className="app-dark pointer-events-none w-full max-w-sm rounded-2xl border border-white/10 p-2 text-[13px] shadow-2xl shadow-[#0b1530]/40">
      <div className="px-2.5 pt-1 pb-2 text-[11px] text-white/60">Models from your keys</div>
      {MODELS.map(([co, m], i) => (
        <div key={co} className={`flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors duration-300 ${i === step ? "bg-[#2a5bea] text-white" : "text-white/75"}`}>
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
          <span className="shrink-0 rounded-full bg-[#e8eefc] px-2 py-0.5 text-[11px] font-medium text-[#1640c4]">{m}</span>
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
        <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-[radial-gradient(80%_80%_at_70%_20%,#6d8fe8,#22357a_60%,#0d1636)]">
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
          <div className="absolute top-[40%] left-[48%] h-[42%] w-[40%] rounded-md bg-[#0a1022] p-2 font-mono text-[9px] leading-tight text-[#8fb0ff] shadow-xl">
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
        <div key={l} className={`transition-opacity duration-300 ${i <= step ? "opacity-100" : "opacity-0"} ${l.startsWith("✓") ? "text-[#7ee2a8]" : i === 0 ? "text-[#8fb0ff]" : "text-white/75"}`}>
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
        <div className={`mt-2 w-max rounded-md px-3 py-1 font-medium transition-colors ${step >= 1 ? "bg-[#1640c4] text-white" : "bg-[#e7ebf1] text-[var(--ink)]"}`}>Place order</div>
      </div>
      <div
        className={`absolute inset-x-6 bottom-4 rounded-lg bg-white p-3 shadow-xl ring-1 ring-[var(--line)] transition-all duration-500 ${step >= 2 ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
      >
        <div className="font-medium text-[var(--ink)]">The AI wants to click &quot;Place order&quot;</div>
        <div className="mt-2 flex justify-end gap-1.5">
          <span className="rounded-full px-2.5 py-0.5 ring-1 ring-[var(--line)]">Deny</span>
          <span className={`rounded-full px-2.5 py-0.5 text-white ${step >= 3 ? "bg-[#0e2f99]" : "bg-[#2a5bea]"}`}>Allow</span>
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

/** A phone running the web app. */
export function Phone() {
  return (
    <div aria-hidden className="pointer-events-none mx-auto w-[min(17rem,80%)] rounded-[2.4rem] bg-gradient-to-b from-[#e9edf3] to-[#b8c1cf] p-2 shadow-2xl shadow-[#0b1530]/25">
      <div className="app-dark overflow-hidden rounded-[2rem] text-[11.5px]">
        <div className="flex justify-center py-2">
          <span className="h-4 w-20 rounded-full bg-black" />
        </div>
        <div className="grid gap-3 px-4 pt-2 pb-5">
          <div className="text-center text-[11px] text-white/65">Chicago trip on a budget</div>
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#1f3270] px-3 py-2">What&apos;s free to do on day 1?</div>
          <div className="text-white/85">
            <span className="mb-1 inline-block rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] text-white/70">Claude</span>
            <p className="leading-relaxed">Millennium Park, the Riverwalk and Lincoln Park Zoo are all free, and close enough to walk between.</p>
          </div>
          <div className="rounded-2xl border border-white/10 px-3 py-2 text-white/55">Message MoonlightC</div>
        </div>
      </div>
    </div>
  );
}
