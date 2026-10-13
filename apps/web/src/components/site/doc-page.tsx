import { Bricolage_Grotesque } from "next/font/google";
import Link from "next/link";
import "@/components/site/site.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], axes: ["wdth", "opsz"], variable: "--font-display" });

export function DocPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className={`${display.variable} site min-h-dvh`}>
      <header className="mx-auto flex max-w-3xl items-center px-4 py-5 sm:px-6">
        <Link href="/" className="display text-xl font-semibold">
          MoonlightC
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-6 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:mt-2 [&_p]:mt-4 [&_p]:text-[var(--mist)] [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-[var(--mist)]">
        <h1 className="display pt-8 text-5xl font-bold">{title}</h1>
        <p>Last updated {updated}.</p>
        {children}
      </main>
    </div>
  );
}
