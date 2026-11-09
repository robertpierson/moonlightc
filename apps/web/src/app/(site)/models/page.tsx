import type { Metadata } from "next";
import Link from "next/link";
import { Cta, PageHero, SectionTitle, SITE_VIEWPORT, SitePage } from "@/components/site/chrome";
import { AutoRoutes, ModelMenu, QuickConnect } from "@/components/site/demos";
import { COMPANIES } from "@/components/site/landing";
import { DEMO_CHAPTERS } from "@/components/site/pages";
import { DemoVideo, StickySteps } from "@/components/site/scenes";

export const metadata: Metadata = { title: "Models · MoonlightC", description: "Claude, GPT, Gemini, Grok and more in one app, with your own keys." };
export const viewport = SITE_VIEWPORT;

export default function Models() {
  return (
    <SitePage>
      <PageHero title="Every model. Your keys." body="Bring a key from any AI company. MoonlightC lists everything it unlocks, live, and lets you switch whenever you like.">
        <Link prefetch={false} href="/app" className="btn-primary px-7 py-3">
          Open web app
        </Link>
      </PageHero>

      <StickySteps
        steps={[
          {
            title: "Add a key once.",
            body: "Pick a company and copy a key on its site. MoonlightC notices the copied key, checks that it works, and connects. Keys stay on your device, and sync encrypted if you sign in.",
            visual: <QuickConnect />,
          },
          {
            title: "Every model shows up.",
            body: "MoonlightC asks each company what your key unlocks, so the list is always current. New models appear on their own.",
            visual: <ModelMenu />,
          },
          {
            title: "Or let Auto choose.",
            body: "Pick a model for coding, one for deep thinking and a fast one for quick questions. Auto sends each message to the right one.",
            visual: <AutoRoutes />,
          },
        ]}
      />

      <section className="mx-auto max-w-5xl px-4 pt-32 sm:px-6">
        <SectionTitle title="Switch in the middle of a chat." body="Start with one model, ask the next question with another. The conversation carries over." />
        <div className="rise mt-12">
          <DemoVideo from={DEMO_CHAPTERS[1].t} chapters={DEMO_CHAPTERS.slice(1, 2)} frameClassName="rounded-[1.25rem] shadow-[0_40px_100px_-40px_rgb(14_22_40/0.55)]" chipsClassName="hidden" />
        </div>
      </section>

      <section className="pt-32">
        <SectionTitle title={`${COMPANIES.length} companies, one list.`} body="Plus models on your own PC, and any server that speaks the OpenAI API." />
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-2 overflow-hidden rounded-3xl bg-white ring-1 ring-[var(--line)] sm:grid-cols-3 md:grid-cols-4">
          {[...COMPANIES, "Ollama on your PC", "Your own server"].map((c) => (
            <div key={c} className="rise px-6 py-7 text-lg font-medium tracking-tight shadow-[inset_-1px_-1px_0_var(--line)]">
              {c}
            </div>
          ))}
        </div>
      </section>

      <Cta title="Your keys, every model." body="Open the web app and add your first key. It takes about a minute.">
        <Link prefetch={false} href="/app" className="btn-silver px-7 py-3">
          Open web app
        </Link>
      </Cta>
    </SitePage>
  );
}
