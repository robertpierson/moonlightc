import { describe, expect, it } from "vitest";
import { attest, verify } from "./attest";

describe("signed location notes", () => {
  it("verify only untampered, unexpired notes", () => {
    process.env.ATTEST_SECRET = "test-secret";
    const w = attest(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "x-vercel-ip-country": "US", "x-vercel-ip-city": "Austin" }));
    expect(w).toMatchObject({ ip: "203.0.113.7", country: "US", city: "Austin" });
    expect(verify(w)).toBe(true);
    expect(verify({ ...w, ip: "198.51.100.1" })).toBe(false);
    expect(verify({ ...w, exp: Date.now() - 1 })).toBe(false);
  });
});
