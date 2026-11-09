import type { Metadata } from "next";
import Link from "next/link";
import { Cta, PageHero, SectionTitle, SITE_VIEWPORT, SitePage } from "@/components/site/chrome";
import { RemoteScreen } from "@/components/site/demos";

export const metadata: Metadata = { title: "Remote control · MoonlightC", description: "See and use your home PC from your phone or Chromebook, safely." };
export const viewport = SITE_VIEWPORT;

const SETUP = [
  ["Install the desktop app on your PC.", "It runs quietly in the tray and keeps the PC reachable."],
  ["Sign in with two-step sign-in.", "Remote control only works on accounts with a second step, like an authenticator code."],
  ["Open MoonlightC on another device.", "Your phone, a Chromebook, a work laptop. Pick your PC and connect."],
  ["Allow it on the PC.", "The first time, the PC asks. Nothing connects until you say yes."],
];

export default function Remote() {
  return (
    <SitePage>
      <PageHero title="Your PC, from anywhere." body="See your home PC's screen, click, type, open files and run its local models, from any device you've approved.">
        <Link href="/download" className="btn-primary px-7 py-3">
          Get the desktop app
        </Link>
      </PageHero>

      <section aria-label="Your PC's screen on another device" className="scene night">
        <div className="scene-sticky flex flex-col items-center justify-center px-4 sm:px-6">
          <div className="scene-title pointer-events-none absolute inset-x-0 top-[14vh] z-10 px-4 text-center">
            <h2 className="on-night text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.02]">Your screen, in your pocket.</h2>
          </div>
          <div className="scene-grow card w-[min(100%,64rem)] rounded-[2rem] px-5 pt-10 sm:px-14 sm:pt-14">
            <RemoteScreen />
          </div>
          <p className="scene-caption mt-6 max-w-[48ch] text-center">
            <span className="on-night-soft">The pointer, keyboard and screen go straight between your devices. A relay helps only on networks that block that.</span>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <SectionTitle title="Safe by default." />
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            ["You approve every device.", "A new device can't connect until you allow it on the PC."],
            ["You always know.", "The PC shows a banner while someone is connected, with a button to end it right away."],
            ["It ends by itself.", "Sessions close when you leave, and after a stretch of no use."],
          ].map(([t, b]) => (
            <div key={t} className="card rise rounded-3xl p-8">
              <h3 className="text-xl">{t}</h3>
              <p className="mt-2 text-[var(--mist)]">{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pt-32 sm:px-6">
        <SectionTitle title="Set up in four steps." />
        <ol className="mt-12 grid divide-y divide-[var(--line)] overflow-hidden rounded-3xl bg-white ring-1 ring-[var(--line)]">
          {SETUP.map(([t, b], i) => (
            <li key={t} className="rise grid grid-cols-[3rem_1fr] gap-4 bg-white p-7 sm:p-8">
              <span className="text-3xl font-medium tracking-tight text-[#aeb6c4]">{i + 1}</span>
              <div>
                <h3 className="text-xl">{t}</h3>
                <p className="mt-1 text-[var(--mist)]">{b}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Cta title="Bring your PC along." body="Install the desktop app on the PC you want to reach. It's free.">
        <Link href="/download" className="btn-silver px-7 py-3">
          Get the desktop app
        </Link>
      </Cta>
    </SitePage>
  );
}
