import type { Metadata } from "next";
import { TopicQuestions } from "@/components/site/more-sections";
import Image from "next/image";
import Link from "next/link";
import { PrimaryDownload } from "@/components/site/os-download";
import { SHOTS } from "@/components/site/media";
import { InstallApp } from "@/components/site/install-app";
import { getLatestRelease, REPO, type Build } from "@/lib/releases";
import { PageHero, SITE_VIEWPORT, SiteFooter, SiteHeader } from "@/components/site/chrome";

export const viewport = SITE_VIEWPORT;

export const metadata: Metadata = {
  title: "Download · MoonlightC",
  description: "Get MoonlightC for Windows, macOS, Linux, or install the web app.",
};

const GROUPS: { platform: Build["platform"]; name: string; note: string }[] = [
  {
    platform: "windows",
    name: "Windows",
    note: 'Builds aren\'t code-signed yet, so Windows may show "Windows protected your PC". Click More info, then Run anyway.',
  },
  {
    platform: "mac",
    name: "macOS",
    note: "Builds aren't notarized yet. Drag MoonlightC into Applications and open it. If macOS stops it, open System Settings, then Privacy & Security, scroll down and click Open Anyway.",
  },
  {
    platform: "linux",
    name: "Linux",
    note: "arm64 builds also run on Raspberry Pi and on Chromebooks with Linux turned on.",
  },
];

const archLabel = (a: Build["arch"], platform: Build["platform"]) =>
  a === "universal" ? "Apple silicon and Intel" : platform === "mac" ? (a === "arm64" ? "Apple silicon" : "Intel") : a === "arm64" ? "ARM64" : "x64";

export default async function DownloadPage() {
  const release = await getLatestRelease();
  return (
    <div className="site relative min-h-dvh overflow-x-clip">
      <SiteHeader />
      <PageHero title="Get MoonlightC" body="On your computer, in your browser, and in Chrome. Free on every one of them.">
        <PrimaryDownload release={release} className="btn-primary px-7 py-3.5 text-lg" />
      </PageHero>
      <main className="relative mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <section aria-label="Three ways to use MoonlightC" className="grid gap-5 md:grid-cols-3">
          {[
            {
              shot: SHOTS.chat,
              title: "Desktop app",
              body: "Windows, Mac and Linux. Adds remote control, models on your PC and Claude Code.",
              action: release?.builds.length ? <a href="#desktop">See every download</a> : <span>Not released yet. The web app works today.</span>,
            },
            {
              shot: SHOTS.models,
              title: "Web app",
              body: "Any browser, any device. Install it like an app.",
              action: (
                <Link prefetch={false} href="/app">
                  Open web app
                </Link>
              ),
            },
            {
              shot: "/extension/1-shared-tab.webp",
              title: "Chrome extension",
              body: "Let the AI read and use the tabs you share.",
              action: <a href="#ext">How to install it</a>,
            },
          ].map(({ shot, title, body, action }) => (
            <article key={title}>
              <div className="card overflow-hidden rounded-3xl p-2">
                <Image src={shot} alt={`MoonlightC: ${title}`} width={1280} height={800} className="aspect-[16/10] h-auto w-full rounded-[1.1rem] object-cover object-left-top" />
              </div>
              <h2 className="mt-5 px-1 text-2xl">{title}</h2>
              <p className="mt-1 px-1 text-[var(--mist)]">{body}</p>
              <p className="mt-3 px-1 text-sm font-medium text-[var(--tide)] [&_a]:underline-offset-4 [&_a:hover]:underline">{action}</p>
            </article>
          ))}
        </section>

        <section aria-labelledby="desktop" className="mt-28 scroll-mt-24">
          <h2 id="desktop" className="text-[clamp(2rem,4.5vw,3rem)] leading-tight">
            Desktop apps
          </h2>
          {release && release.builds.length > 0 ? (
            <>
              <p className="mt-2 text-[var(--mist)]">
                Version {release.version}, released{" "}
                {new Date(release.publishedAt).toLocaleDateString("en-US", {
                  dateStyle: "long",
                })}
                .{" "}
                <a href={release.notesUrl} className="underline underline-offset-4 hover:text-[var(--ink)]">
                  What&apos;s new
                </a>
              </p>
              <div className="mt-6 grid gap-6 md:grid-cols-3">
                {GROUPS.map((g) => {
                  const builds = release.builds.filter((b) => b.platform === g.platform);
                  if (builds.length === 0) return null;
                  return (
                    <div key={g.platform} className="card spot rounded-3xl p-6">
                      <h3 className="text-xl">{g.name}</h3>
                      <ul className="mt-3 grid gap-2">
                        {builds.map((b) => (
                          <li key={b.name}>
                            <a href={b.url} className="flex justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-white">
                              <span>
                                {b.kind}, {archLabel(b.arch, b.platform)}
                              </span>
                              <span className="whitespace-nowrap text-[var(--mist)]">{(b.size / 1e6).toFixed(0)} MB</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-sm text-[var(--mist)]">{g.note}</p>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="mt-2 max-w-[60ch] text-[var(--mist)]">
              The desktop app hasn&apos;t had its first release yet. Releases appear here automatically from{" "}
              <a href={`https://github.com/${REPO}/releases`} className="underline underline-offset-4 hover:text-[var(--ink)]">
                GitHub Releases
              </a>
              . Until then, install the web app below: it works on every device.
            </p>
          )}
        </section>

        <section aria-labelledby="web" className="mt-24">
          <h2 id="web" className="text-[clamp(2rem,4.5vw,3rem)] leading-tight">
            Install the web app
          </h2>
          <p className="mt-2 max-w-[60ch] text-[var(--mist)]">It opens in its own window, gets an icon, and starts even when you&apos;re offline.</p>
          <InstallApp />
          <dl className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                "Chrome or Edge on a computer",
                "Open the web app, then click the install icon at the right end of the address bar (a monitor with a down arrow), and choose Install.",
              ],
              ["Chrome on Android", "Open the web app, tap the ⋮ menu, then Add to Home screen, then Install."],
              ["Safari on iPhone or iPad", "Open the web app, tap the Share button, then Add to Home Screen, then Add."],
              ["Safari on a Mac", "Open the web app, choose File, then Add to Dock."],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="font-medium">{t}</dt>
                <dd className="mt-1 text-[var(--mist)]">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="ext" className="mt-24 scroll-mt-24">
          <h2 id="ext" className="text-[clamp(2rem,4.5vw,3rem)] leading-tight">
            Chrome extension
          </h2>
          <p className="mt-2 max-w-[60ch] text-[var(--mist)]">
            Let the AI read and use browser tabs you share with it: it can read a page, click, type and open links. Buying, sending or deleting always waits for
            your OK.
          </p>
          <a href="/downloads/moonlightc-chrome-extension.zip" download className="btn-primary mt-5 px-6 py-3">
            Download the extension
          </a>
          <ol className="mt-4 grid max-w-[60ch] list-decimal gap-1 pl-5 text-[var(--mist)]">
            <li>Unzip the file (right-click it, then Extract all).</li>
            <li>In Chrome or Edge, go to chrome://extensions and turn on Developer mode (top right).</li>
            <li>Click Load unpacked and pick the moonlightc-chrome-extension folder you unzipped (the one with manifest.json in it).</li>
            <li>On any tab, click the MoonlightC icon and choose Share this tab.</li>
          </ol>
        </section>
        <div className="-mx-4 sm:-mx-6">
          <TopicQuestions topic="The desktop app and remote control" />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
