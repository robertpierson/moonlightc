import { SiteFooter, SiteHeader } from "./chrome";

export function DocPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="site flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 sm:px-6 [&_h2]:mt-12 [&_h2]:text-2xl [&_li]:mt-2 [&_p]:mt-4 [&_p]:leading-relaxed [&_p]:text-[var(--mist)] [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-[var(--mist)]">
        <h1 className="pt-16 text-[clamp(2.6rem,7vw,4rem)] leading-none">{title}</h1>
        <p>Last updated {updated}.</p>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
