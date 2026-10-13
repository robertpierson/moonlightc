import { cacheLife } from "next/cache";

export const REPO = "robertpierson/moonlightc";

export type Platform = "windows" | "mac" | "linux";
export type Arch = "x64" | "arm64";

export interface Build {
  platform: Platform;
  arch: Arch | "universal";
  kind: string; // installer type shown to users, e.g. "Installer (.exe)"
  name: string;
  url: string;
  size: number;
}

export interface Release {
  version: string;
  publishedAt: string;
  notesUrl: string;
  notes: string;
  builds: Build[];
}

export function classify(name: string): Omit<Build, "name" | "url" | "size"> | undefined {
  const arm = /arm64|aarch64/i.test(name);
  const arch: Arch = arm ? "arm64" : "x64";
  if (/\.exe$/i.test(name) && !/blockmap/i.test(name)) return { platform: "windows", arch, kind: "Installer (.exe)" };
  if (/\.dmg$/i.test(name)) return { platform: "mac", arch: /universal/i.test(name) ? "universal" : arch, kind: "Disk image (.dmg)" };
  if (/\.AppImage$/i.test(name)) return { platform: "linux", arch, kind: "AppImage" };
  if (/\.deb$/i.test(name)) return { platform: "linux", arch, kind: "Debian/Ubuntu (.deb)" };
  if (/\.rpm$/i.test(name)) return { platform: "linux", arch, kind: "Fedora/openSUSE (.rpm)" };
  return undefined;
}

/** Latest published GitHub release, refreshed hourly. Returns null when nothing has been released yet. */
export async function getLatestRelease(): Promise<Release | null> {
  "use cache";
  cacheLife("hours");
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { accept: "application/vnd.github+json" } }).catch(() => null);
  if (!res?.ok) return null;
  const r = (await res.json()) as { tag_name: string; published_at: string; html_url: string; body?: string; assets: { name: string; browser_download_url: string; size: number }[] };
  const builds = r.assets.flatMap((a) => {
    const c = classify(a.name);
    return c ? [{ ...c, name: a.name, url: a.browser_download_url, size: a.size }] : [];
  });
  return { version: r.tag_name.replace(/^v/, ""), publishedAt: r.published_at, notesUrl: r.html_url, notes: (r.body ?? "").slice(0, 4000), builds };
}
