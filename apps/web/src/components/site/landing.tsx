import Link from "next/link";
import type { Release } from "@/lib/releases";
import { Arrival } from "./arrival";
import { SiteFooter, SiteHeader } from "./chrome";
import { AppWindow, AutoRoutes, BrowserTab, CodeTerminal, LocalModels, ModelMenu, Phone, RemoteScreen } from "./demos";
import { Moon } from "./moon";
import { PrimaryDownload } from "./os-download";

const COMPANIES = ["Anthropic", "OpenAI", "Google Gemini", "xAI", "Mistral", "DeepSeek", "Groq", "Together AI", "Perplexity", "Cohere", "OpenRouter", "Azure OpenAI", "AWS Bedrock"];

const FAQ = [
  ["Is MoonlightC free?", "Yes. It's free and open source under the MIT license. You pay the AI companies directly for what you use, at their prices. We don't add a markup or limits."],
  [
    "Where are my keys stored?",
    "On your device. If you sign in, they also sync to your account, stored encrypted. When you send a message, the key goes with that one request to the AI company and is never logged.",
  ],
  [
    "Can I use my Claude Pro or ChatGPT Plus subscription?",
    "Not directly: those companies don't let other apps use subscription sign-ins. Use an API key, or one OpenRouter key for hundreds of models. If you use Claude Code on your PC, MoonlightC can run it for you with your own sign-in.",
  ],
  ["What do I need for remote control?", "The MoonlightC desktop app on the PC you want to reach, and an account with two-step sign-in. Then open MoonlightC on any other device and approve it on the PC."],
  ["Does it work on my phone?", "Yes. Open the web app in your phone's browser and add it to your home screen. It works like an app, with your chats synced when you sign in."],
  ["Can I change it?", "Yes. The code is on GitHub. Fork it, change it, run your own copy."],
];

function Words({ text, start = 0 }: { text: string; start?: number }) {
  return text.split(" ").map((w, i) => (
    <span key={i}>
      {i > 0 && " "}
      <span className="word" style={{ "--i": start + i } as React.CSSProperties}>
        {w}
      </span>
    </span>
  ));
}

/** Brushed-silver hills under the moon. */
function Hills() {
  return (
    <svg aria-hidden viewBox="0 0 1440 360" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[42%] w-full">
      <defs>
        <linearGradient id="h1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c4cddb" />
          <stop offset="1" stopColor="#e9edf3" />
        </linearGradient>
        <linearGradient id="h2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dde3ec" />
          <stop offset="0.5" stopColor="#f5f7fa" />
          <stop offset="1" stopColor="#d3dae5" />
        </linearGradient>
        <linearGradient id="h3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3f5f9" />
          <stop offset="0.6" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <g className="hills hills-back">
        <path d="M0 170 C 180 90 320 120 470 150 S 760 60 930 110 S 1250 70 1440 130 V360 H0Z" fill="url(#h1)" />
      </g>
      <path d="M0 230 C 220 160 380 210 560 200 S 880 140 1060 190 S 1320 170 1440 200 V360 H0Z" fill="url(#h2)" />
      <path d="M0 290 C 260 250 520 300 760 280 S 1200 250 1440 280 V360 H0Z" fill="url(#h3)" />
    </svg>
  );
}

/** Next to the download button: the web app, or (when there's no desktop build to offer yet) every way to install. */
function SecondButton({ release }: { release: Release | null }) {
  return release?.builds.length ? (
    <Link prefetch={false} href="/app" className="btn-silver px-7 py-3 text-base">
      Open web app
    </Link>
  ) : (
    <Link href="/download" className="btn-silver px-7 py-3 text-base">
      All ways to install
    </Link>
  );
}

