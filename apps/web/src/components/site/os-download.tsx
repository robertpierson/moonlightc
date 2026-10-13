"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { Build, Platform, Release } from "@/lib/releases";

export interface Detected {
  platform: Platform | "android" | "ios" | "chromeos" | "unknown";
  arch: "x64" | "arm64";
}

export function detectOS(ua: string, uaPlatform = "", uaArch = ""): Detected {
  const arm = /arm|aarch64/i.test(uaArch) || /arm64|aarch64/i.test(ua);
  const arch = arm ? "arm64" : "x64";
  if (/android/i.test(ua)) return { platform: "android", arch };
  if (/iphone|ipad|ipod/i.test(ua)) return { platform: "ios", arch };
  if (/CrOS/.test(ua)) return { platform: "chromeos", arch };
  if (/windows/i.test(uaPlatform) || /Windows NT/i.test(ua)) return { platform: "windows", arch };
  if (/mac/i.test(uaPlatform) || /Macintosh/i.test(ua)) return { platform: "mac", arch };
  if (/linux/i.test(uaPlatform) || /Linux|X11/i.test(ua)) return { platform: "linux", arch };
  return { platform: "unknown", arch };
}

const noop = () => () => {};
function useDetected(): Detected | null {
  return useSyncExternalStore(
    noop,
    () => {
      const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
      return cachedDetect(navigator.userAgent, nav.userAgentData?.platform ?? "");
    },
    () => null,
  );
}
let cache: { key: string; value: Detected } | undefined;
function cachedDetect(ua: string, p: string) {
  const key = ua + p;
  if (cache?.key !== key) cache = { key, value: detectOS(ua, p) };
  return cache.value;
}

export const NAMES: Record<Detected["platform"], string> = {
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
  android: "Android",
  ios: "iPhone and iPad",
  chromeos: "ChromeOS",
  unknown: "your device",
};

export function pickBuild(builds: Build[], d: Detected): Build | undefined {
  const platform = d.platform === "chromeos" ? "linux" : d.platform;
  const forOS = builds.filter((b) => b.platform === platform);
  const pref = (b: Build) => (b.arch === d.arch || b.arch === "universal" ? 0 : 1) + (b.kind === "AppImage" || b.kind.startsWith("Installer") ? 0 : 0.5);
  return forOS.sort((a, b) => pref(a) - pref(b))[0];
}

/** The one primary button: the right desktop build for this visitor, or the web app when there is none. */
export function PrimaryDownload({ release, className }: { release: Release | null; className?: string }) {
  const d = useDetected();
  const build = release && d ? pickBuild(release.builds, d) : undefined;
  if (build) {
    return (
      <a href={build.url} className={className}>
        Download for {NAMES[d!.platform === "chromeos" ? "linux" : d!.platform]}
        <span className="block text-xs font-normal opacity-75">
          v{release!.version} · {build.kind} · {(build.size / 1e6).toFixed(0)} MB
        </span>
      </a>
    );
  }
  return (
    <Link href="/app" className={className}>
      Open the web app{d && d.platform !== "unknown" ? ` on ${NAMES[d.platform]}` : ""}
      <span className="block text-xs font-normal opacity-75">Works in any modern browser. Install it like an app.</span>
    </Link>
  );
}
