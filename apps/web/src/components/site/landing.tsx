import {
  AppWindow,
  Binoculars,
  Brain,
  ChatCircleText,
  Devices,
  EyeSlash,
  FolderSimple,
  ImageSquare,
  Microphone,
  PlugsConnected,
  PuzzlePiece,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Arrival } from "./arrival";
import { AskBox } from "./ask-box";
import { Cta, SectionTitle, SiteFooter, SiteHeader, Statement, Words } from "./chrome";
import { BrowserTab, CodeTerminal, ModelMenu, RemoteScreen } from "./demos";
import { Moon } from "./moon";
import { CountUp } from "./motion";
import { DemoVideo } from "./scenes";
import { BRANDS, BrandMark } from "./brands";

export const COMPANIES = [
  "Anthropic",
  "OpenAI",
  "Google Gemini",
  "xAI",
  "Mistral",
  "DeepSeek",
  "Groq",
  "Together AI",
  "Perplexity",
  "Cohere",
  "OpenRouter",
  "Azure OpenAI",
  "AWS Bedrock",
];

const FAQ = [
  [
    "Is MoonlightC free?",
    "Yes. It's free and open source under the MIT license. You pay the AI companies directly for what you use, at their prices. We don't add a markup or limits.",
  ],
  [
    "Where are my keys stored?",
    "On your device. If you sign in, they also sync to your account, stored encrypted. When you send a message, the key goes with that one request to the AI company and is never logged.",
  ],
  [
    "Can I use my Claude Pro or ChatGPT Plus subscription?",
    "Not directly: those companies don't let other apps use subscription sign-ins. Use an API key, or one OpenRouter key for hundreds of models. If you use Claude Code on your PC, MoonlightC can run it for you with your own sign-in.",
  ],
  [
    "Does it work on my phone?",
    "Yes. Open the web app in your phone's browser and add it to your home screen. It works like an app, with your chats synced when you sign in.",
  ],
  ["Can I change it?", "Yes. The code is on GitHub. Fork it, change it, run your own copy."],
];

const EVERYTHING = [
  {
    icon: ChatCircleText,
    title: "Chat",
    body: "Every model your keys unlock, in one conversation. Switch whenever you like.",
  },
  {
    icon: FolderSimple,
    title: "Projects",
    body: "Folders of chats with their own instructions, files and tools.",
  },
  {
    icon: Binoculars,
    title: "Deep research",
    body: "It plans the questions, reads the sources and writes a report with citations.",
  },
  {
    icon: AppWindow,
    title: "Live previews",
    body: "Web pages, charts and React components open beside the chat, ready to edit.",
  },
  {
    icon: ImageSquare,
    title: "Studio",
    body: "Make images, video and voice with fal, Replicate or ElevenLabs keys.",
  },
  {
    icon: PlugsConnected,
    title: "Connections",
    body: "GitHub, Google, Notion, Slack and any MCP server, with your OK before it acts.",
  },
  {
    icon: PuzzlePiece,
    title: "Claude plugins",
    body: "Install skills, slash commands and connectors made for Claude.",
  },
  {
    icon: Brain,
    title: "Memory",
    body: "It remembers what you tell it to, and you can see and delete every fact.",
  },
  {
    icon: Microphone,
    title: "Voice",
    body: "Talk instead of typing, and have answers read aloud.",
  },
  {
    icon: EyeSlash,
    title: "Private mode",
    body: "A chat that's never saved anywhere.",
  },
  {
    icon: Devices,
    title: "Every device",
    body: "Web, Windows, Mac, Linux and your phone, synced when you sign in.",
  },
];

const EXPLORE = [
  {
    href: "/models",
    title: "Every model, your keys",
    body: "Claude, GPT, Gemini and more, switched in the middle of a conversation.",
    demo: <ModelMenu key="m" />,
  },
  {
    href: "/remote",
    title: "Your PC, from anywhere",
    body: "See your home PC's screen, click and type, from your phone or Chromebook.",
    demo: <RemoteScreen key="r" />,
  },
  {
    href: "/code",
    title: "Build with AI",
    body: "Describe an app and watch it run. Or run Claude Code in your own projects.",
    demo: <CodeTerminal key="c" />,
  },
  {
    href: "/extension",
    title: "AI in your browser",
    body: "Share a tab and the AI reads, clicks and types there. Risky steps wait for you.",
    demo: <BrowserTab key="b" />,
  },
];

