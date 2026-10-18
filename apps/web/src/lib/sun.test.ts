import { describe, expect, it } from "vitest";
import { sunElevation, sunLook } from "./sun";

describe("follow the sun", () => {
  it("knows day from night and dims through dusk", () => {
    // Austin, Texas: high at local noon (about 18:30 UTC in June), below the horizon at midnight.
    expect(sunElevation(30.3, -97.7, new Date("2026-06-21T18:30:00Z"))).toBeGreaterThan(70);
    expect(sunElevation(30.3, -97.7, new Date("2026-06-21T06:30:00Z"))).toBeLessThan(-30);
    expect(sunLook(40)).toEqual({ mode: "light", brightness: 1 });
    expect(sunLook(-10).mode).toBe("dark");
    expect(sunLook(2).brightness).toBeLessThan(1);
  });
});
