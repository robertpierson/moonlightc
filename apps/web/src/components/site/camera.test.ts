import { describe, expect, it } from "vitest";
import { DEMO_CAMERA } from "./pages";
import { cameraAt } from "./scenes";

describe("demo camera", () => {
  it("starts wide and ends wide", () => {
    const c = cameraAt(0);
    expect(c.s).toBe(1);
    expect(c.tx).toBeCloseTo(0);
    expect(c.ty).toBeCloseTo(0);
    expect(cameraAt(99).s).toBe(1);
  });
  it("zooms on the message box while typing, never past the frame's edge", () => {
    const c = cameraAt(2); // between two identical points: holding still
    expect(c.s).toBeCloseTo(1.6);
    expect(c.tx).toBeCloseTo(-16); // focus x 0.6 pulled to the middle
    expect(c.ty).toBeCloseTo(-30); // focus y 0.88 would need -60.8%, clamped to the edge
  });
  it("eases between points", () => {
    const mid = cameraAt((0.6 + 1.3) / 2);
    expect(mid.s).toBeGreaterThan(1);
    expect(mid.s).toBeLessThan(1.6);
  });
  it("points are in time order", () => {
    for (let i = 1; i < DEMO_CAMERA.length; i++) expect(DEMO_CAMERA[i][0]).toBeGreaterThan(DEMO_CAMERA[i - 1][0]);
  });
});