export function Landing({ release }: { release: Release | null }) {
  return (
    <div className="site relative min-h-dvh overflow-x-clip">
      <Arrival />
      <div aria-hidden className="sky pointer-events-none absolute inset-x-0 top-0 h-[min(92vh,52rem)] overflow-hidden">
        <Moon className="absolute top-[40%] right-[-5%] hidden aspect-square w-[min(32vw,24rem)] sm:block" />
        <Hills />
      </div>
      <SiteHeader />

      <main className="relative">
        <section className="mx-auto max-w-5xl px-4 pt-14 text-center sm:px-6 sm:pt-24">
          <h1 className="text-[clamp(2.9rem,8.5vw,5.75rem)] leading-[1.02]">
            <Words text="Every AI," />
            <br />
            <Words text="one window." start={2} />
          </h1>
          <p className="fade-up mx-auto mt-6 max-w-[38ch] text-lg text-[var(--mist)] sm:text-xl" style={{ "--d": "0.55s" } as React.CSSProperties}>
            Claude, GPT, Gemini, Grok and hundreds more in one app, with your own keys. Free and open source.
          </p>
          <div className="fade-up mt-9 flex flex-wrap justify-center gap-3" style={{ "--d": "0.7s" } as React.CSSProperties}>
            <PrimaryDownload release={release} className="btn-primary flex-col px-7 py-3 text-base [&>span]:opacity-80" />
            <SecondButton release={release} />
          </div>
        </section>

        <div className="window-stage relative mx-auto mt-14 max-w-6xl px-3 sm:mt-20 sm:px-6">
          <div className="fade-up" style={{ "--d": "0.85s" } as React.CSSProperties}>
            <div className="tilt rounded-[1.4rem] bg-gradient-to-b from-[#f4f6f9] to-[#cdd4df] p-1.5 shadow-[0_40px_100px_-30px_rgb(11_21_48/0.45),inset_0_1px_0_#fff] sm:p-2">
              <div className="flex items-center gap-1.5 px-3 py-2">
                {["#c3cad6", "#c3cad6", "#c3cad6"].map((c, i) => (
                  <span key={i} className="size-2.5 rounded-full" style={{ background: c }} />
                ))}
                <span className="mx-auto pr-10 text-xs font-medium text-[var(--faint)]">MoonlightC</span>
              </div>
              <div className="h-[min(68vh,34rem)] overflow-hidden rounded-xl">
                <AppWindow />
              </div>
            </div>
          </div>
        </div>

        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-32 sm:px-6 sm:pt-40">
          <h2 className="ink-in mx-auto max-w-3xl text-center text-[clamp(2.2rem,5.5vw,3.6rem)] leading-[1.05]">Bring a key. Get every model.</h2>
          <p className="mx-auto mt-5 max-w-[48ch] text-center text-lg text-[var(--mist)]">
            Add a key from any AI company and everything it unlocks shows up, listed live. Switch models in the middle of a conversation.
          </p>
          <div className="mt-14 grid gap-5 md:grid-cols-2">
            <article className="card-blue rise flex flex-col overflow-hidden rounded-3xl p-7 text-white sm:p-9">
              <h3 className="text-2xl">Pick any model</h3>
              <p className="mt-2 max-w-[40ch] text-white/95">Claude for writing, GPT for code, Gemini for long files. Your keys, your choice, one place.</p>
              <div className="mt-10 flex flex-1 items-end justify-center">
                <ModelMenu />
              </div>
            </article>
            <article className="card rise flex flex-col overflow-hidden rounded-3xl p-7 sm:p-9">
              <h3 className="text-2xl">Or let Auto choose</h3>
              <p className="mt-2 max-w-[40ch] text-[var(--mist)]">Pick a model for coding, one for deep thinking and a fast one for quick questions. Auto sends each message to the right one.</p>
              <div className="mt-10 flex flex-1 items-end justify-center">
                <AutoRoutes />
              </div>
            </article>
          </div>
        </section>

        <section id="remote" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-32 sm:px-6 sm:pt-40">
          <h2 className="ink-in mx-auto max-w-3xl text-center text-[clamp(2.2rem,5.5vw,3.6rem)] leading-[1.05]">Your PC, from anywhere.</h2>
          <p className="mx-auto mt-5 max-w-[50ch] text-center text-lg text-[var(--mist)]">
            Open MoonlightC on your phone or Chromebook to see your home PC&apos;s screen, click, type and run its local models.
          </p>
          <div className="card rise mt-14 overflow-hidden rounded-3xl px-5 pt-10 sm:px-14 sm:pt-14">
            <RemoteScreen />
          </div>
          <div className="mt-8 grid gap-6 text-[var(--mist)] sm:grid-cols-3">
            <p>
              <strong className="font-medium text-[var(--ink)]">You approve every device.</strong> A new device can&apos;t connect until you allow it on the PC.
            </p>
            <p>
              <strong className="font-medium text-[var(--ink)]">You always know.</strong> The PC shows a banner while someone is connected, with a button to end it.
            </p>
            <p>
              <strong className="font-medium text-[var(--ink)]">Works on any network.</strong> Devices connect directly, and through a relay when a network blocks that.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-32 sm:px-6 sm:pt-40">
          <h2 className="ink-in mx-auto max-w-3xl text-center text-[clamp(2.2rem,5.5vw,3.6rem)] leading-[1.05]">More than a chat box.</h2>
          <div className="mt-14 grid gap-8 md:grid-cols-3 md:gap-5">
            {[
              [<CodeTerminal key="c" />, "Code on your PC.", "Run Claude Code and terminals in your projects, from the browser on any device."],
              [<BrowserTab key="b" />, "Browser tabs you share.", "With the Chrome extension, the AI reads, clicks and types in tabs you choose. Buying or sending waits for your OK."],
              [<LocalModels key="l" />, "Models on your own PC.", "Download open models with one click. They run on your PC, and you can use them from your other devices."],
            ].map(([demo, title, body], i) => (
              <article key={i} className="rise">
                <div className="card h-64 rounded-3xl p-5">{demo}</div>
                <p className="mt-4 text-[var(--mist)]">
                  <strong className="font-medium text-[var(--ink)]">{title}</strong> {body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section aria-label="Works with" className="mt-28 border-y border-[var(--line)] py-6">
          <p className="mb-4 text-center text-sm text-[var(--faint)]">Works with keys from</p>
          <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
            <div className="marquee flex w-max gap-12 whitespace-nowrap">
              {[...COMPANIES, ...COMPANIES].map((p, i) => (
                <span key={i} className="text-xl font-medium tracking-tight text-[var(--mist)]" aria-hidden={i >= COMPANIES.length}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-28 sm:px-6 md:grid-cols-2">
          <div className="card rise rounded-3xl py-12">
            <Phone />
          </div>
          <div className="grid">
            {[
              [String(COMPANIES.length), "AI companies", "Add a key from any of them. Models are listed live from each company, so new ones appear on their own."],
              ["0%", "Markup", "You pay the AI company directly, at their prices. We don't resell AI."],
              ["MIT", "Open source", "Read every line on GitHub, change it, or run your own copy."],
            ].map(([big, title, body]) => (
              <div key={title} className="grid grid-cols-[6.5rem_1fr] gap-6 border-b border-[var(--line)] py-7 last:border-0 sm:grid-cols-[8rem_1fr]">
                <p className="text-[2.6rem] leading-none font-medium tracking-tight sm:text-5xl">{big}</p>
                <div>
                  <h3 className="text-xl">{title}</h3>
                  <p className="mt-1.5 text-[var(--mist)]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="faq" className="faq mx-auto max-w-3xl px-4 pt-32 sm:px-6">
          <h2 id="faq" className="text-center text-[clamp(2rem,4.5vw,2.75rem)]">
            Questions
          </h2>
          <div className="mt-10 border-t border-[var(--line)]">
            {FAQ.map(([q, a]) => (
              <details key={q} className="border-b border-[var(--line)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-medium">
                  {q}
                  <span aria-hidden className="plus text-2xl leading-none font-light text-[var(--faint)]">
                    +
                  </span>
                </summary>
                <p className="pb-5 text-[var(--mist)]">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="px-3 pt-32 pb-20 sm:px-6">
          <div className="sky relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] px-6 py-20 text-center shadow-[inset_0_0_0_1px_var(--line)] sm:py-28">
            <div aria-hidden className="absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,#fff_0_45%,rgb(255_255_255/0.5)_55%,transparent_70%)]" />
            <h2 className="relative text-[clamp(2.2rem,5.5vw,3.6rem)] leading-[1.05]">Every AI, on every device you own.</h2>
            <p className="relative mx-auto mt-4 max-w-[40ch] text-lg text-[var(--mist)]">Start in your browser in a minute. Add the desktop app when you want your PC in the mix.</p>
            <div className="relative mt-9 flex flex-wrap justify-center gap-3">
              <PrimaryDownload release={release} className="btn-primary flex-col px-7 py-3 text-base [&>span]:opacity-80" />
              <SecondButton release={release} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
