import type { Metadata } from "next";
import { Globe, Monitor, Puzzle } from "lucide-react";
import Link from "next/link";
import { PrimaryDownload } from "@/components/site/os-download";
import { InstallApp } from "@/components/site/install-app";
import { getLatestRelease, REPO, type Build } from "@/lib/releases";
import { PageHero, SITE_VIEWPORT, SiteFooter, SiteHeader } from "@/components/site/chrome";

export const viewport = SITE_VIEWPORT;

export const metadata: Metadata = { title: "Download · MoonlightC", description: "Get MoonlightC for Windows, macOS, Linux, or install the web app." };

const GROUPS: { platform: Build["platform"]; name: string; note: string }[] = [
  { platform: "windows", name: "Windows", note: "Builds aren't code-signed yet, so Windows may show \"Windows protected your PC\". Click More info, then Run anyway." },
  { platform: "mac", name: "macOS", note: "Builds aren't signed yet. After opening the .dmg, right-click MoonlightC in Applications and choose Open the first time." },
  { platform: "linux", name: "Linux", note: "arm64 builds also run on Raspberry Pi and on Chromebooks with Linux turned on." },
];

const archLabel = (a: Build["arch"], platform: Build["platform"]) =>
  a === "universal" ? "Apple silicon and Intel" : platform === "mac" ? (a === "arm64" ? "Apple silicon" : "Intel") : a === "arm64" ? "ARM64" : "x64";

export default async function DownloadPage() {
  const release = await getLatestRelease();
  return (
    <div className="site relative min-h-dvh overflow-x-clip">
      <SiteHeader />
      <PageHero title="Get MoonlightC" body="On your computer, in your browser, and in Chrome. Free on every one of them.">
        <PrimaryDownload release={release} className="btn-primary flex-col px-7 py-3.5 text-lg [&>span]:opacity-80" />
      </PageHero>
      <main className="relative mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <section aria-label="Three ways to use MoonlightC" className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Monitor,
              title: "Desktop app",
              body: "Windows, Mac and Linux. Adds remote control, models on your PC and Claude Code.",
              action: release?.builds.length ? <a href="#desktop">See every download</a> : <span>Not released yet. The web app works today.</span>,
            },
            { icon: Globe, title: "Web app", body: "Any browser, any device. Install it like an app.", action: <Link prefetch={false} href="/app">Open web app</Link> },
            { icon: Puzzle, title: "Chrome extension", body: "Let the AI read and use the tabs you share.", action: <a href="#ext">How to install it</a> },
          ].map(({ icon: Icon, title, body, action }) => (
            <article key={title} className="card spot tilt3d rise flex flex-col rounded-[1.75rem] p-7">
              <span className="grid size-12 place-items-center rounded-2xl [background:var(--g-brand)] text-white shadow-lg shadow-[#0e1628]/20">
                <Icon className="size-5" aria-hidden />
              </span>
              <h2 className="mt-6 text-2xl">{title}</h2>
              <p className="mt-2 flex-1 text-[var(--mist)]">{body}</p>
              <p className="mt-5 text-sm font-medium text-[var(--tide)] [&_a]:underline-offset-4 [&_a:hover]:underline">{action}</p>
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
                Version {release.version}, released {new Date(release.publishedAt).toLocaleDateString("en-US", { dateStyle: "long" })}.{" "}
                <a href={release.notesUrl} className="underline underline-offset-4 hover:text-[var(--ink)]">
                  What&apos;s new
                </a>
              </p>
              <div className="mt-6 grid gap-6 md:grid-cols-3">
                {GROUPS.map((g) => {
                  const builds = release.builds.filter((b) => b.platform === g.platform);
                  if (builds.length === 0) return null;
                  return (
                    <div key={g.platform} className="card spot rise rounded-3xl p-6">
                      <h3 className="text-xl">{g.name}</h3>
                      <ul className="mt-3 grid gap-2">
                        {builds.map((b) => (
                          <li key={b.name}>
                            <a href={b.url} className="flex justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-white">
                              <span>
                                {b.kind}, {archLabel(b.arch, b.platform)}
                              </span>
                              <span className="text-[var(--mist)]">{(b.size / 1e6).toFixed(0)} MB</span>
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
          <dl className="mt-6 grid gap-5 md:grid-cols-2">
            {[
              ["Chrome or Edge on a computer", "Open the web app, then click the install icon at the right end of the address bar (a monitor with a down arrow), and choose Install."],
              ["Chrome on Android", "Open the web app, tap the ⋮ menu, then Add to Home screen, then Install."],
              ["Safari on iPhone or iPad", "Open the web app, tap the Share button, then Add to Home Screen, then Add."],
              ["Safari on a Mac", "Open the web app, choose File, then Add to Dock."],
            ].map(([t, d]) => (
              <div key={t} className="card spot rise rounded-3xl p-6">
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
            Let the AI read and use browser tabs you share with it: it can read a page, click, type and open links. Buying, sending or deleting always waits for your OK.
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
      </main>
      <SiteFooter />
    </div>
  );
}
