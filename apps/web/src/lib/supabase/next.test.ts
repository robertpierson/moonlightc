import { describe, expect, it } from "vitest";
import { safeNext } from "./client";

describe("where to go after signing in", () => {
  it("never loops back into onboarding or sign-in, and stays on this site", () => {
    expect(safeNext("/onboarding")).toBe("/app");
    expect(safeNext("/onboarding?next=%2Fapp")).toBe("/app");
    expect(safeNext("/signin")).toBe("/app");
    expect(safeNext("/auth/callback")).toBe("/app");
    expect(safeNext("//evil.com")).toBe("/app");
    expect(safeNext("/admin")).toBe("/admin");
    expect(safeNext("/app")).toBe("/app");
  });
});
