"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { PAGES } from "./pages";

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-6 text-sm text-[var(--mist)] lg:flex">
      {PAGES.map(([href, label]) => (
        <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className="nav-link transition-colors hover:text-[var(--ink)]">
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Phones and small windows: the same links in a drop-down. Closes when you pick a page. */
export function MenuButton() {
  const path = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [path]);
  return (
    <details ref={ref} className="menu relative lg:hidden">
      <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-full" aria-label="Menu">
        <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
          <path d="M3 7h14M3 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </summary>
      <nav aria-label="Pages" className="menu-panel absolute top-12 right-0 grid w-56 gap-1 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-[var(--line)]">
        {PAGES.map(([href, label]) => (
          <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className="nav-link rounded-xl px-3 py-2.5 text-[var(--mist)] hover:bg-[var(--silver-1)]">
            {label}
          </Link>
        ))}
      </nav>
    </details>
  );
}
