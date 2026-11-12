import type { Metadata } from "next";
import { ArrowCounterClockwise, Browser, DownloadSimple, Files, GithubLogo, HandPalm } from "@phosphor-icons/react/ssr";
import { FeatureList, WatchLesson } from "@/components/site/more-sections";
import Link from "next/link";
import { Cta, PageHero, SITE_VIEWPORT, SitePage } from "@/components/site/chrome";
import { CodeModes, CodeTerminal, LocalModels } from "@/components/site/demos";
import { DEMO_CHAPTERS } from "@/components/site/pages";
import { DemoVideo, StickySteps } from "@/components/site/scenes";

export const metadata: Metadata = { title: "Code · MoonlightC", description: "Describe an app and watch it run, or run Claude Code in your own projects." };
export const viewport = SITE_VIEWPORT;

export default function Code() {
  return (
    <SitePage>
      <PageHero title="Build with AI, on any device." body="Describe an app and watch it run, right in the browser. On your PC, run Claude Code and terminals in your own projects.">
        <Link prefetch={false} href="/app" className="btn-primary px-7 py-3">
          Open web app
        </Link>
      </PageHero>

      <section aria-label="Building an app in the Code tab" className="scene night">
        <div className="scene-sticky flex flex-col items-center justify-center px-3 pt-16 sm:px-6">
          <div className="scene-title pointer-events-none absolute inset-x-0 top-[14vh] z-10 px-4 text-center">
            <h2 className="on-night text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.02]">Say it. See it run.</h2>
          </div>
          <div className="w-[min(100%,72rem,calc((100svh-15rem)*1.6))]">
            <DemoVideo
              from={DEMO_CHAPTERS[2].t}
              chapters={DEMO_CHAPTERS.slice(2)}
              frameClassName="scene-grow rounded-[1.25rem] shadow-[0_50px_120px_-40px_rgb(14_22_40/0.6)]"
              chipsClassName="scene-caption"
            />
          </div>
        </div>
      </section>

      <StickySteps
        device="laptop"
        steps={[
          {
            title: "Claude Code, on your PC.",
            body: "With the desktop app, MoonlightC runs Claude Code and terminals in your real projects, with your own sign-in. Reach them from any device.",
            visual: (
              <div className="h-64 w-full max-w-md">
                <CodeTerminal />
              </div>
            ),
          },
          {
            title: "You decide how much it does alone.",
            body: "Ask before every change, let edits through, have it plan first, or let it run. Switch any time.",
            visual: <CodeModes />,
          },
          {
            title: "Open models, on your hardware.",
            body: "Download open models to your PC with one click. They run on your own hardware, with no cost per message.",
            visual: (
              <div className="h-64 w-full max-w-sm">
                <LocalModels />
              </div>
            ),
          },
        ]}
      />

      <FeatureList
        id="inside"
        title="Inside the workspace."
        body="Everything happens in one place: you describe, the AI writes, and you try it right away."
        items={[
          { icon: Browser, title: "Live preview", body: "Your app runs beside the chat as soon as the AI writes it. Click around and use it." },
          { icon: Files, title: "Every file", body: "See the files the AI made and read the code whenever you want." },
          { icon: ArrowCounterClockwise, title: "Changes you can undo", body: "Each change is listed with what it did. Undo any of them in one click." },
          { icon: HandPalm, title: "How much it does alone", body: "Ask before every change, let edits through, plan only, or let it run." },
          { icon: DownloadSimple, title: "Download it", body: "Take the whole project as a .zip and open it anywhere." },
          { icon: GithubLogo, title: "Put it on GitHub", body: "Connect GitHub and publish the project to your own account." },
        ]}
      />

      <WatchLesson id="code" title="Watch it build an app." />

      <Cta title="Start a project." body="Open the Code tab, describe what you want, and try it a minute later.">
        <Link prefetch={false} href="/app" className="btn-silver px-7 py-3">
          Open web app
        </Link>
        <Link href="/download" className="rounded-full px-7 py-3 font-medium text-white ring-1 ring-white/25 transition hover:bg-white/10">
          Get the desktop app
        </Link>
      </Cta>
    </SitePage>
  );
}
