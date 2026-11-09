"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Site-wide feel: smooth, weighted scrolling (off under reduced motion), and the header's night mode.
 */
export function SiteMotion() {
  const path = usePathname();
  // Tell the header when a night section is right under it: a 2px line just below the header. Re-scanned on every page.
  useEffect(() => {
    const root = document.documentElement;
    const under = new Set<Element>();
    const night = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) under.add(e.target);
          else under.delete(e.target);
        }
        if (under.size) root.dataset.night = "";
        else delete root.dataset.night;
      },
      { rootMargin: `-64px 0px -${Math.max(0, innerHeight - 66)}px 0px` },
    );
    document.querySelectorAll(".night").forEach((n) => night.observe(n));
    return () => {
      night.disconnect();
      delete root.dataset.night;
    };
  }, [path]);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = reduced ? null : new Lenis({ lerp: 0.11, smoothWheel: true });
    let raf = 0;
    const loop = (t: number) => {
      lenis?.raf(t);
      raf = requestAnimationFrame(loop);
    };
    if (lenis) raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis?.destroy();
    };
  }, []);
  return null;
}

/** Writes how far the surrounding section has been scrolled through (0 to 1) into a CSS variable on it. */
export function ScrollProgress({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const section = ref.current?.closest("section");
    if (!section) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = section.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      section.style.setProperty(name, p.toFixed(4));
    };
    const queue = () => (raf ||= requestAnimationFrame(update));
    update();
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", queue);
      removeEventListener("resize", queue);
    };
  }, [name]);
  return <span ref={ref} hidden />;
}

/** A number that counts up from zero the first time it comes into view. Text that isn't a number shows as is. */
export function CountUp({ value }: { value: string }) {
  const m = value.match(/^(\d+)(.*)$/);
  const target = m ? Number(m[1]) : 0;
  const counts = !!m && target > 0;
  const [n, setN] = useState(target);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!counts || !ref.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / 1400);
        setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(ref.current);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [counts, target]);
  return (
    <span ref={ref}>
      <span className="sr-only">{value}</span>
      <span aria-hidden>{m ? `${n}${m[2]}` : value}</span>
    </span>
  );
}
