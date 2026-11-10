import Image from "next/image";
import Link from "next/link";
import { SectionTitle } from "./chrome";
import { LessonPlayer } from "./lesson";
import { LESSONS } from "./lessons";
import { POSTERS } from "./media";
import { QUESTIONS, QuestionList } from "./questions";

/** A lesson from the Learn page, embedded where it's relevant. */
export function WatchLesson({ id, title }: { id: string; title?: string }) {
  const l = LESSONS.find((x) => x.id === id)!;
  return (
    <section aria-labelledby={`watch-${id}`} className="mx-auto max-w-6xl px-4 pt-32 sm:px-6">
      <h2 id={`watch-${id}`} className="text-[clamp(2.2rem,5.5vw,3.75rem)] leading-[1.05]">
        {title ?? l.title}
      </h2>
      <p className="mt-3 mb-10 max-w-[60ch] text-lg text-[var(--mist)]">
        {l.intro} Click a step to jump to it.{" "}
        <Link href="/learn" className="text-[var(--tide)] underline underline-offset-4">
          More lessons
        </Link>
      </p>
      <LessonPlayer src={`/learn/${l.id}.mp4`} poster={POSTERS[l.id].src} steps={l.steps} label={`Lesson: ${l.title}`} />
    </section>
  );
}

/** One topic from the Questions page. */
export function TopicQuestions({ topic }: { topic: string }) {
  const g = QUESTIONS.find((x) => x.topic === topic)!;
  return (
    <section aria-labelledby="page-questions" className="faq mx-auto max-w-3xl px-4 pt-32 sm:px-6">
      <h2 id="page-questions" className="mb-8 text-center text-[clamp(2rem,4.5vw,2.75rem)]">
        Questions
      </h2>
      <QuestionList items={g.items} />
      <p className="mt-6 text-center">
        <Link href="/questions" className="text-sm font-medium text-[var(--tide)] underline-offset-4 hover:underline">
          See all questions
        </Link>
      </p>
    </section>
  );
}

/** Home page: a few lessons to start with. */
export function LearnTeaser() {
  return (
    <section id="learn" aria-label="Learn" className="pt-32">
      <SectionTitle title="Learn it in minutes." body="Short lessons filmed in the real app. Click any step to jump to it." />
      <ol className="mx-auto mt-14 grid max-w-6xl gap-x-5 gap-y-8 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {LESSONS.slice(0, 4).map((l, i) => (
          <li key={l.id}>
            <Link href={`/learn#${l.id}`} className="group block">
              <div className="card overflow-hidden rounded-3xl p-1.5 transition-transform duration-300 group-hover:-translate-y-1">
                <Image src={POSTERS[l.id]} alt="" sizes="(min-width: 1024px) 17rem, (min-width: 640px) 45vw, 92vw" className="h-auto w-full rounded-[1.2rem]" />
              </div>
              <p className="mt-3 text-sm text-[var(--faint)]">Lesson {i + 1}</p>
              <p className="font-medium group-hover:underline group-hover:underline-offset-4">{l.title}</p>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-10 text-center">
        <Link href="/learn" className="btn-silver px-6 py-2.5 text-sm">
          All lessons
        </Link>
      </p>
    </section>
  );
}
