import Link from "next/link";
import { Arrival } from "./arrival";
import type { Release } from "@/lib/releases";
import { REPO } from "@/lib/releases";
import { Moon } from "./moon";
import { PrimaryDownload } from "./os-download";

const PROVIDERS = [
  "Claude",
  "GPT",
  "Gemini",
  "Grok",
  "Mistral",
  "DeepSeek",
  "Llama",
  "Qwen",
  "Perplexity",
  "Cohere",
  "Groq",
  "Together",
  "OpenRouter",
  "Any OpenAI-compatible server",
];

const FEATURES = [
  {
    title: "Any model, your key",
    body: "Paste a key from Anthropic, OpenAI, Google, xAI, Mistral, DeepSeek, Groq, Together, Perplexity, Cohere or OpenRouter. MoonlightC checks it and lists every model it unlocks, live from the provider. Switch models in the middle of a conversation.",
    demo: (
      <div className="grid gap-2 text-sm">
        {["Claude", "GPT", "Gemini", "Llama"].map((m, i) => (
          <div
            key={m}
            className="flex items-center justify-between rounded-lg border border-[var(--line)] px-3 py-2"
          >
            <span>{m}</span>
            <span
              className={i === 0 ? "text-[var(--tide)]" : "text-[var(--mist)]"}
            >
              {i === 0 ? "selected" : "available"}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Auto picks the right model",
    body: "Choose a model for coding, one for deep thinking and a fast one for quick questions. Auto sends each message to the right one.",
    demo: (
      <div className="grid gap-2 text-sm">
        {[
          ["Fix this TypeError in my script", "Coding model"],
          ["Plan a 3-day trip on a budget", "Deep thinking model"],
          ["What's 15% of 80?", "Quick model"],
        ].map(([q, m]) => (
          <div
            key={q}
            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-3 py-2"
          >
            <span>{q}</span>
            <span className="shrink-0 text-xs text-[var(--tide)]">{m}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Answers you can run",
    body: "Web pages, SVG and React components open live in a side panel. Python runs right in your browser for math and data. Edit the code and download it.",
    demo: (
      <pre className="overflow-hidden rounded-lg border border-[var(--line)] p-3 text-xs leading-relaxed text-[var(--mist)]">
        {`>>> import statistics\n>>> statistics.mean([3, 7, 8])\n6`}
      </pre>
    ),
  },
  {
    title: "Research that reads the sources",
    body: "Deep Research plans the questions, searches the web, reads the pages and writes a report with numbered sources. Bring a Tavily, Exa or Brave key.",
    demo: (
      <div className="grid gap-3 text-sm">
        <p>
          Lunar water ice sits mostly in permanently shadowed craters near the
          poles <sup className="text-[var(--tide)]">[1]</sup>, and some of it is
          bound in sunlit soil too <sup className="text-[var(--tide)]">[2]</sup>
          .
        </p>
        <div className="border-t border-[var(--line)] pt-2 text-xs text-[var(--mist)]">
          Sources: [1] a planetary science journal · [2] a space agency briefing
        </div>
      </div>
    ),
  },
  {
    title: "Claude plugins work here",
    body: "Install skills, slash commands and connectors made for Claude straight from GitHub, or browse Anthropic's plugin directory inside the app.",
    demo: (
      <div className="grid gap-2 text-sm">
        {[
          ["/commit", "Slash command"],
          ["frontend-design", "Skill"],
          ["Linear", "Connector"],
        ].map(([n, k]) => (
          <div
            key={n}
            className="flex items-center justify-between rounded-lg border border-[var(--line)] px-3 py-2"
          >
            <span className="font-medium">{n}</span>
            <span className="text-xs text-[var(--tide)]">{k}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Private when you want it",
    body: "Private mode keeps nothing. Talk instead of typing with Whisper, and have answers read aloud.",
    demo: (
      <div className="rounded-lg border border-dashed border-[var(--line)] p-4 text-center text-sm text-[var(--mist)]">
        This chat won&apos;t be saved.
      </div>
    ),
  },
];

const FAQ = [
  [
    "Is MoonlightC free?",
    "Yes. It's free and open source under the MIT license. You pay your AI providers directly for what you use, at their prices, with no markup and no limits from us.",
  ],
  [
    "Where are my keys stored?",
    "Right now, in your browser on your device. When you send a message, the key travels with that one request to the provider through our server and is never saved or logged there.",
  ],
  [
    "Can I use my Claude Pro or ChatGPT Plus subscription?",
    "No. Those providers don't allow other apps to use subscription logins. Use an API key, or one OpenRouter key for hundreds of models.",
  ],
  [
    "Which models work?",
    "Every chat model your key unlocks, listed live from the provider, plus any server that speaks the OpenAI API.",
  ],
  [
    "Can I change it?",
    "Yes. The code is on GitHub. Fork it, change it, run your own copy.",
  ],
];

export function Landing({ release }: { release: Release | null }) {
  return (
    <div className="site relative min-h-dvh overflow-x-clip">
      <Arrival />
      <div
        aria-hidden
        className="sky pointer-events-none absolute inset-x-0 top-0 h-[min(110vh,62rem)] [mask-image:linear-gradient(black_75%,transparent)]"
      />
      <header className="relative mx-auto flex max-w-6xl items-center gap-6 px-4 py-5 sm:px-6">
        <Link href="/" className="display text-xl font-semibold">
          MoonlightC
        </Link>
        <nav
          aria-label="Main"
          className="ml-auto flex items-center gap-5 text-sm"
        >
          <a
            href="#features"
            className="hidden hover:text-[var(--tide)] sm:inline"
          >
            Features
          </a>
          <Link href="/download" className="hover:text-[var(--tide)]">
            Download
          </Link>
          <a
            href={`https://github.com/${REPO}`}
            className="hidden hover:text-[var(--tide)] sm:inline"
          >
            GitHub
          </a>
          <Link
            prefetch={false}
            href="/app"
            className="rounded-full btn-moon px-4 py-2 font-medium "
          >
            Open web app
          </Link>
        </nav>
      </header>

      <main className="relative">
        <section className="relative mx-auto grid max-w-6xl items-center gap-6 overflow-hidden px-4 pt-6 pb-16 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-12">
          <div className="relative z-10">
            <h1 className="display ink-gradient pb-2 text-[clamp(3.2rem,11vw,7.5rem)] font-bold">
              Every AI,
              <br />
              one window.
            </h1>
            <p className="mt-6 max-w-[34ch] text-lg text-[var(--mist)] sm:text-xl">
              Claude, GPT, Gemini, Grok and hundreds more in one app, with your
              own keys. Free and open source.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                prefetch={false}
                href="/app"
                className="rounded-full btn-moon px-6 py-3 font-semibold "
              >
                Open web app
              </Link>
              <Link
                href="/download"
                className="rounded-full border border-[var(--line)] bg-white/5 px-6 py-3 font-semibold backdrop-blur hover:border-[var(--tide)]"
              >
                Download
              </Link>
            </div>
          </div>
          <div className="relative -order-1 mx-auto w-[min(56vw,15rem)] md:order-none md:w-full">
            <div
              aria-hidden
              className="halo absolute inset-[8%] rounded-full"
            />
            <Moon className="pointer-events-none relative aspect-square w-full" />
          </div>
        </section>

        <section
          aria-label="Works with"
          className="overflow-hidden border-b border-[var(--line)] bg-white/[0.03] py-5"
        >
          <div className="marquee flex w-max gap-10 whitespace-nowrap">
            {[...PROVIDERS, ...PROVIDERS].map((p, i) => (
              <span
                key={i}
                className="display text-2xl font-semibold text-[var(--mist)] sm:text-3xl"
                aria-hidden={i >= PROVIDERS.length}
              >
                {p}
              </span>
            ))}
          </div>
        </section>

        <div className="wash">
          <section
            id="features"
            aria-label="Features"
            className="mx-auto grid max-w-6xl gap-20 px-4 py-24 sm:px-6"
          >
            {FEATURES.map((f, i) => (
              <article
                key={f.title}
                className={`rise grid items-center gap-8 md:grid-cols-2 ${i % 2 ? "md:[&>div:first-child]:order-2" : ""}`}
              >
                <div>
                  <h2 className="display text-4xl font-semibold sm:text-5xl">
                    {f.title}
                  </h2>
                  <p className="mt-4 max-w-[52ch] text-lg text-[var(--mist)]">
                    {f.body}
                  </p>
                </div>
                <div className="panel rounded-2xl p-5">{f.demo}</div>
              </article>
            ))}
          </section>
        </div>

        <section
          aria-labelledby="open"
          className="border-t border-[var(--line)]"
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 md:grid-cols-3">
            <h2
              id="open"
              className="display text-4xl font-semibold md:col-span-3 sm:text-5xl"
            >
              Yours, not ours.
            </h2>
            {[
              [
                "Bring your own keys",
                "You pay providers directly. We don't resell AI, so there are no plans, credits or caps.",
              ],
              [
                "Your data stays yours",
                "Without an account, keys and chats live in your browser. Sign in to sync them to your devices, keys encrypted. We never sell data.",
              ],
              [
                "Open source, MIT",
                "Read every line, fork it, run your own copy. That's the whole business model: there isn't one.",
              ],
            ].map(([t, b]) => (
              <div key={t}>
                <h3 className="text-xl font-semibold">{t}</h3>
                <p className="mt-2 text-[var(--mist)]">{b}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="get" className="band">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 sm:px-6">
            <h2 id="get" className="display text-4xl font-semibold sm:text-5xl">
              Start in your browser.
            </h2>
            <PrimaryDownload
              release={release}
              className="rounded-2xl bg-white px-6 py-4 font-semibold text-[#0c2a74] shadow-lg hover:bg-white/90"
            />
            <Link
              href="/download"
              className="text-white/90 underline underline-offset-4 hover:text-white"
            >
              All platforms and install options
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="faq"
          className="mx-auto max-w-3xl px-4 py-20 sm:px-6"
        >
          <h2
            id="faq"
            className="display mb-8 text-4xl font-semibold sm:text-5xl"
          >
            Questions
          </h2>
          {FAQ.map(([q, a]) => (
            <details
              key={q}
              className="group border-b border-[var(--line)] py-4"
            >
              <summary className="cursor-pointer list-none text-lg font-medium marker:hidden">
                {q}
              </summary>
              <p className="mt-3 text-[var(--mist)]">{a}</p>
            </details>
          ))}
        </section>
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-4 py-8 text-sm text-[var(--mist)] sm:px-6">
          <span>MoonlightC is free software (MIT).</span>
          <nav aria-label="Footer" className="ml-auto flex gap-5">
            <a
              href={`https://github.com/${REPO}`}
              className="hover:text-[var(--tide)]"
            >
              GitHub
            </a>
            <Link href="/privacy" className="hover:text-[var(--tide)]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[var(--tide)]">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
