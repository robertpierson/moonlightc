import type { Viewport } from "next";
import Link from "next/link";
import { REPO } from "@/lib/releases";
import "./site.css";

/** Marketing pages are always light, so the browser bar matches. */
export const SITE_VIEWPORT: Viewport = { themeColor: "#ffffff" };

export function MoonMark({ className = "size-6" }: { className?: string }) {
  // Same mark as the app icon (src/app/icon.svg).
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={className}>
      <defs>
        <radialGradient id="mm-g" cx="0.42" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#f2f4fa" />
          <stop offset="1" stopColor="#b8c2de" />
        </radialGradient>
        <mask id="mm-m">
          <rect width="512" height="512" fill="#fff" />
          <circle cx="318" cy="214" r="150" fill="#000" />
        </mask>
      </defs>
      <rect width="512" height="512" rx="112" fill="#0f1736" />
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
        <nav aria-label="Main" className="hidden items-center gap-7 text-sm text-[var(--mist)] md:flex">
          <Link href="/#features" className="hover:text-[var(--ink)]">
            Features
          </Link>
          <Link href="/#remote" className="hover:text-[var(--ink)]">
            Remote control
          </Link>
          <Link href="/download" className="hover:text-[var(--ink)]">
            Download
          </Link>
          <a href={`https://github.com/${REPO}`} className="hover:text-[var(--ink)]">
            GitHub
          </a>
        </nav>
        <Link prefetch={false} href="/app" className="btn-primary ml-auto px-4 py-2 text-sm">
          Open web app
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-4 px-4 py-10 text-sm text-[var(--mist)] sm:px-6">
        <span className="flex items-center gap-2 font-medium text-[var(--ink)]">
          <MoonMark className="size-5" />
          MoonlightC
        </span>
        <span>Free and open source (MIT).</span>
        <nav aria-label="Footer" className="flex flex-wrap gap-6 sm:ml-auto">
          <Link href="/download" className="hover:text-[var(--ink)]">
            Download
          </Link>
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
    </footer>
  );
}
