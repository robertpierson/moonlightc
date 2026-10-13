import { describe, expect, it } from "vitest";
import type { Build } from "@/lib/releases";
import { detectOS, pickBuild } from "./os-download";

const b = (platform: Build["platform"], arch: Build["arch"], kind: string): Build => ({ platform, arch, kind, name: kind, url: "", size: 1 });
const builds = [b("windows", "x64", "Installer (.exe)"), b("windows", "arm64", "Installer (.exe)"), b("mac", "universal", "Disk image (.dmg)"), b("linux", "x64", "Debian/Ubuntu (.deb)"), b("linux", "x64", "AppImage"), b("linux", "arm64", "AppImage")];

describe("detectOS", () => {
  it("detects common systems", () => {
    expect(detectOS("Mozilla/5.0 (Windows NT 10.0; Win64; x64)").platform).toBe("windows");
    expect(detectOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)").platform).toBe("mac");
    expect(detectOS("Mozilla/5.0 (Linux; Android 14; Pixel 7)").platform).toBe("android");
    expect(detectOS("Mozilla/5.0 (X11; Linux aarch64)")).toEqual({ platform: "linux", arch: "arm64" });
    expect(detectOS("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)").platform).toBe("chromeos");
    expect(detectOS("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)").platform).toBe("ios");
  });
});

describe("pickBuild", () => {
  it("prefers matching arch and the main installer", () => {
    expect(pickBuild(builds, { platform: "windows", arch: "arm64" })?.arch).toBe("arm64");
    expect(pickBuild(builds, { platform: "linux", arch: "x64" })?.kind).toBe("AppImage");
    expect(pickBuild(builds, { platform: "chromeos", arch: "arm64" })).toMatchObject({ platform: "linux", arch: "arm64" });
    expect(pickBuild(builds, { platform: "android", arch: "arm64" })).toBeUndefined();
  });
});
