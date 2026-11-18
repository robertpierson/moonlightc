"use client";

import { CheckCircle, Circle } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { LESSONS_FLAT, type Lesson } from "./course";

// Which lessons you've finished, kept in this browser only.
const KEY = "moonc:course";
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};
const snapshot = () => {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
};

export function useDone(): Set<string> {
  const s = useSyncExternalStore(subscribe, snapshot, () => "[]");
  try {
    return new Set(JSON.parse(s) as string[]);
  } catch {
    return new Set();
  }
}

export function markDone(slug: string, done = true) {
  const now = new Set(read());
  if (done) now.add(slug);
  else now.delete(slug);
  try {
    localStorage.setItem(KEY, JSON.stringify([...now]));
  } catch {}
  listeners.forEach((f) => f());
}

/** "4 of 23 lessons done" with a bar, and a button to the next unfinished lesson. */
export function CourseProgress() {
  const done = useDone();
  const count = LESSONS_FLAT.filter((l) => done.has(l.slug)).length;
  const next = LESSONS_FLAT.find((l) => !done.has(l.slug));
  const pct = Math.round((count / LESSONS_FLAT.length) * 100);
  return (
    <div className="card flex flex-col gap-5 rounded-3xl p-6 sm:flex-row sm:items-center sm:p-8">
      <div className="flex-1">
        <p className="text-lg font-medium" aria-live="polite">
          {count === 0 ? "Start whenever you like." : count === LESSONS_FLAT.length ? "You finished the course." : `${count} of ${LESSONS_FLAT.length} lessons done`}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#cfd7e2]" role="progressbar" aria-label="Course progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-[var(--tide)] transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-[var(--mist)]">Saved in this browser. No account needed.</p>
      </div>
      {next ? (
        <Link href={`/course/${next.slug}`} className="btn-primary shrink-0 px-6 py-3">
          {count ? "Continue" : "Start the course"}
        </Link>
      ) : (
        <Link href="/app" className="btn-primary shrink-0 px-6 py-3">
          Open the app
        </Link>
      )}
    </div>
  );
}

/** A lesson row in the course outline, with a tick once it's done. */
export function LessonLink({ lesson }: { lesson: Lesson }) {
  const done = useDone().has(lesson.slug);
  return (
    <Link href={`/course/${lesson.slug}`} className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-white/60">
      {done ? <CheckCircle weight="fill" className="size-5 shrink-0 text-[var(--tide)]" aria-label="Done" /> : <Circle className="size-5 shrink-0 text-[#8d97a8]" aria-hidden />}
      <span className="flex-1 font-medium group-hover:underline group-hover:underline-offset-4">{lesson.title}</span>
      <span className="shrink-0 text-sm text-[var(--faint)]">{lesson.minutes} min</span>
    </Link>
  );
}

/** One question to check yourself, then "Mark as done". */
export function LessonCheck({ lesson }: { lesson: Lesson }) {
  const [picked, setPicked] = useState<number>();
  const done = useDone().has(lesson.slug);
  const right = picked === lesson.check.answer;
  // Answering correctly marks the lesson done.
  useEffect(() => {
    if (right) markDone(lesson.slug);
  }, [right, lesson.slug]);
  return (
    <section aria-labelledby="check-h" className="card rounded-3xl p-6 sm:p-8">
      <h2 id="check-h" className="text-xl">
        Check yourself
      </h2>
      <fieldset className="mt-4">
        <legend className="text-[var(--ink)]">{lesson.check.q}</legend>
        <div className="mt-4 grid gap-2">
          {lesson.check.options.map((o, i) => {
            const chosen = picked === i;
            return (
              <label
                key={o}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  chosen ? (right ? "border-[#2f6b4f] bg-[#e3efe9]" : "border-[#9a3b3b] bg-[#f3e4e4]") : "border-[var(--line)] bg-white/50 hover:bg-white/80"
                }`}
              >
                <input type="radio" name={`q-${lesson.slug}`} className="mt-1 accent-[var(--tide)]" checked={chosen} onChange={() => setPicked(i)} />
                <span>{o}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <p aria-live="polite" className="mt-4 min-h-6 text-[var(--mist)]">
        {picked === undefined ? "" : right ? `Right. ${lesson.check.why}` : "Not quite. Try another answer."}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => markDone(lesson.slug, !done)} className="btn-silver px-5 py-2.5 text-sm">
          {done ? "Mark as not done" : "Mark as done"}
        </button>
        {done && <span className="text-sm text-[#2f6b4f]">Lesson done</span>}
      </div>
    </section>
  );
}
