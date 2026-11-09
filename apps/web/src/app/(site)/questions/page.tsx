import type { Metadata } from "next";
import Link from "next/link";
import { Cta, SITE_VIEWPORT, SitePage } from "@/components/site/chrome";
import { QUESTIONS, QuestionList } from "@/components/site/questions";

export const metadata: Metadata = { title: "Questions · MoonlightC", description: "Answers about keys, costs, privacy, the desktop app and the Chrome extension." };
export const viewport = SITE_VIEWPORT;

export default function Questions() {
  return (
    <SitePage>
      <section className="faq mx-auto max-w-3xl px-4 pt-20 sm:px-6">
        <h1 className="text-[clamp(2.8rem,7vw,4.5rem)] leading-[1.02]">Questions</h1>
        <p className="mt-4 text-lg text-[var(--mist)]">
          Can&apos;t find yours?{" "}
          <a href="https://github.com/robertpierson/moonlightc/issues/new" className="text-[var(--tide)] underline underline-offset-4">
            Ask on GitHub
          </a>
          .
        </p>
        <nav aria-label="Topics" className="mt-8 flex flex-wrap gap-2">
          {QUESTIONS.map((g, i) => (
            <a key={g.topic} href={`#topic-${i}`} className="rounded-full px-4 py-2 text-sm ring-1 ring-[var(--line)] hover:bg-[#f4f5f8]">
              {g.topic}
            </a>
          ))}
        </nav>
        {QUESTIONS.map((g, i) => (
          <section key={g.topic} id={`topic-${i}`} aria-labelledby={`topic-${i}-title`} className="scroll-mt-24 pt-16">
            <h2 id={`topic-${i}-title`} className="mb-4 text-2xl">
              {g.topic}
            </h2>
            <QuestionList items={g.items} />
          </section>
        ))}
      </section>
      <Cta title="Learn by watching." body="Short lessons filmed in the real app, from your first key to building an app.">
        <Link href="/learn" className="btn-silver px-7 py-3">
          Go to Learn
        </Link>
      </Cta>
    </SitePage>
  );
}
