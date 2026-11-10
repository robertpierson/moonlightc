import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Cta, PageHero, SectionTitle, SITE_VIEWPORT, SitePage } from "@/components/site/chrome";
import { LessonPlayer } from "@/components/site/lesson";
import { LESSONS } from "@/components/site/lessons";
import { POSTERS } from "@/components/site/media";

export const metadata: Metadata = { title: "Learn · MoonlightC", description: "Short lessons filmed in the real MoonlightC app. Click any step to jump to it." };
export const viewport = SITE_VIEWPORT;

const INSTALL = [
  {
    title: "Install the desktop app",
    steps: [
      "Go to the Download page and click Download.",
      "Windows: open the installer. If Windows says it protected your PC, click More info, then Run anyway.",
      "Mac: drag MoonlightC into Applications. If macOS stops it, open System Settings, then Privacy & Security, and click Open Anyway.",
      "Linux: use the AppImage, or the .deb or .rpm for your system.",
    ],
    href: "/download",
    action: "Go to Download",
  },
  {
    title: "Install the web app on your phone",
    steps: [
      "Open the web app in your phone's browser.",
      "iPhone: tap Share, then Add to Home Screen.",
      "Android: tap the ⋮ menu, then Add to Home screen.",
      "It opens like any app, and your chats sync when you sign in.",
    ],
    href: "/app",
    action: "Open the web app",
  },
  {
    title: "Add the Chrome extension",
    steps: [
      "Download the extension and unzip it.",
      "In Chrome, go to chrome://extensions and turn on Developer mode.",
      "Click Load unpacked and pick the folder you unzipped.",
      "On any tab, click the MoonlightC icon and choose Share this tab.",
    ],
    href: "/extension",
    action: "See how it works",
  },
];

export default function Learn() {
  return (
    <SitePage>
      <PageHero title="Learn MoonlightC" body="Short lessons filmed in the real app. Click any step to jump to it, then try it yourself.">
        <a href="#connect" className="btn-primary px-7 py-3">
          Start with lesson 1
        </a>
      </PageHero>

      <section aria-label="All lessons" className="mx-auto max-w-6xl px-4 sm:px-6">
        <ol className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {LESSONS.map((l, i) => (
            <li key={l.id}>
              <a href={`#${l.id}`} className="group block">
                <div className="card overflow-hidden rounded-3xl p-1.5 transition-transform duration-300 group-hover:-translate-y-1">
                  <Image src={POSTERS[l.id]} alt="" sizes="(min-width: 1024px) 17rem, (min-width: 640px) 45vw, 92vw" className="h-auto w-full rounded-[1.2rem]" />
                </div>
                <p className="mt-3 text-sm text-[var(--faint)]">Lesson {i + 1}</p>
                <p className="font-medium group-hover:underline group-hover:underline-offset-4">{l.title}</p>
              </a>
            </li>
          ))}
        </ol>
      </section>

      {LESSONS.map((l, i) => (
        <section key={l.id} id={l.id} aria-labelledby={`${l.id}-title`} className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-28 sm:px-6">
          <p className="text-sm text-[var(--faint)]">Lesson {i + 1}</p>
          <h2 id={`${l.id}-title`} className="mt-1 text-[clamp(2rem,4.5vw,3rem)] leading-tight">
            {l.title}
          </h2>
          <p className="mt-2 mb-8 max-w-[60ch] text-lg text-[var(--mist)]">{l.intro}</p>
          <LessonPlayer src={`/learn/${l.id}.mp4`} poster={POSTERS[l.id].src} steps={l.steps} label={`Lesson: ${l.title}`} />
          <Link prefetch={false} href="/app" className="mt-6 inline-block text-sm font-medium text-[var(--tide)] underline-offset-4 hover:underline">
            Try it in the web app
          </Link>
        </section>
      ))}

      <section className="pt-32">
        <SectionTitle title="Get it on every device." body="Three short guides for installing MoonlightC." />
        <div className="mx-auto mt-14 grid max-w-6xl gap-12 px-4 sm:px-6 md:grid-cols-3">
          {INSTALL.map((g) => (
            <div key={g.title}>
              <h3 className="text-xl">{g.title}</h3>
              <ol className="mt-4 grid list-decimal gap-2 pl-5 text-[var(--mist)]">
                {g.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <Link prefetch={false} href={g.href} className="mt-4 inline-block text-sm font-medium text-[var(--tide)] underline-offset-4 hover:underline">
                {g.action}
              </Link>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-16 max-w-3xl px-4 text-center text-sm text-[var(--faint)]">
          The lessons are filmed in the real web app. The answers come from a sample server, so no AI company was paid to make them.
        </p>
      </section>

      <Cta title="Ready to try it?" body="Open the web app and connect your first key. Lesson 1 shows how.">
        <Link prefetch={false} href="/app" className="btn-silver px-7 py-3">
          Open web app
        </Link>
      </Cta>
    </SitePage>
  );
}
