"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_CAMERA, DEMO_CHAPTERS } from "./pages";


/**
 * The real app on film. Plays while it's on screen (from `from` to the end, then again), and pauses when it isn't.
 * The chapter buttons jump to a part. Under reduced motion it waits for Play.
 */
/** Where the camera is at time t: zoom and offset (as % of the frame), eased between the points in DEMO_CAMERA. */
export function cameraAt(t: number) {
  const k = DEMO_CAMERA;
  let i = k.findLastIndex((p) => p[0] <= t);
  if (i < 0) i = 0;
  const a = k[i];
  const b = k[Math.min(i + 1, k.length - 1)];
  const u = b[0] > a[0] ? Math.min(1, (t - a[0]) / (b[0] - a[0])) : 0;
  const e = u * u * (3 - 2 * u);
  const [s, x, y] = [1, 2, 3].map((j) => a[j] + (b[j] - a[j]) * e);
  // Put the focus point in the middle, but never show past the frame's edges.
  const lim = (s - 1) * 50;
  const clamp = (v: number) => Math.max(-lim, Math.min(lim, v));
  return { s, tx: clamp(-s * (x - 0.5) * 100), ty: clamp(-s * (y - 0.5) * 100) };
}

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

  // The camera follows the film while it plays (and after a jump); it stays wide under reduced motion.
  useEffect(() => {
    const v = ref.current;
    if (!v || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const aim = () => {
      const { s, tx, ty } = cameraAt(v.currentTime);
      v.style.transform = `translate(${tx}%, ${ty}%) scale(${s})`;
    };
    const loop = () => {
      aim();
      raf = requestAnimationFrame(loop);
    };
    const play = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      aim();
    };
    v.addEventListener("play", play);
    v.addEventListener("pause", stop);
    v.addEventListener("seeked", aim);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("play", play);
      v.removeEventListener("pause", stop);
      v.removeEventListener("seeked", aim);
    };
  }, []);

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
          className="block aspect-[16/10] w-full origin-center will-change-transform"
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
                style={{ transform: `scaleX(${Math.min(1, (now - c.t) / ((chapters[i + 1]?.t ?? 27) - c.t))})` }}
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
export function StickySteps({ steps, device = "card" }: { steps: { title: string; body: string; visual: React.ReactNode }[]; device?: "card" | "phone" | "laptop" }) {
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
  const pictures = steps.map((s, i) => (
    <div key={s.title} aria-hidden={i !== active} data-active={i === active ? "" : undefined} className={`step-visual col-start-1 row-start-1 grid place-items-center ${device === "phone" ? "p-4 pt-12" : device === "laptop" ? "p-3 [&>*]:scale-[.86]" : "p-8"}`}>
      {s.visual}
    </div>
  ));
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-2 md:gap-16">
      <div className="relative md:pl-10">
        <div aria-hidden className="step-rail hidden md:block">
          <span style={{ transform: `scaleY(${(active + 1) / steps.length})` }} />
        </div>
        {steps.map((s, i) => (
          <div
            key={s.title}
            ref={(el) => void (refs.current[i] = el)}
            data-i={i}
            data-active={i === active ? "" : undefined}
            data-done={i < active ? "" : undefined}
            className="step relative flex flex-col justify-center py-10 md:min-h-[78vh] md:py-0"
          >
            <span aria-hidden className="step-dot top-1/2 hidden -translate-x-10 -translate-y-1/2 md:block" />
            {device === "phone" ? (
              <div className="device-phone mx-auto mb-8 w-[17rem] md:hidden">
                <div className="screen grid h-[31rem] place-items-center p-4 pt-12">{s.visual}</div>
              </div>
            ) : (
              <div className="card mb-8 grid aspect-[4/3] place-items-center overflow-hidden rounded-3xl p-6 md:hidden">{s.visual}</div>
            )}
            <h3 className="text-[clamp(1.9rem,3.4vw,3.1rem)] leading-[1.08]">{s.title}</h3>
            <p className="mt-5 max-w-[40ch] text-lg text-[var(--mist)] xl:text-xl">{s.body}</p>
          </div>
        ))}
      </div>
      <div className="hidden md:block">
        {device === "phone" ? (
          <div className="device-phone sticky top-[calc(50vh-19.5rem)] mx-auto w-[19.5rem]">
            <div className="screen grid h-[37.5rem]">{pictures}</div>
          </div>
        ) : device === "laptop" ? (
          <div className="device-laptop sticky top-[calc(50vh-12rem)]">
            <div className="lid">
              <div className="screen grid">{pictures}</div>
            </div>
            <div className="base" />
          </div>
        ) : (
          <div className="card sticky top-[calc(50vh-17rem)] grid h-[34rem] overflow-hidden rounded-[2rem]">{pictures}</div>
        )}
      </div>
    </div>
  );
}
