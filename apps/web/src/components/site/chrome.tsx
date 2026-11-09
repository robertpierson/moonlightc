import type { Viewport } from "next";
import Link from "next/link";
import { REPO } from "@/lib/releases";
import { Moon } from "./moon";
import { MenuButton, NavLinks } from "./nav";
import { PAGES } from "./pages";
import "./site.css";

/** Marketing pages are always light, so the browser bar matches. */
export const SITE_VIEWPORT: Viewport = { themeColor: "#ffffff" };

export function MoonMark({ className = "size-6" }: { className?: string }) {
  // The app icon's crescent, on a deeper, quieter navy.
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={className}>
      <defs>
        <linearGradient id="mm-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#25324f" />
          <stop offset="1" stopColor="#0f1626" />
        </linearGradient>
        <radialGradient id="mm-g" cx="0.42" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#f4f5f8" />
          <stop offset="1" stopColor="#b9c0cf" />
        </radialGradient>
        <mask id="mm-m">
          <rect width="512" height="512" fill="#fff" />
          <circle cx="318" cy="214" r="150" fill="#000" />
        </mask>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#mm-bg)" />
      <circle cx="256" cy="256" r="168" fill="url(#mm-g)" mask="url(#mm-m)" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header sticky top-0 z-50">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
          <MoonMark />
          MoonlightC
        </Link>
        <NavLinks />
        <div className="ml-auto flex items-center gap-2">
          <Link prefetch={false} href="/app" className="btn-primary px-4 py-2 text-sm">
            Open web app
          </Link>
          <MenuButton />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm text-[var(--mist)] sm:px-6 md:grid-cols-[1fr_auto]">
        <div>
          <span className="flex items-center gap-2 font-medium text-[var(--ink)]">
            <MoonMark className="size-5" />
            MoonlightC
          </span>
          <p className="mt-2">Every AI in one place, with your own keys. Free and open source (MIT).</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-3">
          {PAGES.map(([href, label]) => (
            <Link key={href} href={href} className="hover:text-[var(--ink)]">
              {label}
            </Link>
          ))}
          <a href={`https://github.com/${REPO}`} className="hover:text-[var(--ink)]">
            GitHub
          </a>
          <Link href="/privacy" className="hover:text-[var(--ink)]">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[var(--ink)]">
            Terms
          </Link>
        </nav>
      </div>
      <div aria-hidden className="wordmark mx-auto max-w-6xl overflow-hidden px-4 sm:px-6">
        MoonlightC
      </div>
    </footer>
  );
}

export function Words({ text, start = 0 }: { text: string; start?: number }) {
  return text.split(" ").map((w, i) => (
    <span key={i}>
      {i > 0 && " "}
      <span className="word" style={{ "--i": start + i } as React.CSSProperties}>
        {w}
      </span>
    </span>
  ));
}

/** The top of every feature page: a big title that arrives word by word, over a silver sky with the moon rising below. */
export function PageHero({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <section className="sky relative -mt-16 flex min-h-[min(88svh,56rem)] flex-col overflow-hidden pt-16">
      <div className="relative z-10 mx-auto max-w-5xl px-4 pt-[clamp(3rem,10vh,7rem)] text-center sm:px-6">
        <h1 className="text-[clamp(2.8rem,8vw,5.75rem)] leading-[1.0]">
          <Words text={title} />
        </h1>
        <p className="fade-up mx-auto mt-6 max-w-[44ch] text-lg text-[var(--mist)] sm:text-xl" style={{ "--d": "0.5s" } as React.CSSProperties}>
          {body}
        </p>
        {children && (
          <div className="fade-up mt-9 flex flex-wrap justify-center gap-3" style={{ "--d": "0.65s" } as React.CSSProperties}>
            {children}
          </div>
        )}
      </div>
      <div aria-hidden className="hero-moon pointer-events-none relative -mt-[calc(160px-3rem)] min-h-[14rem] flex-1 [mask-image:linear-gradient(black_50%,transparent)]">
        <div className="moon-in absolute inset-0">
          <Moon className="absolute inset-0 h-full w-full" />
        </div>
      </div>
    </section>
  );
}

/** A big statement whose words light up one after another as it scrolls through the screen. */
export function Statement({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <section className="statement mx-auto max-w-5xl px-4 py-[22vh] sm:px-6">
      <p className="text-[clamp(2rem,4.6vw,3.6rem)] leading-[1.12] font-[550] tracking-[-0.035em] text-[var(--ink)]">
        {words.map((w, i) => (
          <span key={i}>
            {i > 0 && " "}
            <span className="w" style={{ "--p": i / words.length } as React.CSSProperties}>
              {w}
            </span>
          </span>
        ))}
      </p>
    </section>
  );
}

export function SectionTitle({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 text-center">
      <h2 className="ink-in text-[clamp(2.2rem,5.5vw,3.75rem)] leading-[1.05]">{title}</h2>
      {body && <p className="mx-auto mt-5 max-w-[50ch] text-lg text-[var(--mist)]">{body}</p>}
    </div>
  );
}

/** The closing band on every page. */
export function Cta({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <section className="px-3 pt-32 pb-20 sm:px-6">
      <div className="card-night relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] px-6 py-20 text-center sm:py-28">
        <div aria-hidden className="absolute -bottom-[60%] left-1/2 aspect-square w-[130%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.16),rgb(255_255_255/0.04)_70%,transparent)]" />
        <h2 className="relative text-[clamp(2.2rem,5.5vw,3.75rem)] leading-[1.05] text-white">{title}</h2>
        <p className="relative mx-auto mt-4 max-w-[42ch] text-lg text-[#c9cfdb]">{body}</p>
        <div className="relative mt-9 flex flex-wrap justify-center gap-3">{children}</div>
      </div>
    </section>
  );
}

export function SitePage({ children }: { children: React.ReactNode }) {
  return (
    <div className="site relative min-h-dvh overflow-x-clip">
      <SiteHeader />
      <main className="relative">{children}</main>
      <SiteFooter />
    </div>
  );
}
