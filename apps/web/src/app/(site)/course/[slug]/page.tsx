import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_VIEWPORT, SitePage } from "@/components/site/chrome";
import { LESSONS_FLAT, lessonAt } from "@/components/site/course";
import { LessonCheck } from "@/components/site/course-progress";
import { POSTERS } from "@/components/site/media";

export const viewport = SITE_VIEWPORT;
type Props = { params: Promise<{ slug: string }> };

export const generateStaticParams = () => LESSONS_FLAT.map((l) => ({ slug: l.slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const at = lessonAt((await params).slug);
  return at ? { title: `${at.lesson.title} · MoonlightC course`, description: at.lesson.goal } : {};
}

export default async function LessonPage({ params }: Props) {
  const at = lessonAt((await params).slug);
  if (!at) notFound();
  const { lesson, prev, next, index } = at;
  return (
    <SitePage>
      <article className="mx-auto max-w-3xl px-4 pt-10 pb-8 sm:px-6 sm:pt-16">
        <nav aria-label="Breadcrumb" className="text-sm text-[var(--mist)]">
          <Link href="/course" className="underline-offset-4 hover:text-[var(--ink)] hover:underline">
            Course
          </Link>
          <span aria-hidden className="mx-2">
            /
          </span>
          {lesson.module.title}
        </nav>
        <h1 className="mt-4 text-[clamp(2.2rem,5.5vw,3.5rem)] leading-[1.05]">{lesson.title}</h1>
        <p className="mt-4 text-xl text-[var(--mist)]">{lesson.goal}</p>
        <p className="mt-3 text-sm text-[var(--faint)]">
          Lesson {index + 1} of {LESSONS_FLAT.length}, about {lesson.minutes} minutes
        </p>

        <ol className="mt-12 grid gap-8">
          {lesson.steps.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[2.25rem_1fr] gap-4">
              <span aria-hidden className="metal grid size-9 place-items-center rounded-full text-sm font-medium shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_0_0_1px_var(--line)]">
                {i + 1}
              </span>
              <div className="min-w-0 pt-1">
                <h2 className="text-xl">{s.title}</h2>
                <p className="mt-1.5 text-[var(--mist)]">{s.body}</p>
                {s.code && (
                  <pre tabIndex={0} aria-label="Commands to type" className="card-night mt-4 overflow-x-auto rounded-xl px-4 py-3 font-mono text-sm leading-6">
                    <code>{s.code}</code>
                  </pre>
                )}
              </div>
            </li>
          ))}
        </ol>

        {lesson.tip && (
          <aside aria-label="Tip" className="mt-10 rounded-2xl border border-[var(--line)] bg-white/40 px-5 py-4 text-[var(--mist)]">
            <strong className="font-medium text-[var(--ink)]">Tip: </strong>
            {lesson.tip}
          </aside>
        )}

        {lesson.film && POSTERS[lesson.film] && (
          <Link href={`/learn#${lesson.film}`} className="group mt-10 block">
            <div className="card overflow-hidden rounded-2xl p-1.5">
              <Image src={POSTERS[lesson.film]} alt={`Film of this in the real app: ${lesson.title}`} sizes="(min-width: 768px) 48rem, 92vw" className="h-auto w-full rounded-xl" />
            </div>
            <span className="mt-2 inline-block text-sm font-medium text-[var(--tide)] group-hover:underline group-hover:underline-offset-4">Watch it in the real app</span>
          </Link>
        )}

        <div className="mt-12">
          <LessonCheck lesson={lesson} />
        </div>

        {lesson.go && (
          <p className="mt-8">
            <Link prefetch={false} href={lesson.go.href} className="btn-primary px-6 py-3">
              {lesson.go.label}
            </Link>
          </p>
        )}

        <nav aria-label="Lessons" className="mt-14 grid gap-3 border-t border-[var(--line)] pt-8 sm:grid-cols-2">
          {prev ? (
            <Link href={`/course/${prev.slug}`} className="group rounded-2xl p-3 hover:bg-white/50">
              <span className="block text-sm text-[var(--faint)]">Previous</span>
              <span className="font-medium group-hover:underline group-hover:underline-offset-4">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/course/${next.slug}`} className="group rounded-2xl p-3 text-right hover:bg-white/50">
              <span className="block text-sm text-[var(--faint)]">Next</span>
              <span className="font-medium group-hover:underline group-hover:underline-offset-4">{next.title}</span>
            </Link>
          ) : (
            <Link href="/course" className="group rounded-2xl p-3 text-right hover:bg-white/50">
              <span className="block text-sm text-[var(--faint)]">Finished</span>
              <span className="font-medium group-hover:underline group-hover:underline-offset-4">Back to the course</span>
            </Link>
          )}
        </nav>
      </article>
    </SitePage>
  );
}
