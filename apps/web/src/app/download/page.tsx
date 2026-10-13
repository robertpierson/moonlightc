import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import Link from "next/link";
import { PrimaryDownload } from "@/components/site/os-download";
import { InstallApp } from "@/components/site/install-app";
import { getLatestRelease, REPO, type Build } from "@/lib/releases";
import "@/components/site/site.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], axes: ["wdth", "opsz"], variable: "--font-display" });

export const metadata: Metadata = { title: "Download · MoonlightC", description: "Get MoonlightC for Windows, macOS, Linux, or install the web app." };

const GROUPS: { platform: Build["platform"]; name: string; note: string }[] = [
  { platform: "windows", name: "Windows", note: "Builds aren't code-signed yet, so Windows may show \"Windows protected your PC\". Click More info, then Run anyway." },
  { platform: "mac", name: "macOS", note: "Builds aren't signed yet. After opening the .dmg, right-click MoonlightC in Applications and choose Open the first time." },
  { platform: "linux", name: "Linux", note: "arm64 builds also run on Raspberry Pi and on Chromebooks with Linux turned on." },
];

const archLabel = (a: Build["arch"]) => (a === "universal" ? "Apple silicon and Intel" : a === "arm64" ? "ARM64" : "x64");

export default async function DownloadPage() {
  const release = await getLatestRelease();
  return (
    <div className={`${display.variable} site min-h-dvh`}>
      <header className="mx-auto flex max-w-5xl items-center px-4 py-5 sm:px-6">
        <Link href="/" className="display text-xl font-semibold">
          MoonlightC
        </Link>
        <Link prefetch={false} href="/app" className="ml-auto rounded-full bg-[var(--silver)] px-4 py-2 text-sm font-medium text-[var(--night)] hover:opacity-90">
          Open web app
        </Link>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <h1 className="display pt-10 text-[clamp(2.8rem,9vw,5.5rem)] font-bold">Get MoonlightC</h1>
        <div className="mt-8">
          <PrimaryDownload release={release} className="inline-block rounded-2xl bg-[var(--silver)] px-6 py-4 text-lg font-semibold text-[var(--night)] hover:opacity-90" />
        </div>

        <section aria-labelledby="desktop" className="mt-16">
          <h2 id="desktop" className="display text-3xl font-semibold sm:text-4xl">
            Desktop apps
          </h2>
          {release && release.builds.length > 0 ? (
            <>
              <p className="mt-2 text-[var(--mist)]">
                Version {release.version}, released {new Date(release.publishedAt).toLocaleDateString("en-US", { dateStyle: "long" })}.{" "}
                <a href={release.notesUrl} className="underline underline-offset-4 hover:text-[var(--tide)]">
                  What&apos;s new
                </a>
              </p>
              <div className="mt-6 grid gap-6 md:grid-cols-3">
                {GROUPS.map((g) => {
                  const builds = release.builds.filter((b) => b.platform === g.platform);
                  if (builds.length === 0) return null;
                  return (
                    <div key={g.platform} className="rounded-2xl border border-[var(--line)] p-5">
                      <h3 className="text-xl font-semibold">{g.name}</h3>
                      <ul className="mt-3 grid gap-2">
                        {builds.map((b) => (
                          <li key={b.name}>
                            <a href={b.url} className="flex justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--night-2)]">
                              <span>
                                {b.kind}, {archLabel(b.arch)}
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
              <a href={`https://github.com/${REPO}/releases`} className="underline underline-offset-4 hover:text-[var(--tide)]">
                GitHub Releases
              </a>
              . Until then, install the web app below: it works on every device.
            </p>
          )}
        </section>

        <section aria-labelledby="web" className="mt-16">
          <h2 id="web" className="display text-3xl font-semibold sm:text-4xl">
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
              <div key={t} className="rounded-2xl border border-[var(--line)] p-5">
                <dt className="font-semibold">{t}</dt>
                <dd className="mt-1 text-[var(--mist)]">{d}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}
