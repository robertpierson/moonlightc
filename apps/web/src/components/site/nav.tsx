"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { MORE, PAGES } from "./pages";

/** Closes a drop-down when the page changes, when you click outside it, or press Escape. */
function useAutoClose(ref: React.RefObject<HTMLDetailsElement | null>) {
  const path = usePathname();
  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [path, ref]);
  useEffect(() => {
    const close = (e: Event) => {
      const d = ref.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !d.contains(e.target as Node)) d.removeAttribute("open");
    };
    addEventListener("pointerdown", close);
    addEventListener("keydown", close);
    return () => {
      removeEventListener("pointerdown", close);
      removeEventListener("keydown", close);
    };
  }, [ref]);
}

function MoreLink({ href, label, className }: { href: string; label: string; className: string }) {
  const path = usePathname();
  return href.startsWith("http") ? (
    <a href={href} className={className}>
      {label}
    </a>
  ) : (
    <Link href={href} aria-current={path === href ? "page" : undefined} className={className}>
      {label}
    </Link>
  );
}

const ITEM = "nav-link rounded-xl px-3 py-2.5 text-[var(--mist)] hover:bg-[var(--silver-1)]";

export function NavLinks() {
  const path = usePathname();
  const more = useRef<HTMLDetailsElement>(null);
  useAutoClose(more);
  const inMore = MORE.some(([href]) => href === path);
  return (
    <nav aria-label="Main" className="hidden items-center gap-6 text-sm text-[var(--mist)] lg:flex">
      {PAGES.map(([href, label]) => (
        <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className="nav-link transition-colors hover:text-[var(--ink)]">
          {label}
        </Link>
      ))}
      <details ref={more} className="menu relative">
        <summary className={`flex cursor-pointer list-none items-center gap-1 transition-colors hover:text-[var(--ink)] ${inMore ? "font-medium text-[var(--ink)]" : ""}`}>
          More
          <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
            <path d="M3 4.5 6 7.5l3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="menu-panel absolute top-9 left-1/2 grid w-52 -translate-x-1/2 gap-0.5 rounded-2xl bg-white p-2 text-[15px] shadow-xl ring-1 ring-[var(--line)]">
          {MORE.map(([href, label]) => (
            <MoreLink key={href} href={href} label={label} className={ITEM} />
          ))}
        </div>
      </details>
    </nav>
  );
}

/** Phones and small windows: the same links in a drop-down. Closes when you pick a page. */
export function MenuButton() {
  const path = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);
  useAutoClose(ref);
  return (
    <details ref={ref} className="menu relative lg:hidden">
      <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-full" aria-label="Menu">
        <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
          <path d="M3 7h14M3 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </summary>
      <nav aria-label="Pages" className="menu-panel absolute top-12 right-0 grid max-h-[80svh] w-60 gap-1 overflow-y-auto rounded-2xl bg-white p-2 shadow-xl ring-1 ring-[var(--line)]">
        {PAGES.map(([href, label]) => (
          <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className={ITEM}>
            {label}
          </Link>
        ))}
        <span className="mx-3 my-1 h-px bg-[var(--line)]" aria-hidden />
        {MORE.map(([href, label]) => (
          <MoreLink key={href} href={href} label={label} className={ITEM} />
        ))}
      </nav>
    </details>
  );
}
