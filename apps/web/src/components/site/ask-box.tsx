"use client";

import { useEffect, useState } from "react";

const EXAMPLES = [
  "Plan a 3-day trip to Chicago on a budget",
  "Why does my Python loop print the same number?",
  "Write a friendly reminder about Friday's rent",
  "Compare these two job offers for me",
  "Build a tip calculator that splits the bill",
];

/** Type a question here and the web app opens with it waiting in the message box. Nothing is sent until you press Send there. */
export function AskBox() {
  const [q, setQ] = useState("");
  const [hint, setHint] = useState(EXAMPLES[0]);
  // The placeholder types out one example, holds it, erases it, then types the next (it stays still under reduced motion).
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    let n = EXAMPLES[0].length;
    let hold = 40;
    let typing = false;
    const t = setInterval(() => {
      const full = EXAMPLES[i];
      if (typing) {
        n = Math.min(full.length, n + 1);
        if (n === full.length) typing = false;
      } else if (hold > 0) {
        hold--;
        return;
      } else {
        n = Math.max(0, n - 2);
        if (n === 0) {
          i = (i + 1) % EXAMPLES.length;
          typing = true;
          hold = 40;
        }
      }
      setHint(EXAMPLES[i].slice(0, n) || "Ask anything");
    }, 50);
    return () => clearInterval(t);
  }, []);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const text = q.trim();
        // A full page load, so the app reads the question from the address as it starts.
        location.assign(text ? `/app?q=${encodeURIComponent(text)}` : "/app");
      }}
      className="ask-box mx-auto flex w-full max-w-2xl items-center gap-2 rounded-full bg-white p-2 pl-6 shadow-[0_24px_60px_-28px_rgb(14_22_40/0.45),0_0_0_1px_var(--line)]"
    >
      <label htmlFor="ask" className="sr-only">
        Ask MoonlightC anything
      </label>
      <input
        id="ask"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={hint}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent py-3 text-lg text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
      />
      <button type="submit" className="btn-primary shrink-0 px-6 py-3">
        Ask
      </button>
    </form>
  );
}