export function Landing() {
  return (
    <div className="site relative min-h-dvh overflow-x-clip">
      <Arrival />
      <SiteHeader />
      <main className="relative">
        {/* Hero: the headline and buttons on a silver sky, then a moon wider than the screen rising below them. */}
        <section className="hero sky relative -mt-16 flex flex-col overflow-hidden pt-16">
          <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 pt-[clamp(2.5rem,9vh,6rem)] text-center sm:px-6">
            <h1 className="text-[clamp(3rem,8.2vw,6.25rem)] leading-[0.98]">
              <Words text="Every AI," />
              <br />
              <Words text="one window." start={2} />
            </h1>
            <p className="fade-up mt-6 max-w-[40ch] text-lg text-[var(--mist)] sm:text-xl" style={{ "--d": "0.6s" } as React.CSSProperties}>
              Claude, GPT, Gemini, Grok and hundreds more in one app, with your own keys. Free and open source.
            </p>
            <div className="fade-up mt-8 flex flex-wrap justify-center gap-3" style={{ "--d": "0.8s" } as React.CSSProperties}>
              <Link href="/download" className="btn-primary px-7 py-3 text-base">
                Download
              </Link>
              <Link prefetch={false} href="/app" className="btn-silver px-7 py-3 text-base">
                Open web app
              </Link>
            </div>
          </div>
          <div
            aria-hidden
            className="hero-moon pointer-events-none relative -mt-[calc(160px-clamp(1.5rem,5vh,3.5rem))] min-h-[22rem] flex-1 [mask-image:linear-gradient(black_60%,transparent)]"
          >
            <div className="moon-in absolute inset-0">
              <Moon className="absolute inset-0 h-full w-full" />
            </div>
          </div>
        </section>

        <Statement text="One window for every AI you use. Your keys, your devices, your rules. No subscription, no markup, nothing hidden." />

        {/* The real app on film. The window grows to fill the screen as you scroll; the buttons jump to each part. */}
        <section aria-labelledby="see" className="scene night">
          <div className="scene-sticky flex flex-col items-center justify-center px-3 pt-16 sm:px-6">
            <div className="scene-title pointer-events-none absolute inset-x-0 top-[14vh] z-10 px-4 text-center">
              <h2 id="see" className="on-night text-[clamp(2.6rem,6.5vw,5rem)] leading-[1.0]">
                See it work.
              </h2>
              <p className="on-night-soft mx-auto mt-3 max-w-[40ch] text-lg">The real app, start to finish, in 25 seconds.</p>
            </div>
            <div className="w-[min(100%,72rem,calc((100svh-15rem)*1.6))]">
              <DemoVideo
                frameClassName="scene-grow rounded-[1.25rem] shadow-[0_50px_120px_-40px_rgb(14_22_40/0.6)] ring-1 ring-black/5"
                chipsClassName="scene-caption"
              />
              <p className="scene-caption mt-3 text-center text-xs">
                <span className="on-night-soft">
                  Filmed in the real web app. The AI&apos;s answers are written samples, so no AI company was paid to make it.
                </span>
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="try" className="px-4 pt-32 text-center sm:px-6">
          <h2 id="try" className="text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.0]">
            Try it now.
          </h2>
          <p className="mx-auto mt-4 mb-10 max-w-[44ch] text-lg text-[var(--mist)]">
            Type a question. The app opens with it ready to send, and asks for a key the first time.
          </p>
          <AskBox />
        </section>

        {/* Giant names sliding past. */}
        <section aria-label="Works with" className="edge-fade overflow-hidden pt-28 pb-10">
          <p className="mb-6 text-center text-sm text-[var(--faint)]">Works with keys from</p>
          <div className="slide-x flex w-max gap-[0.4em] text-[clamp(3.5rem,11vw,9.5rem)] leading-none font-medium tracking-[-0.05em] whitespace-nowrap text-[var(--ink)]">
            {COMPANIES.map((c, i) => (
              <span key={c} className={i % 2 ? "text-[#848da0]" : ""}>
                {c}
                {i < COMPANIES.length - 1 && "."}
              </span>
            ))}
          </div>
          <div
            aria-hidden
            className="slide-x-rev mt-4 flex w-max gap-[0.9em] text-[clamp(1.8rem,5vw,4rem)] leading-none font-normal tracking-[-0.04em] whitespace-nowrap text-[#848da0]"
          >
            {[...BRANDS, ...BRANDS].map(([icon, name], i) => (
              <span key={i} className="flex items-center gap-[0.35em]">
                <BrandMark icon={icon} className="size-[0.85em]" />
                {name}
              </span>
            ))}
          </div>
        </section>

        {/* Everything else in the app, travelling sideways as you scroll down. */}
        <section aria-labelledby="all" className="gallery">
          <div className="gallery-sticky">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
              <h2 id="all" className="text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.0]">
                Everything in one app.
              </h2>
              <p className="mt-4 max-w-[46ch] text-lg text-[var(--mist)]">Not just chat. Here&apos;s what else is inside, all with your own keys.</p>
            </div>
            <div className="mt-12 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
              <div className="gallery-track flex w-max gap-5 pr-[10vw] pl-[max(1rem,calc((100vw-72rem)/2+1.5rem))]">
                {EVERYTHING.map(({ icon: Icon, title, body }) => (
                  <article key={title} className="card spot flex h-[19rem] w-[19rem] shrink-0 flex-col rounded-[1.75rem] p-7 sm:w-[21rem]">
                    <Icon className="size-9 text-[var(--tide)]" weight="light" aria-hidden />
                    <h3 className="mt-auto text-[1.6rem] leading-tight">{title}</h3>
                    <p className="mt-2 text-[var(--mist)]">{body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-28 sm:px-6">
          <SectionTitle title="One app. Four superpowers." />
          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {EXPLORE.map((e) => (
              <Link key={e.href} href={e.href} className="card card-link spot flex flex-col overflow-hidden rounded-3xl p-7 sm:p-9">
                <h3 className="text-2xl">{e.title}</h3>
                <p className="mt-2 max-w-[40ch] text-[var(--mist)]">{e.body}</p>
                <span className="mt-4 text-sm font-medium text-[var(--tide)]">
                  Learn more <span className="arrow inline-block">›</span>
                </span>
                <div className="mt-8 flex h-64 flex-1 items-center justify-center">{e.demo}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-32 sm:px-6">
          <div className="grid divide-y divide-[var(--line)] overflow-hidden rounded-3xl bg-white ring-1 ring-[var(--line)] md:grid-cols-3 md:divide-x md:divide-y-0">
            {[
              [String(COMPANIES.length), "AI companies", "Add a key from any of them. Models are listed live, so new ones appear on their own."],
              ["0%", "Markup", "You pay the AI company directly, at their prices. We don't resell AI."],
              ["MIT", "Open source", "Read every line on GitHub, change it, or run your own copy."],
            ].map(([big, title, body]) => (
              <div key={title} className="bg-white p-8 sm:p-10">
                <p className="text-[clamp(3rem,6vw,4.5rem)] leading-none font-medium tracking-[-0.04em]">
                  <CountUp value={big} />
                </p>
                <h3 className="mt-4 text-xl">{title}</h3>
                <p className="mt-1.5 text-[var(--mist)]">{body}</p>
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

        <Cta title="Every AI, on every device you own." body="Start in your browser in a minute. Add the desktop app when you want your PC in the mix.">
          <Link href="/download" className="btn-silver px-7 py-3 text-base">
            Download
          </Link>
          <Link
            prefetch={false}
            href="/app"
            className="rounded-full px-7 py-3 text-base font-medium text-white ring-1 ring-white/25 transition hover:bg-white/10"
          >
            Open web app
          </Link>
        </Cta>
      </main>
      <SiteFooter />
    </div>
  );
}
