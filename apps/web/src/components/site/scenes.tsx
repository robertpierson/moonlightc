"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_CHAPTERS } from "./pages";


/**
 * The real app on film. Plays while it's on screen (from `from` to the end, then again), and pauses when it isn't.
 * The chapter buttons jump to a part. Under reduced motion it waits for Play.
 */
export function DemoVideo({ from = 0, chapters = DEMO_CHAPTERS, className = "", frameClassName = "rounded-xl", chipsClassName = "" }: { from?: number; chapters?: typeof DEMO_CHAPTERS; className?: string; frameClassName?: string; chipsClassName?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(from);
  const [paused, setPaused] = useState(true);
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    if (ref.current) ref.current.currentTime = from;
  }, [from]);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting && !userPaused ? v.play().catch(() => {}) : v.pause()), { threshold: 0.45 });
    io.observe(v);
    return () => io.disconnect();
  }, [from, userPaused]);

  const active = chapters.findLastIndex((c) => now >= c.t - 0.05);
  const jump = (t: number) => {
    const v = ref.current!;
    v.currentTime = t;
    setUserPaused(false);
    v.play().catch(() => {});
  };
  const toggle = () => {
    const v = ref.current!;
    if (v.paused) {
      setUserPaused(false);
      v.play().catch(() => {});
    } else {
      setUserPaused(true);
      v.pause();
    }
  };

  return (
    <div className={className}>
      <div className={`relative overflow-hidden bg-[#0d121d] ${frameClassName}`}>
        <video
          ref={ref}
          src="/demo/moonlightc-demo.mp4"
          poster="/demo/poster.jpg"
          muted
          playsInline
          preload="metadata"
          aria-label="MoonlightC in use: asking for a trip plan, switching models, then building and using a tip calculator in the Code tab"
          className="block aspect-[16/10] w-full"
          onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onEnded={(e) => {
            e.currentTarget.currentTime = from;
            e.currentTarget.play().catch(() => {});
          }}
        />
        <button
          onClick={toggle}
          aria-label={paused ? "Play the demo" : "Pause the demo"}
          className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full bg-white/90 text-[var(--ink)] shadow-lg backdrop-blur transition hover:bg-white"
        >
          {paused ? (
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
              <path d="M5 3l8 5-8 5z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
              <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" />
            </svg>
          )}
        </button>
      </div>
      <div role="group" aria-label="Parts of the demo" className={`mt-5 flex flex-wrap justify-center gap-2 ${chipsClassName}`}>
        {chapters.map((c, i) => (
          <button
            key={c.label}
            onClick={() => jump(c.t)}
            aria-pressed={i === active}
            className={`relative overflow-hidden rounded-full px-4 py-2 text-sm transition-colors duration-300 ${i === active ? "bg-[var(--ink)] text-white" : "bg-[var(--silver-1)] text-[var(--mist)] ring-1 ring-[var(--line)] hover:text-[var(--ink)]"}`}
          >
            {c.label}
            {i === active && (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-white/60"
                style={{ transform: `scaleX(${Math.min(1, (now - c.t) / ((chapters[i + 1]?.t ?? 26) - c.t))})` }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Apple-style steps: the words scroll by on one side while the picture on the other side stays put and changes to
 * match the step you're reading. On phones each picture sits above its step instead.
 */
export function StickySteps({ steps }: { steps: { title: string; body: string; visual: React.ReactNode }[] }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-2 md:gap-16">
      <div>
        {steps.map((s, i) => (
          <div key={s.title} ref={(el) => void (refs.current[i] = el)} data-i={i} data-active={i === active ? "" : undefined} className="step flex flex-col justify-center py-10 md:min-h-[78vh] md:py-0">
            <div className="card mb-8 grid aspect-[4/3] place-items-center overflow-hidden rounded-3xl p-6 md:hidden">{s.visual}</div>
            <h3 className="text-[clamp(1.9rem,3.4vw,3.1rem)] leading-[1.08]">{s.title}</h3>
            <p className="mt-5 max-w-[40ch] text-lg text-[var(--mist)] xl:text-xl">{s.body}</p>
          </div>
        ))}
      </div>
      <div className="hidden md:block">
        <div className="card sticky top-[calc(50vh-17rem)] grid h-[34rem] overflow-hidden rounded-[2rem]">
          {steps.map((s, i) => (
            <div key={s.title} aria-hidden={i !== active} data-active={i === active ? "" : undefined} className="step-visual col-start-1 row-start-1 grid place-items-center p-8">
              {s.visual}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
