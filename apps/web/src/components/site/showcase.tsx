"use client";

import type { Icon } from "@phosphor-icons/react";
import { AppWindow, Browser, ChatsCircle, Code, Desktop, GlobeSimple, PuzzlePiece } from "@phosphor-icons/react/ssr";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { BrowserTab, CodeTerminal, ModelMenu, RemoteScreen } from "./demos";
import { SHOTS } from "./media";

interface Tab {
  label: string;
  icon: Icon;
  title: string;
  body: string;
  href: string;
  action: string;
  visual: () => React.ReactNode;
}

const shot = (src: StaticImageData | string, alt: string) =>
  function Shot() {
    return (
      <Image
        src={src}
        alt={alt}
        width={1280}
        height={800}
        sizes="(min-width: 768px) 32rem, 90vw"
        className="aspect-[16/10] h-auto w-full rounded-xl object-cover object-left-top shadow-[0_24px_50px_-24px_rgb(14_22_40/0.45)] ring-1 ring-[var(--line)]"
      />
    );
  };

const POWERS: Tab[] = [
  { label: "Chat", icon: ChatsCircle, title: "Every model, your keys", body: "Claude, GPT, Gemini and more, switched in the middle of a conversation.", href: "/models", action: "Learn more", visual: ModelMenu },
  { label: "Code", icon: Code, title: "Build with AI", body: "Describe an app and watch it run. Or run Claude Code in your own projects.", href: "/code", action: "Learn more", visual: CodeTerminal },
  { label: "Your PC", icon: Desktop, title: "Your PC, from anywhere", body: "See your home PC's screen, click and type, from your phone or Chromebook.", href: "/remote", action: "Learn more", visual: RemoteScreen },
  { label: "Browser", icon: Browser, title: "AI in your browser", body: "Share a tab and the AI reads, clicks and types there. Risky steps wait for you.", href: "/extension", action: "Learn more", visual: BrowserTab },
];

const PLACES: Tab[] = [
  {
    label: "Desktop",
    icon: AppWindow,
    title: "The desktop app",
    body: "Windows, Mac and Linux. Adds remote control, models on your own PC, and Claude Code.",
    href: "/download",
    action: "Download",
    visual: shot(SHOTS.chat, "MoonlightC desktop app with a chat open"),
  },
  {
    label: "Web",
    icon: GlobeSimple,
    title: "In any browser",
    body: "Nothing to install. Works on any computer, phone or Chromebook, and installs like an app.",
    href: "/app",
    action: "Open web app",
    visual: shot(SHOTS.models, "MoonlightC web app with the model menu open"),
  },
  {
    label: "Chrome",
    icon: PuzzlePiece,
    title: "Inside Chrome",
    body: "The extension lets the AI read and use the tabs you share with it. Nothing else.",
    href: "/extension",
    action: "Get the extension",
    visual: shot("/extension/1-shared-tab.webp", "The MoonlightC extension working in a shared Chrome tab"),
  },
];

function Tabbed({ tabs, label, demo }: { tabs: Tab[]; label: string; demo?: boolean }) {
  const [on, pick] = useState(0);
  const [picked, setPicked] = useState(false); // settle-in motion only after someone picks a tab, not on page load
  const setOn = (i: number) => {
    pick(i);
    setPicked(true);
  };
  const id = useId();
  const t = tabs[on];
  const Visual = t.visual;
  return (
    <div className="mt-12">
      <div role="tablist" aria-label={label} className="mx-auto grid w-full auto-cols-fr grid-flow-col gap-1 rounded-full sm:flex sm:w-fit bg-[#d4dbe5] p-1.5 shadow-[inset_0_1px_2px_rgb(14_22_40/0.08)]">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            role="tab"
            id={`${id}-t${i}`}
            aria-selected={on === i}
            aria-controls={`${id}-p`}
            tabIndex={on === i ? 0 : -1}
            onClick={() => setOn(i)}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (!d) return;
              const n = (i + d + tabs.length) % tabs.length;
              setOn(n);
              document.getElementById(`${id}-t${n}`)?.focus();
            }}
            className={`flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[13px] font-medium whitespace-nowrap transition-colors sm:gap-2 sm:px-5 sm:text-sm ${
              on === i
                ? "metal text-[var(--ink)] shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_1px_3px_rgb(14_22_40/0.12),0_0_0_1px_var(--line)]"
                : "text-[var(--mist)] hover:text-[var(--ink)]"
            }`}
          >
            <tab.icon className="size-4 shrink-0" weight={on === i ? "fill" : "regular"} />
            {tab.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${id}-p`}
        aria-labelledby={`${id}-t${on}`}
        className="card mt-8 grid items-center gap-8 overflow-hidden rounded-3xl p-7 sm:p-10 md:grid-cols-[1fr_1.15fr] md:gap-12 md:p-14"
      >
        <div key={`c${on}`} className={picked ? "tab-in" : ""}>
          <h3 className="text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.05] tracking-[-0.02em]">{t.title}</h3>
          <p className="mt-3 max-w-[38ch] text-lg text-[var(--mist)]">{t.body}</p>
          <Link prefetch={false} href={t.href} className="btn-silver mt-7 px-6 py-2.5 text-sm">
            {t.action}
          </Link>
        </div>
        <div key={`d${on}`} className={`${picked ? "tab-in" : ""} ${demo ? "h-64" : ""}`}>
          <Visual />
        </div>
      </div>
    </div>
  );
}

/** The four big things the app does, a tab each, with a live demo. */
export const Superpowers = () => <Tabbed tabs={POWERS} label="Parts of the app" demo />;

/** Where you can use it: desktop, browser, Chrome. */
export const Places = () => <Tabbed tabs={PLACES} label="Ways to use MoonlightC" />;
