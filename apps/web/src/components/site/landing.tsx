import Image from "next/image";
import Link from "next/link";
import { Arrival } from "./arrival";
import { AskBox } from "./ask-box";
import { Cta, SectionTitle, SiteFooter, SiteHeader, Statement, Words } from "./chrome";
import { BrowserTab, CodeTerminal, ModelMenu, RemoteScreen } from "./demos";
import { Moon } from "./moon";
import { CountUp } from "./motion";
import { DemoVideo } from "./scenes";
import { BRANDS, BrandMark } from "./brands";
import { SHOTS } from "./media";
import { COMPANIES } from "./pages";
import { QUESTIONS, QuestionList } from "./questions";
import { LearnTeaser } from "./more-sections";


const EVERYTHING = [
  { shot: "chat", title: "Chat", body: "Every model your keys unlock, in one conversation." },
  { shot: "models", title: "One menu for every model", body: "Switch whenever you like, mid-chat." },
  { shot: "projects", title: "Projects", body: "Folders of chats with their own instructions and files." },
  { shot: "code", title: "Apps that run", body: "Describe an app and use it right away, beside the chat." },
  { shot: "memory", title: "Memory you control", body: "Off until you turn it on. See and delete every fact." },
  { shot: "private", title: "Private mode", body: "A chat that's never saved anywhere." },
  { shot: "connections", title: "Connections", body: "GitHub, Google, Notion, Slack and any MCP server, with your OK before it acts." },
  { shot: "plugins", title: "Claude plugins", body: "Install skills, slash commands and connectors made for Claude." },
  { shot: "theme", title: "Make it yours", body: "Themes, layouts and which sections you see." },
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
                {EVERYTHING.map(({ shot, title, body }) => (
                  <figure key={title} className="w-[20rem] shrink-0 sm:w-[30rem]">
                    <div className="card overflow-hidden rounded-3xl p-2">
                      <Image src={SHOTS[shot]} alt={`MoonlightC: ${title}`} sizes="(min-width: 640px) 30rem, 20rem" className="h-auto w-full rounded-[1.1rem]" />
                    </div>
                    <figcaption className="mt-4 px-1">
                      <span className="block text-lg font-medium">{title}</span>
                      <span className="mt-1 block text-[var(--mist)]">{body}</span>
                    </figcaption>
                  </figure>
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

        <LearnTeaser />

        <section aria-labelledby="faq" className="faq mx-auto max-w-3xl px-4 pt-32 sm:px-6">
          <h2 id="faq" className="text-center text-[clamp(2rem,4.5vw,2.75rem)]">
            Questions
          </h2>
          <div className="mt-10">
            <QuestionList items={QUESTIONS[0].items} />
          </div>
          <p className="mt-6 text-center">
            <Link href="/questions" className="text-sm font-medium text-[var(--tide)] underline-offset-4 hover:underline">
              See all questions
            </Link>
          </p>
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
