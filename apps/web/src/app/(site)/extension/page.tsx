import type { Metadata } from "next";
import { TopicQuestions } from "@/components/site/more-sections";
import { Eye, Flag, Keyboard, Timer } from "@phosphor-icons/react/ssr";
import Image from "next/image";
import { Cta, PageHero, SectionTitle, SITE_VIEWPORT, SitePage } from "@/components/site/chrome";
import { BrowserTab } from "@/components/site/demos";

export const metadata: Metadata = { title: "Chrome extension · MoonlightC", description: "Let the AI in MoonlightC read and use the browser tabs you share with it." };
export const viewport = SITE_VIEWPORT;

const ZIP = "/downloads/moonlightc-chrome-extension.zip";

export default function Extension() {
  return (
    <SitePage>
      <PageHero title="Let the AI use your browser." body="Share a tab and the AI in MoonlightC can read it, click, type and open links there. Tabs you don't share stay private.">
        <a href={ZIP} download className="btn-primary px-7 py-3">
          Download the extension
        </a>
      </PageHero>

      <section aria-label="A shared tab" className="scene scene-short">
        <div className="scene-sticky flex flex-col items-center justify-center px-4 sm:px-6">
          <div className="scene-title pointer-events-none absolute inset-x-0 top-[14vh] z-10 px-4 text-center">
            <h2 className="text-[clamp(2.2rem,5.5vw,4rem)] leading-[1.05]">You stay in charge.</h2>
          </div>
          <div className="scene-grow card h-[min(30rem,60svh)] w-[min(100%,46rem)] rounded-[2rem] p-5 sm:p-8">
            <BrowserTab />
          </div>
          <p className="scene-caption mt-6 max-w-[46ch] text-center text-[var(--mist)]">Buying, sending, posting and deleting wait for you to click Allow, in a window the page can&apos;t draw over.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {(
            [
              [Eye, "Only tabs you share.", "Nothing is visible to the AI until you click Share this tab."],
              [Flag, "Always marked.", "A banner on every shared tab, with a Stop button."],
              [Keyboard, "One key to stop.", "Alt+Shift+M stops sharing every tab at once."],
              [Timer, "Ends on its own.", "Sharing stops after 15 minutes without use."],
            ] as const
          ).map(([Icon, t, b]) => (
            <div key={t}>
              <Icon className="size-8 text-[var(--tide)]" weight="light" aria-hidden />
              <h3 className="mt-4 text-lg">{t}</h3>
              <p className="mt-2 text-[var(--mist)]">{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-32 sm:px-6">
        <SectionTitle title="The real thing." body="Screenshots of the extension itself: a shared tab, the menu, and the window that asks before anything risky." />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            ["/extension/1-shared-tab.webp", "A shared tab, with the banner and its Stop button."],
            ["/extension/2-popup.webp", "The menu: share a tab, stop sharing, and see what the AI did."],
            ["/extension/3-confirm.webp", "Risky steps wait here until you click Allow."],
          ].map(([src, caption]) => (
            <figure key={src} className="">
              <div className="card overflow-hidden rounded-3xl p-2">
                <Image src={src} alt={caption} width={1280} height={800} className="h-auto w-full rounded-[1.1rem]" />
              </div>
              <figcaption className="mt-3 text-[var(--mist)]">{caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pt-32 sm:px-6">
        <SectionTitle title="Install it in a minute." body="Works in Chrome and Edge on a computer." />
        <ol className="mt-12 grid divide-y divide-[var(--line)] overflow-hidden rounded-3xl bg-white ring-1 ring-[var(--line)]">
          {[
            ["Download and unzip it.", "Right-click the file, then Extract all."],
            ["Open chrome://extensions.", "Turn on Developer mode, top right."],
            ["Click Load unpacked.", "Pick the moonlightc-chrome-extension folder (the one with manifest.json in it)."],
            ["Share a tab.", "On any tab, click the MoonlightC icon, then Share this tab. Ask the AI in Cowork to use it."],
          ].map(([t, b], i) => (
            <li key={t} className="grid grid-cols-[3rem_1fr] gap-4 bg-white p-7 sm:p-8">
              <span className="text-3xl font-medium tracking-tight text-[#aeb6c4]">{i + 1}</span>
              <div>
                <h3 className="text-xl">{t}</h3>
                <p className="mt-1 text-[var(--mist)]">{b}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <TopicQuestions topic="The Chrome extension" />

      <Cta title="Give the AI a hand." body="Free, open source, and it never sees a tab you didn't share.">
        <a href={ZIP} download className="btn-silver px-7 py-3">
          Download the extension
        </a>
      </Cta>
    </SitePage>
  );
}
