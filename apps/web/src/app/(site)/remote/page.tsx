import type { Metadata } from "next";
import { FeatureList, TopicQuestions } from "@/components/site/more-sections";
import { Bell, ClockCounterClockwise, Copy, Cpu, Devices, FolderOpen, GameController, MapPin, Monitor, Power, Robot, ShieldCheck, Sliders, TerminalWindow, Timer } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Cta, PageHero, SectionTitle, SITE_VIEWPORT, SitePage } from "@/components/site/chrome";
import { PhoneConnected, PhonePcOnline, PhonePickPc, PhoneTwoStep, RemoteScreen } from "@/components/site/demos";
import { StickySteps } from "@/components/site/scenes";

export const metadata: Metadata = { title: "Remote control · MoonlightC", description: "See and use your home PC from your phone or Chromebook, safely." };
export const viewport = SITE_VIEWPORT;

const SETUP = [
  { title: "Install the desktop app on your PC.", body: "It runs quietly in the tray and keeps the PC reachable.", visual: <PhonePcOnline /> },
  { title: "Sign in with two-step sign-in.", body: "Remote control only works on accounts with a second step, like an authenticator code.", visual: <PhoneTwoStep /> },
  { title: "Open MoonlightC on another device.", body: "Your phone, a Chromebook, a work laptop. Pick your PC and connect.", visual: <PhonePickPc /> },
  { title: "Allow it on the PC.", body: "The first time, the PC asks. Nothing connects until you say yes.", visual: <PhoneConnected /> },
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
          {(
            [
              [ShieldCheck, "You approve every device.", "A new device can't connect until you allow it on the PC."],
              [Bell, "You always know.", "The PC shows a banner while someone is connected, with a button to end it right away."],
              [Timer, "It ends by itself.", "Sessions close when you leave, and after a stretch of no use."],
            ] as const
          ).map(([Icon, t, b]) => (
            <div key={t}>
              <Icon className="size-8 text-[var(--tide)]" weight="light" aria-hidden />
              <h3 className="mt-4 text-xl">{t}</h3>
              <p className="mt-2 text-[var(--mist)]">{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="pt-32">
        <div className="px-4 sm:px-6">
          <SectionTitle title="Set up in four steps." />
        </div>
        <div className="mt-6">
          <StickySteps device="phone" steps={SETUP} />
        </div>
      </section>

      <FeatureList
        id="do"
        title="Everything, from another device."
        body="Once your PC allows a device, that device can do any of this. You choose which parts each device gets."
        items={[
          { icon: Monitor, title: "The screen, live", body: "Click, type and scroll. Phones get a touchpad and a keyboard, and you can zoom in on small text." },
          { icon: Copy, title: "Copy and paste", body: "Text moves both ways between your device and the PC." },
          { icon: FolderOpen, title: "Your files", body: "Browse the PC's home folder, open files, and send files to it." },
          { icon: TerminalWindow, title: "A terminal", body: "Run commands on the PC as if you were sitting at it." },
          { icon: Robot, title: "Claude Code", body: "Keep working with Claude Code on the PC, signed in with your own account." },
          { icon: Cpu, title: "Its AI models", body: "Chat with the models running on the PC, from your phone." },
          { icon: Power, title: "Lock, sleep or restart", body: "Lock the PC, put it to sleep, restart it or shut it down." },
          { icon: GameController, title: "Game mode", body: "Smooth motion over sharp text, with the mouse captured for games." },
          { icon: Sliders, title: "Speed details", body: "See how far behind the picture is, its size, and whether the connection is direct." },
        ]}
      />

      <FeatureList
        id="rules"
        title="Your rules."
        columns={4}
        items={[
          { icon: Devices, title: "Per device", body: "Pick what each device may do: see the screen, use the mouse and keyboard, files, terminal, or chat with the PC's models." },
          { icon: MapPin, title: "Allowed places", body: "Optionally allow remote control only from certain networks or countries." },
          { icon: ClockCounterClockwise, title: "Activity", body: "The PC keeps a list of who connected, when, and what they did." },
          { icon: ShieldCheck, title: "Two-step sign-in", body: "Remote control only works on accounts with a second sign-in step." },
        ]}
      />

      <TopicQuestions topic="The desktop app and remote control" />

      <Cta title="Bring your PC along." body="Install the desktop app on the PC you want to reach. It's free.">
        <Link href="/download" className="btn-silver px-7 py-3">
          Get the desktop app
        </Link>
      </Cta>
    </SitePage>
  );
}
