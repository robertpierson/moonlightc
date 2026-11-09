"use client";

import { useEffect, useRef, useState } from "react";

export type LessonStep = { t: number; title: string; body: string };

/**
 * A short film of the real app with its steps beside it: click a step to jump there, and the step being shown lights
 * up as the film plays. Plays (muted) once it scrolls into view; under reduced motion it waits for a click.
 */
export function LessonPlayer({ src, poster, steps, label }: { src: string; poster: string; steps: LessonStep[]; label: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  useEffect(() => {
    const v = video.current;
    if (!v || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.5 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  const active = steps.findLastIndex((s) => now >= s.t - 0.05);
  const go = (t: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = t;
    v.play().catch(() => {});
  };
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10">
      <div className="card overflow-hidden rounded-3xl p-2">
        <video
          ref={video}
          src={src}
          poster={poster}
          muted
          playsInline
          controls
          preload="metadata"
          aria-label={label}
          className="aspect-[16/10] w-full rounded-[1.1rem] bg-[#0b1020]"
          onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        />
      </div>
      <ol className="grid gap-2">
        {steps.map((s, i) => {
          const end = steps[i + 1]?.t ?? duration;
          const share = i === active && end > s.t ? Math.min(1, (now - s.t) / (end - s.t)) : i < active ? 1 : 0;
          return (
            <li key={s.t}>
              <button
                type="button"
                onClick={() => go(s.t)}
                aria-current={i === active ? "step" : undefined}
                className={`group relative w-full overflow-hidden rounded-2xl px-5 py-4 text-left transition-colors ${i === active ? "bg-[#f4f5f8] ring-1 ring-[var(--line)]" : "hover:bg-[#f7f8fa]"}`}
              >
                <span className="flex items-baseline gap-3">
                  <span className={`text-sm tabular-nums ${i === active ? "text-[var(--tide)]" : "text-[var(--faint)]"}`}>{i + 1}</span>
                  <span className="font-medium">{s.title}</span>
                </span>
                <span className="mt-1 block pl-6 text-[15px] text-[var(--mist)]">{s.body}</span>
                <span aria-hidden className="absolute inset-x-5 bottom-0 h-0.5 origin-left bg-[var(--tide)]" style={{ transform: `scaleX(${share})`, opacity: i === active ? 1 : 0 }} />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
