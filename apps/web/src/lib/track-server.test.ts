import { describe, expect, it } from "vitest";
import { cleanProps, CONSENT_COUNTRIES, deviceOf } from "./track-server";

describe("usage stats rules", () => {
  it("keeps only short plain values", () => {
    expect(cleanProps({ provider: "openrouter", where: "local", n: 3, ok: true, text: "my secret message here with spaces", Bad: "x", key: "sk-or-v1-" + "a".repeat(60) })).toEqual({ provider: "openrouter", where: "local", n: 3, ok: true });
    expect(cleanProps("nope")).toEqual({});
  });
  it("knows where consent is needed and reads devices", () => {
    expect(CONSENT_COUNTRIES.has("DE")).toBe(true);
    expect(CONSENT_COUNTRIES.has("US")).toBe(false);
    expect(deviceOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140 Safari/537")).toEqual({ os: "windows", browser: "chrome" });
    expect(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18 Mobile Safari/604")).toEqual({ os: "ios", browser: "safari" });
  });
});
