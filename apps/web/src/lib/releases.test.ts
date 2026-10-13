import { describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ cacheLife: () => {} }));
import { classify } from "./releases";

describe("classify", () => {
  it.each([
    ["MoonlightC-Setup-1.0.0-x64.exe", "windows", "x64"],
    ["MoonlightC-Setup-1.0.0-arm64.exe", "windows", "arm64"],
    ["MoonlightC-1.0.0-universal.dmg", "mac", "universal"],
    ["MoonlightC-0.1.0-mac-arm64.dmg", "mac", "arm64"],
    ["MoonlightC-0.1.0-mac-x64.dmg", "mac", "x64"],
    ["MoonlightC-1.0.0.AppImage", "linux", "x64"],
    ["MoonlightC-1.0.0-arm64.AppImage", "linux", "arm64"],
    ["moonlightc_1.0.0_arm64.deb", "linux", "arm64"],
  ])("%s", (name, platform, arch) => expect(classify(name)).toMatchObject({ platform, arch }));
  it("ignores blockmaps and yml", () => {
    expect(classify("MoonlightC-Setup-1.0.0-x64.exe.blockmap")).toBeUndefined();
    expect(classify("latest.yml")).toBeUndefined();
    expect(classify("MoonlightC-Setup-0.1.0.exe")).toBeUndefined();
    expect(classify("MoonlightC-0.1.0-linux-aarch64.rpm")).toMatchObject({ platform: "linux", arch: "arm64" });
  });
});
