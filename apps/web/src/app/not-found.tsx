import Link from "next/link";
import { SITE_VIEWPORT, SitePage } from "@/components/site/chrome";
import { SiteLight } from "@/components/site/site-light";

export const viewport = SITE_VIEWPORT;

/** Any address that doesn't exist: say so plainly and offer the two places people usually want. */
export default function NotFound() {
  return (
    <SitePage>
      <SiteLight />
      <section className="sky -mt-16 flex min-h-[80svh] flex-col items-center justify-center px-4 pt-16 text-center">
        <p aria-hidden className="text-[clamp(6rem,20vw,12rem)] leading-none font-semibold tracking-[-0.06em] text-[#c9cfd9]">404</p>
        <h1 className="mt-2 text-[clamp(2rem,5vw,3.25rem)] leading-tight">This page isn&apos;t here.</h1>
        <p className="mt-4 max-w-[40ch] text-lg text-[var(--mist)]">The link may be old or mistyped. Try the home page, or go straight to the app.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-primary px-6 py-3">
            Go to the home page
          </Link>
          <Link prefetch={false} href="/app" className="btn-silver px-6 py-3">
            Open web app
          </Link>
        </div>
      </section>
    </SitePage>
  );
}
