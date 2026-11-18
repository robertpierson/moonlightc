import type { Metadata } from "next";
import Link from "next/link";
import { Cta, PageHero, SITE_VIEWPORT, SitePage } from "@/components/site/chrome";
import { COURSE, LESSONS_FLAT, totalMinutes } from "@/components/site/course";
import { CourseProgress, LessonLink } from "@/components/site/course-progress";

export const metadata: Metadata = {
  title: "Course · MoonlightC",
  description: "A free course on everything in MoonlightC: models and free AI, commands, projects, building and shipping apps with Vercel and Supabase, Claude Code, remote control and themes.",
};
export const viewport = SITE_VIEWPORT;

export default function CoursePage() {
  return (
    <SitePage>
      <PageHero
        title="The MoonlightC course"
        body={`Everything in the app, from your first chat to shipping a real website. ${LESSONS_FLAT.length} short lessons, about ${Math.round(totalMinutes / 5) * 5} minutes in all. Free.`}
      >
        <Link href={`/course/${LESSONS_FLAT[0].slug}`} className="btn-primary px-7 py-3">
          Start lesson 1
        </Link>
      </PageHero>

      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <CourseProgress />

        <ol className="mt-16 grid gap-12">
          {COURSE.map((m, i) => (
            <li key={m.id} aria-labelledby={`m-${m.id}`} className="grid gap-6 md:grid-cols-[15rem_1fr] md:gap-10">
              <div>
                <p className="text-sm text-[var(--faint)]">Part {i + 1}</p>
                <h2 id={`m-${m.id}`} className="mt-1 text-2xl leading-tight">
                  {m.title}
                </h2>
                <p className="mt-2 text-[var(--mist)]">{m.summary}</p>
              </div>
              <ul className="card divide-y divide-[var(--line)] rounded-2xl p-2">
                {m.lessons.map((l) => (
                  <li key={l.slug}>
                    <LessonLink lesson={l} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>

      <Cta title="Learn by doing." body="Every lesson ends in the real app. Open it in another tab and follow along.">
        <Link prefetch={false} href="/app" className="btn-silver px-7 py-3 text-base">
          Open web app
        </Link>
      </Cta>
    </SitePage>
  );
}
