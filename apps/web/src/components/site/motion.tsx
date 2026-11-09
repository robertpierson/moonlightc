"use client";

import Lenis from "lenis";
import { useEffect, useRef, useState } from "react";

/**
 * Site-wide feel: smooth, weighted scrolling (off under reduced motion), and a soft light that follows the pointer
 * across any element with the class "spot".
 */
export function SiteMotion() {
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = reduced ? null : new Lenis({ lerp: 0.11, smoothWheel: true });
    let raf = 0;
    const loop = (t: number) => {
      lenis?.raf(t);
      raf = requestAnimationFrame(loop);
    };
    if (lenis) raf = requestAnimationFrame(loop);
    const move = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(".spot");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--x", `${e.clientX - r.left}px`);
      el.style.setProperty("--y", `${e.clientY - r.top}px`);
    };
    addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      lenis?.destroy();
      removeEventListener("pointermove", move);
    };
  }, []);
  return null;
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
