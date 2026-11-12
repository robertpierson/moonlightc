import { ArrowsClockwise, Gift, HardDrives, Tag, ToggleRight } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark, COMPANY_MARK } from "@/components/site/brands";
import { Cta, PageHero, SectionTitle, SITE_VIEWPORT, SitePage } from "@/components/site/chrome";
import { AutoRoutes, ModelMenu, QuickConnect } from "@/components/site/demos";
import { COMPANIES, DEMO_CHAPTERS } from "@/components/site/pages";
import { FeatureList, TopicQuestions, WatchLesson } from "@/components/site/more-sections";
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
        device="laptop"
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

      <section aria-labelledby="switch" className="scene night mt-24">
        <div className="scene-sticky flex flex-col items-center justify-center px-3 pt-16 sm:px-6">
          <div className="scene-title pointer-events-none absolute inset-x-0 top-[14vh] z-10 px-4 text-center">
            <h2 id="switch" className="on-night text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.02]">
              Switch mid-chat.
            </h2>
            <p className="on-night-soft mx-auto mt-3 max-w-[40ch] text-lg">Start with one model, ask the next question with another.</p>
          </div>
          <div className="w-[min(100%,72rem,calc((100svh-15rem)*1.6))]">
            <DemoVideo
              from={DEMO_CHAPTERS[1].t}
              chapters={DEMO_CHAPTERS.slice(1, 2)}
              frameClassName="scene-grow rounded-[1.25rem] shadow-[0_50px_120px_-40px_rgb(0_0_0/0.8)]"
              chipsClassName="hidden"
            />
          </div>
        </div>
      </section>

      <section className="pt-32">
        <SectionTitle title={`${COMPANIES.length} companies, one list.`} body="Plus models on your own PC, and any server that speaks the OpenAI API." />
        <div className="mx-auto mt-12 grid max-w-6xl grid-cols-2 overflow-hidden rounded-3xl bg-white ring-1 ring-[var(--line)] sm:grid-cols-3 lg:grid-cols-5">
          {[...COMPANIES, "Ollama on your PC", "Your own server"].map((c) => (
            <div key={c} className="flex items-center gap-3 px-5 py-7 font-medium tracking-tight shadow-[inset_-1px_-1px_0_var(--line)] last:col-span-2 sm:last:col-span-1">
              {COMPANY_MARK[c] ? <BrandMark icon={COMPANY_MARK[c]} className="size-6 text-[var(--tide)]" /> : <HardDrives className="size-6 text-[var(--tide)]" weight="light" aria-hidden />}
              {c}
            </div>
          ))}
        </div>
      </section>

      <FeatureList
        id="free"
        title="Start for free."
        body="Six of these companies have free plans. Add a key from one or more and pick Free in the model menu. MoonlightC handles the rest."
        columns={4}
        items={[
          { icon: Gift, title: "Free plans, together", body: "Google Gemini, Groq, Cerebras, Mistral, Cohere, and the free models on OpenRouter." },
          { icon: ArrowsClockwise, title: "Moves on by itself", body: "When one model is at its free limit or having problems, the next one answers. No error, no retry button." },
          { icon: Tag, title: "Says who answered", body: "Every answer from Free names the company and model that wrote it." },
          { icon: ToggleRight, title: "You choose the keys", body: "Each key has an In Free switch. Turn it off for a key with billing on, so it's never charged by accident." },
        ]}
      />
      <p className="mx-auto mt-10 max-w-6xl px-4 text-sm text-[var(--faint)] sm:px-6">
        Running your own FreeLLMAPI server? Add its address as Custom in Models and keys and every model it serves shows up too.
      </p>

      <WatchLesson id="connect" title="Connect a key in a minute." />
      <TopicQuestions topic="Keys and costs" />

      <Cta title="Your keys, every model." body="Open the web app and add your first key. It takes about a minute.">
        <Link prefetch={false} href="/app" className="btn-silver px-7 py-3">
          Open web app
        </Link>
      </Cta>
    </SitePage>
  );
}
