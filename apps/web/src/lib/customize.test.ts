import { describe, expect, it } from "vitest";
import { decodeDistro, DISTROS, encodeDistro, LookSchema, matchShortcut, shortcutFromEvent } from "./customize";

describe("distro links", () => {
  it("round-trips every built-in distro", () => {
    for (const d of DISTROS) expect(decodeDistro(encodeDistro(d))).toEqual(d);
  });
  it("rejects unsafe wallpapers and junk", () => {
    const bad = { ...DISTROS[0], look: { ...DISTROS[0].look, wallpaper: "javascript:alert(1)" } };
    expect(() => decodeDistro(encodeDistro(bad))).toThrow();
    const css = { ...DISTROS[0], look: { ...DISTROS[0].look, wallpaper: "https://x.y/a.png'); background:red" } };
    expect(() => decodeDistro(encodeDistro(css))).toThrow();
    expect(() => decodeDistro("not-base64-json")).toThrow();
  });
  it("only accepts hex colors in overrides", () => {
    expect(() => LookSchema.parse({ theme: "paper", overrides: { primary: "red;}" } })).toThrow();
    expect(LookSchema.parse({ theme: "paper", overrides: { primary: "#112233" } }).overrides.primary).toBe("#112233");
  });
});

describe("shortcuts", () => {
  const ev = (key: string, o: Partial<KeyboardEvent> = {}) => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...o }) as KeyboardEvent;
  it("matches mod+k with Ctrl or Cmd", () => {
    expect(matchShortcut(ev("k", { ctrlKey: true }), "mod+k")).toBe(true);
    expect(matchShortcut(ev("k", { metaKey: true }), "mod+k")).toBe(true);
    expect(matchShortcut(ev("k", { ctrlKey: true, shiftKey: true }), "mod+k")).toBe(false);
  });
  it("records a combo from a key press", () => {
    expect(shortcutFromEvent(ev("O", { ctrlKey: true, shiftKey: true }))).toBe("mod+shift+o");
    expect(shortcutFromEvent(ev("Shift", { shiftKey: true }))).toBeUndefined();
  });
});
